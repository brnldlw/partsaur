-- Phase 4: Wanted board, matching, conversations, email settings
-- Run in Supabase → SQL Editor (safe to run more than once).

-- ---------------------------------------------------------------
-- Email settings on profiles
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists wanted_pings boolean not null default true;
alter table public.profiles add column if not exists email_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_email_token_key on public.profiles (email_token);
grant insert (wanted_pings), update (wanted_pings) on public.profiles to authenticated;

-- ---------------------------------------------------------------
-- wanted_requests
-- ---------------------------------------------------------------
create table if not exists public.wanted_requests (
  id                     uuid primary key default gen_random_uuid(),
  requester_id           uuid not null references public.profiles (id) on delete cascade,
  part_number            text check (length(part_number) <= 80),
  part_number_normalized text generated always as
                           (upper(regexp_replace(coalesce(part_number, ''), '[^A-Za-z0-9]', '', 'g'))) stored,
  brand                  text check (length(brand) <= 80),
  description            text check (length(description) <= 1000),
  category               text,
  trade                  text not null default 'hvacr' check (trade in ('hvacr', 'electrical', 'plumbing')),
  needed_by              date,
  radius_miles           int not null default 150 check (radius_miles in (25, 50, 100, 150, 300)),
  zip                    text not null references public.zip_codes (zip),
  location               extensions.geography(Point, 4326),
  status                 text not null default 'open' check (status in ('open', 'filled', 'closed')),
  boosted_until          timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (coalesce(part_number, '') <> '' or coalesce(description, '') <> '')
);

create index if not exists wanted_requester_idx on public.wanted_requests (requester_id);
create index if not exists wanted_status_idx on public.wanted_requests (status);
create index if not exists wanted_pn_idx on public.wanted_requests (part_number_normalized);
create index if not exists wanted_location_idx on public.wanted_requests using gist (location);

alter table public.wanted_requests enable row level security;

drop policy if exists "Open wanted requests are public" on public.wanted_requests;
create policy "Open wanted requests are public"
  on public.wanted_requests for select
  to anon, authenticated
  using (status = 'open');

drop policy if exists "Requesters see their own requests" on public.wanted_requests;
create policy "Requesters see their own requests"
  on public.wanted_requests for select
  to authenticated
  using (requester_id = (select auth.uid()));

drop policy if exists "Users can post wanted requests" on public.wanted_requests;
create policy "Users can post wanted requests"
  on public.wanted_requests for insert
  to authenticated
  with check (requester_id = (select auth.uid()));

drop policy if exists "Requesters can update their requests" on public.wanted_requests;
create policy "Requesters can update their requests"
  on public.wanted_requests for update
  to authenticated
  using (requester_id = (select auth.uid()))
  with check (requester_id = (select auth.uid()));

-- boosted_until is set by the Stripe webhook only.
revoke all on public.wanted_requests from anon;
grant select on public.wanted_requests to anon;
revoke insert, update, delete on public.wanted_requests from authenticated;
grant insert (requester_id, part_number, brand, description, category, trade, needed_by, radius_miles, zip)
  on public.wanted_requests to authenticated;
grant update (description, needed_by, status) on public.wanted_requests to authenticated;

drop trigger if exists wanted_set_location on public.wanted_requests;
create trigger wanted_set_location
  before insert or update of zip on public.wanted_requests
  for each row execute function public.set_location_from_zip();

-- updated_at + max 5 new requests per user per day.
create or replace function public.wanted_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and (
    select count(*) from public.wanted_requests w
    where w.requester_id = new.requester_id and w.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'WANTED_LIMIT: max 5 wanted requests per day' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists wanted_before_write on public.wanted_requests;
create trigger wanted_before_write
  before insert or update on public.wanted_requests
  for each row execute function public.wanted_before_write();

-- ---------------------------------------------------------------
-- matches: a seller asked about (or responding to) a wanted request.
-- Written by the server only.
-- ---------------------------------------------------------------
create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),
  wanted_id       uuid not null references public.wanted_requests (id) on delete cascade,
  listing_id      uuid references public.listings (id) on delete set null,
  seller_id       uuid not null references public.profiles (id) on delete cascade,
  match_type      text not null check (match_type in ('exact', 'likely', 'ping')),
  miles           double precision,
  notified_at     timestamptz,
  seller_response text check (seller_response in ('have_it', 'no')),
  responded_at    timestamptz,
  response_token  uuid not null unique default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  unique (wanted_id, seller_id)
);

create index if not exists matches_seller_idx on public.matches (seller_id);

alter table public.matches enable row level security;

drop policy if exists "Sellers see their matches" on public.matches;
create policy "Sellers see their matches"
  on public.matches for select
  to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists "Requesters see matches on their requests" on public.matches;
