-- Phase 3: parts pages, search, "notify me" alerts
-- Run in Supabase → SQL Editor (safe to run more than once).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------
-- parts: one row per brand + part number, created from listings.
-- ---------------------------------------------------------------
create table if not exists public.parts (
  id                     uuid primary key default gen_random_uuid(),
  brand                  text,
  part_number            text not null,
  part_number_normalized text not null,
  description            text,
  category               text,
  trade                  text not null default 'hvacr',
  slug                   text not null unique,
  created_at             timestamptz not null default now()
);

create unique index if not exists parts_brand_pn_key
  on public.parts (coalesce(lower(brand), ''), part_number_normalized);
create index if not exists parts_pn_normalized_idx on public.parts (part_number_normalized);

alter table public.parts enable row level security;

drop policy if exists "Parts are public" on public.parts;
create policy "Parts are public"
  on public.parts for select
  to anon, authenticated
  using (true);
-- No write policies: rows are created by the listings trigger below.
revoke insert, update, delete on public.parts from anon, authenticated;

-- "Copeland" + "ZP36K5E-PFV-830" → "copeland-zp36k5e-pfv-830"
create or replace function public.part_slug(p_brand text, p_part_number text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from lower(regexp_replace(
    concat_ws(' ', nullif(trim(p_brand), ''), p_part_number), '[^A-Za-z0-9]+', '-', 'g')));
$$;

-- Find or create the part for a listing and link it.
create or replace function public.listings_link_part()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pn_norm text := upper(regexp_replace(coalesce(new.part_number, ''), '[^A-Za-z0-9]', '', 'g'));
  brand_key text := coalesce(lower(nullif(trim(new.brand), '')), '');
  found_id uuid;
  base_slug text;
  try_slug text;
  n int := 1;
begin
  if length(pn_norm) < 3 then
    new.part_id := null;
    return new;
  end if;

  select p.id into found_id
  from public.parts p
  where coalesce(lower(p.brand), '') = brand_key and p.part_number_normalized = pn_norm;

  if found_id is null then
    base_slug := public.part_slug(new.brand, new.part_number);
    try_slug := base_slug;
    while exists (select 1 from public.parts where slug = try_slug) loop
      n := n + 1;
      try_slug := base_slug || '-' || n;
    end loop;

    insert into public.parts (brand, part_number, part_number_normalized, category, trade, slug)
    values (nullif(trim(new.brand), ''), trim(new.part_number), pn_norm, new.category, new.trade, try_slug)
    on conflict do nothing
    returning id into found_id;

    -- Lost a race with another insert: read the winner.
    if found_id is null then
      select p.id into found_id
      from public.parts p
      where coalesce(lower(p.brand), '') = brand_key and p.part_number_normalized = pn_norm;
    end if;
  end if;

  new.part_id := found_id;
  return new;
end;
$$;

revoke all on function public.listings_link_part() from public, anon, authenticated;

drop trigger if exists listings_link_part on public.listings;
create trigger listings_link_part
  before insert or update of brand, part_number on public.listings
  for each row execute function public.listings_link_part();

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'listings_part_id_fkey' and table_name = 'listings'
  ) then
    alter table public.listings
      add constraint listings_part_id_fkey foreign key (part_id) references public.parts (id) on delete set null;
  end if;
end $$;

create index if not exists listings_part_id_idx on public.listings (part_id);

-- Link listings that already exist.
update public.listings set part_number = part_number where part_number is not null and part_id is null;

-- ---------------------------------------------------------------
-- Search indexes
-- ---------------------------------------------------------------
alter table public.listings add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(brand, '') || ' ' || coalesce(part_number, '') || ' ' || title || ' ' || coalesce(description, ''))
  ) stored;

create index if not exists listings_search_vector_idx on public.listings using gin (search_vector);
create index if not exists listings_pn_trgm_idx
  on public.listings using gin (part_number_normalized extensions.gin_trgm_ops);