create policy "Requesters see matches on their requests"
  on public.matches for select
  to authenticated
  using (exists (
    select 1 from public.wanted_requests w
    where w.id = wanted_id and w.requester_id = (select auth.uid())
  ));

revoke all on public.matches from anon;
revoke insert, update, delete on public.matches from authenticated;

-- ---------------------------------------------------------------
-- conversations: buyer ↔ seller. Messages arrive in phase 5.
-- ---------------------------------------------------------------
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  wanted_id  uuid references public.wanted_requests (id) on delete set null,
  buyer_id   uuid not null references public.profiles (id) on delete cascade,
  seller_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists conversations_wanted_seller_key
  on public.conversations (wanted_id, seller_id);

alter table public.conversations enable row level security;

drop policy if exists "Participants see their conversations" on public.conversations;
create policy "Participants see their conversations"
  on public.conversations for select
  to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

revoke all on public.conversations from anon;
revoke insert, update, delete on public.conversations from authenticated;

-- ---------------------------------------------------------------
-- email_log: every email we send, for daily caps. Server only.
-- ---------------------------------------------------------------
create table if not exists public.email_log (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  to_user_id uuid references auth.users (id) on delete set null,
  to_email   text not null,
  ref_id     uuid,
  created_at timestamptz not null default now()
);

create index if not exists email_log_created_idx on public.email_log (created_at);
create index if not exists email_log_user_kind_idx on public.email_log (to_user_id, kind, created_at);

alter table public.email_log enable row level security;
-- No policies: service role only.

-- ---------------------------------------------------------------
-- Effective radius: boosted requests reach twice as far.
-- ---------------------------------------------------------------
create or replace function public.wanted_effective_miles(w public.wanted_requests)
returns int
language sql
stable
set search_path = ''
as $$
  select case when w.boosted_until > now() then w.radius_miles * 2 else w.radius_miles end;
$$;

-- ---------------------------------------------------------------
-- Public board (no requester contact info).
-- ---------------------------------------------------------------
drop function if exists public.search_wanted(double precision, double precision, int, text, uuid, int, int);
create function public.search_wanted(
  lat          double precision default null,
  lng          double precision default null,
  radius_miles int default null,
  q            text default null,
  p_id         uuid default null,
  lim          int default 30,
  off          int default 0
)
returns table (
  id uuid, part_number text, brand text, description text, category text, needed_by date,
  radius_miles int, zip text, status text, boosted boolean, created_at timestamptz,
  requester_id uuid, requester_name text, miles double precision, total bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select
      nullif(trim(q), '') as q,
      upper(regexp_replace(coalesce(q, ''), '[^A-Za-z0-9]', '', 'g')) as qn,
      case when lat is not null and lng is not null
        then extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
      end as here
  )
  select w.id, w.part_number, w.brand, w.description, w.category, w.needed_by,
         w.radius_miles, w.zip, w.status, coalesce(w.boosted_until > now(), false), w.created_at,
         w.requester_id,
         trim(split_part(p.display_name, ' ', 1) || ' ' ||
              coalesce(nullif(left(split_part(p.display_name, ' ', 2), 1), '') || '.', '')),
         case when pa.here is not null then extensions.st_distance(w.location, pa.here) / 1609.344 end,
         count(*) over ()
  from public.wanted_requests w
  join public.profiles p on p.id = w.requester_id
  cross join params pa
  where w.status = 'open'
    and (w.needed_by is null or w.needed_by >= current_date - 7)
    and (p_id is null or w.id = p_id)
    and (
      pa.q is null
      or (length(pa.qn) >= 3 and w.part_number_normalized like '%' || pa.qn || '%')
      or w.brand ilike '%' || pa.q || '%'
      or w.description ilike '%' || pa.q || '%'
    )
    and (radius_miles is null or pa.here is null
         or extensions.st_dwithin(w.location, pa.here, radius_miles * 1609.344))
  order by coalesce(w.boosted_until > now(), false) desc,
           case when pa.here is not null then extensions.st_distance(w.location, pa.here) end asc nulls last,
           w.created_at desc
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
$$;

revoke all on function public.search_wanted(double precision, double precision, int, text, uuid, int, int) from public;
grant execute on function public.search_wanted(double precision, double precision, int, text, uuid, int, int)
  to anon, authenticated;

-- ---------------------------------------------------------------
-- Matching (server only).
-- ---------------------------------------------------------------

-- Brand for a request: what they typed, else what the parts table knows for that part #.
create or replace function public.wanted_brand(w public.wanted_requests)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(trim(w.brand), ''),
    (select p.brand from public.parts p
     where p.part_number_normalized = w.part_number_normalized and length(w.part_number_normalized) >= 3
       and p.brand is not null
     limit 1));
$$;