-- ---------------------------------------------------------------
-- search_listings: part # / brand / keyword, optional radius.
-- Ranking: exact part # → part # starts with → close/keyword match.
-- Then nearest (when a location is given) or newest.
-- Runs as the caller, so RLS still limits results to active listings.
-- ---------------------------------------------------------------
drop function if exists public.search_listings(text, double precision, double precision, int, text, text, uuid, int, int);
create function public.search_listings(
  q            text default null,
  lat          double precision default null,
  lng          double precision default null,
  radius_miles int default null,
  p_category   text default null,
  p_condition  text default null,
  p_part_id    uuid default null,
  lim          int default 30,
  off          int default 0
)
returns table (
  id uuid, title text, brand text, part_number text, condition text, category text,
  price_cents int, quantity int, pickup boolean, ships boolean, zip text,
  is_refrigerant boolean, created_at timestamptz, cover_path text,
  zip_lat double precision, zip_lng double precision, miles double precision,
  match_rank int, total bigint
)
language sql
stable
set search_path = ''
as $$
  with params as (
    select
      nullif(trim(q), '') as q,
      upper(regexp_replace(coalesce(q, ''), '[^A-Za-z0-9]', '', 'g')) as qn,
      case when lat is not null and lng is not null
        then extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
      end as here
  ),
  matched as (
    select l.*,
      case
        when p.q is null then 3
        when length(p.qn) >= 3 and l.part_number_normalized = p.qn then 0
        when length(p.qn) >= 3 and l.part_number_normalized like p.qn || '%' then 1
        else 2
      end as match_rank,
      case when p.here is not null and l.location is not null
        then extensions.st_distance(l.location, p.here) / 1609.344
      end as miles
    from public.listings l, params p
    where l.status = 'active'
      and (p_category is null or l.category = p_category)
      and (p_condition is null or l.condition = p_condition)
      and (p_part_id is null or l.part_id = p_part_id)
      and (
        p.q is null
        or (length(p.qn) >= 3 and l.part_number_normalized like '%' || p.qn || '%')
        or (length(p.qn) >= 4 and l.part_number_normalized operator(extensions.%) p.qn)
        or l.search_vector @@ websearch_to_tsquery('english', p.q)
      )
      and (
        radius_miles is null or p.here is null
        or extensions.st_dwithin(l.location, p.here, radius_miles * 1609.344)
      )
  )
  select m.id, m.title, m.brand, m.part_number, m.condition, m.category,
         m.price_cents, m.quantity, m.pickup, m.ships, m.zip,
         m.is_refrigerant, m.created_at,
         (select ph.storage_path from public.listing_photos ph
          where ph.listing_id = m.id order by ph.sort_order limit 1),
         z.lat, z.lng, m.miles, m.match_rank,
         count(*) over ()
  from matched m
  left join public.zip_codes z on z.zip = m.zip
  order by m.match_rank, m.miles asc nulls last, m.created_at desc
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
$$;

grant execute on function public.search_listings(text, double precision, double precision, int, text, text, uuid, int, int)
  to anon, authenticated;

-- Parts with active listings, for the sitemap.
create or replace function public.sitemap_parts()
returns table (slug text, last_modified timestamptz)
language sql
stable
set search_path = ''
as $$
  select p.slug, max(l.updated_at)
  from public.parts p
  join public.listings l on l.part_id = p.id and l.status = 'active'
  group by p.slug;
$$;

grant execute on function public.sitemap_parts() to anon, authenticated;

-- listing_public now also returns the part page slug.
drop function if exists public.listing_public(uuid);
create function public.listing_public(p_id uuid)
returns table (
  id uuid, seller_id uuid, title text, brand text, part_number text, description text,
  category text, trade text, condition text, quantity int, price_cents int, pickup boolean,
  ships boolean, zip text, status text, is_refrigerant boolean, ai_extracted jsonb,
  created_at timestamptz, seller_name text, business_name text, lat double precision,
  lng double precision, part_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.seller_id, l.title, l.brand, l.part_number, l.description, l.category, l.trade,
         l.condition, l.quantity, l.price_cents, l.pickup, l.ships, l.zip, l.status,
         l.is_refrigerant, l.ai_extracted, l.created_at,
         trim(split_part(p.display_name, ' ', 1) || ' ' ||
              coalesce(nullif(left(split_part(p.display_name, ' ', 2), 1), '') || '.', '')),
         b.name, z.lat, z.lng, pt.slug
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  left join public.businesses b on b.id = l.business_id
  left join public.zip_codes z on z.zip = l.zip
  left join public.parts pt on pt.id = l.part_id
  where l.id = p_id and l.status in ('active', 'sold');
$$;

revoke all on function public.listing_public(uuid) from public;
grant execute on function public.listing_public(uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- part_alerts: "Need this part? Get notified when one's listed."
-- Anyone can sign up; nobody can read them from the browser.
-- Phase 4 turns these into Wanted requests.
-- ---------------------------------------------------------------
create table if not exists public.part_alerts (
  id                     uuid primary key default gen_random_uuid(),
  email                  text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  user_id                uuid references auth.users (id) on delete set null,
  part_id                uuid references public.parts (id) on delete set null,
  brand                  text check (length(brand) <= 80),
  part_number            text not null check (length(part_number) between 1 and 80),
  part_number_normalized text generated always as
                           (upper(regexp_replace(part_number, '[^A-Za-z0-9]', '', 'g'))) stored,
  zip                    text check (zip ~ '^\d{5}$'),
  created_at             timestamptz not null default now(),
  notified_at            timestamptz
);

create unique index if not exists part_alerts_email_pn_key
  on public.part_alerts (lower(email), part_number_normalized);

alter table public.part_alerts enable row level security;

drop policy if exists "Anyone can ask to be notified" on public.part_alerts;
create policy "Anyone can ask to be notified"
  on public.part_alerts for insert
  to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

revoke all on public.part_alerts from anon, authenticated;
grant insert (email, user_id, part_id, brand, part_number, zip) on public.part_alerts to anon, authenticated;