-- Sellers with that exact part # listed inside the request's radius.
create or replace function public.wanted_exact_matches(p_wanted_id uuid)
returns table (seller_id uuid, listing_id uuid, listing_title text, miles double precision, paid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (l.seller_id)
         l.seller_id, l.id, l.title,
         extensions.st_distance(l.location, w.location) / 1609.344,
         coalesce(b.plan, 'free') <> 'free'
  from public.wanted_requests w
  join public.listings l
    on l.part_number_normalized = w.part_number_normalized
   and l.status = 'active'
   and l.seller_id <> w.requester_id
   and extensions.st_dwithin(l.location, w.location, public.wanted_effective_miles(w) * 1609.344)
  join public.profiles pr on pr.id = l.seller_id
  left join public.businesses b on b.id = pr.business_id
  where w.id = p_wanted_id and length(w.part_number_normalized) >= 3 and w.status = 'open'
  order by l.seller_id, extensions.st_distance(l.location, w.location);
$$;

-- Sellers who probably have it: same brand (+ category if given) listed nearby,
-- or who have listed that brand before and are based nearby. Paid plans first.
create or replace function public.wanted_likely_sellers(p_wanted_id uuid)
returns table (seller_id uuid, miles double precision, paid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select wr.*, public.wanted_brand(wr) as brand_guess,
           public.wanted_effective_miles(wr) * 1609.344 as meters
    from public.wanted_requests wr
    where wr.id = p_wanted_id and wr.status = 'open'
  ),
  candidates as (
    select l.seller_id, extensions.st_distance(l.location, w.location) / 1609.344 as miles
    from w
    join public.listings l
      on l.status = 'active'
     and lower(l.brand) = lower(w.brand_guess)
     and (w.category is null or l.category = w.category)
     and extensions.st_dwithin(l.location, w.location, w.meters)
    union all
    select p.id, extensions.st_distance(p.location, w.location) / 1609.344
    from w
    join public.profiles p
      on extensions.st_dwithin(p.location, w.location, w.meters)
    where exists (
      select 1 from public.listings l2
      where l2.seller_id = p.id and lower(l2.brand) = lower(w.brand_guess)
    )
  )
  select c.seller_id, min(c.miles), coalesce(b.plan, 'free') <> 'free' as paid
  from candidates c
  cross join w
  join public.profiles pr on pr.id = c.seller_id
  left join public.businesses b on b.id = pr.business_id
  where w.brand_guess is not null
    and c.seller_id <> w.requester_id
    and pr.wanted_pings
    and not exists (select 1 from public.matches m where m.wanted_id = w.id and m.seller_id = c.seller_id)
  group by c.seller_id, b.plan
  order by paid desc, min(c.miles)
  limit 50;
$$;

-- Open requests a new listing satisfies (listing inside the requester's radius).
create or replace function public.listing_wanted_matches(p_listing_id uuid)
returns table (wanted_id uuid, requester_id uuid, miles double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.requester_id, extensions.st_distance(l.location, w.location) / 1609.344
  from public.listings l
  join public.wanted_requests w
    on w.part_number_normalized = l.part_number_normalized
   and w.status = 'open'
   and (w.needed_by is null or w.needed_by >= current_date - 7)
   and w.requester_id <> l.seller_id
   and extensions.st_dwithin(l.location, w.location, public.wanted_effective_miles(w) * 1609.344)
  where l.id = p_listing_id and l.status = 'active' and length(l.part_number_normalized) >= 3
    and not exists (select 1 from public.matches m where m.wanted_id = w.id and m.seller_id = l.seller_id);
$$;

-- "Notify me" sign-ups a new listing satisfies (within 150 mi of their zip, or anywhere if no zip).
create or replace function public.listing_alert_matches(p_listing_id uuid)
returns table (alert_id uuid, email text, user_id uuid, miles double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.email, a.user_id,
         case when z.location is not null then extensions.st_distance(l.location, z.location) / 1609.344 end
  from public.listings l
  join public.part_alerts a
    on a.part_number_normalized = l.part_number_normalized and a.notified_at is null
  left join public.zip_codes z on z.zip = a.zip
  where l.id = p_listing_id and l.status = 'active' and length(l.part_number_normalized) >= 3
    and (a.user_id is null or a.user_id <> l.seller_id)
    and (z.location is null or extensions.st_dwithin(l.location, z.location, 150 * 1609.344));
$$;

revoke all on function public.wanted_exact_matches(uuid) from public, anon, authenticated;
revoke all on function public.wanted_likely_sellers(uuid) from public, anon, authenticated;
revoke all on function public.listing_wanted_matches(uuid) from public, anon, authenticated;
revoke all on function public.listing_alert_matches(uuid) from public, anon, authenticated;
revoke all on function public.wanted_before_write() from public, anon, authenticated;
grant execute on function public.wanted_exact_matches(uuid) to service_role;
grant execute on function public.wanted_likely_sellers(uuid) to service_role;
grant execute on function public.listing_wanted_matches(uuid) to service_role;
grant execute on function public.listing_alert_matches(uuid) to service_role;
