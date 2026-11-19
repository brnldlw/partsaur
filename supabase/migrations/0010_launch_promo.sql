-- Launch promo: Free Launch Pass, Founding Seller badges, referrals, launch stats.
-- Run in Supabase → SQL Editor (safe to run more than once).

-- ---------------------------------------------------------------
-- Free Launch Pass: every account gets paid seller features
-- (unlimited listings, bulk upload, storefront) until the end of
-- March 31, 2027, US Eastern. Keep in sync with lib/launch.ts.
-- ---------------------------------------------------------------
create or replace function public.launch_pass_active()
returns boolean
language sql
stable
set search_path = ''
as $$
  select now() < timestamptz '2027-04-01 00:00:00 America/New_York';
$$;
grant execute on function public.launch_pass_active() to anon, authenticated, service_role;

-- Free plan: max 10 active listings — except during the Launch Pass.
-- After it ends, existing listings stay up; only new ones are blocked.
create or replace function public.enforce_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seller_plan text;
  active_count int;
begin
  if new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active') then
    return new;
  end if;
  if public.launch_pass_active() then
    return new;
  end if;

  select coalesce(b.plan, 'free') into seller_plan
  from public.profiles p
  left join public.businesses b on b.id = p.business_id
  where p.id = new.seller_id;

  if coalesce(seller_plan, 'free') = 'free' then
    select count(*) into active_count
    from public.listings l
    where l.seller_id = new.seller_id and l.status = 'active' and l.id <> new.id;

    if active_count >= 10 then
      raise exception 'LISTING_LIMIT: free accounts can have 10 active listings'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- New profile columns (none are user-writable: profile insert/update
-- grants are per-column and don't include these).
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles (id) on delete set null;
alter table public.profiles add column if not exists first_listed_at timestamptz;
alter table public.profiles add column if not exists founding_seller_number int
  check (founding_seller_number between 1 and 100);

create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);
create unique index if not exists profiles_founding_seller_number_key on public.profiles (founding_seller_number);
create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

-- ---------------------------------------------------------------
-- Referral codes: 6 characters, no look-alikes (0/O, 1/I/L).
-- ---------------------------------------------------------------
create or replace function public.new_referral_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.profiles_set_referral_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.new_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_referral_code on public.profiles;
create trigger profiles_set_referral_code
  before insert on public.profiles
  for each row execute function public.profiles_set_referral_code();

-- Backfill codes for existing accounts.
do $$
declare r record;
begin
  for r in select id from public.profiles where referral_code is null loop
    update public.profiles set referral_code = public.new_referral_code() where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column referral_code set not null;

-- ---------------------------------------------------------------
-- First listing goes live → Founding Seller badge (first 100) and
-- referral credit (counted from referred_by + first_listed_at).
-- ---------------------------------------------------------------
create or replace function public.listings_first_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken int;
begin
  if new.status <> 'active' then
    return new;
  end if;

  update public.profiles set first_listed_at = now()
  where id = new.seller_id and first_listed_at is null;
  if not found then
    return new;  -- not their first listing
  end if;

  -- One at a time, so badge #100 can't be handed out twice.
  perform pg_advisory_xact_lock(hashtext('founding_seller_badge'));
  select count(*) into taken from public.profiles where founding_seller_number is not null;
  if taken < 100 then
    update public.profiles set founding_seller_number = taken + 1
    where id = new.seller_id and founding_seller_number is null;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_first_active on public.listings;
create trigger listings_first_active
  after insert or update of status on public.listings
  for each row execute function public.listings_first_active();

-- Backfill: anyone who has already posted (not just drafted) a listing.
update public.profiles p
set first_listed_at = f.first_at
from (
  select seller_id, min(created_at) as first_at
  from public.listings
  where status <> 'draft'
  group by seller_id
) f
where f.seller_id = p.id and p.first_listed_at is null;

-- Badges for existing sellers, in the order they first listed. Only runs
-- if no badges have been given yet (so re-running is safe).
update public.profiles p
set founding_seller_number = ranked.n
from (
  select id, row_number() over (order by first_listed_at, id) as n
  from public.profiles
  where first_listed_at is not null
) ranked
where ranked.id = p.id
  and ranked.n <= 100
  and not exists (select 1 from public.profiles where founding_seller_number is not null);

-- Public counter for the home page.
create or replace function public.founding_seller_badges_left()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(100 - (select count(*) from public.profiles where founding_seller_number is not null), 0)::int;
$$;
revoke all on function public.founding_seller_badges_left() from public;
grant execute on function public.founding_seller_badges_left() to anon, authenticated, service_role;

-- Signed-in user's referral numbers.
create or replace function public.my_referral_stats()
returns table (signed_up int, sellers int)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int,
         count(*) filter (where p.first_listed_at is not null)::int
  from public.profiles p
  where p.referred_by = (select auth.uid());
$$;
revoke all on function public.my_referral_stats() from public, anon;
grant execute on function public.my_referral_stats() to authenticated;

-- ---------------------------------------------------------------
-- Storefronts: open to every business during the Launch Pass.
-- Both public functions now also say whether the seller is a Founding Seller.
-- ---------------------------------------------------------------
drop function if exists public.storefront_public(text);
create function public.storefront_public(p_slug text)
returns table (id uuid, name text, type text, zip text, slug text, created_at timestamptz, founding_seller_number int)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.type, b.zip, b.slug, b.created_at, owner.founding_seller_number
  from public.businesses b
  left join public.profiles owner on owner.id = b.owner_id
  where b.slug = p_slug and (b.plan <> 'free' or public.launch_pass_active());
$$;
revoke all on function public.storefront_public(text) from public;
grant execute on function public.storefront_public(text) to anon, authenticated;

drop function if exists public.listing_public(uuid);
create function public.listing_public(p_id uuid)
returns table (
  id uuid, seller_id uuid, title text, brand text, part_number text, description text,
  category text, trade text, condition text, quantity int, price_cents int, pickup boolean,
  ships boolean, zip text, status text, is_refrigerant boolean, ai_extracted jsonb,
  created_at timestamptz, seller_name text, business_name text, lat double precision,
  lng double precision, part_slug text, storefront_slug text, founding_seller_number int
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
         b.name, z.lat, z.lng, pt.slug,
         case when b.plan <> 'free' or public.launch_pass_active() then b.slug end,
         p.founding_seller_number
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
-- Admin launch dashboard (server only).
-- ---------------------------------------------------------------
create or replace function public.admin_launch_stats(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select (generate_series(
      (now() at time zone 'America/New_York')::date - (p_days - 1),
      (now() at time zone 'America/New_York')::date,
      interval '1 day'))::date as day
  )
  select jsonb_build_object(
    'signups_per_day', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'n',
        (select count(*) from public.profiles p where (p.created_at at time zone 'America/New_York')::date = d.day)) order by d.day)
      from days d),
    'listings_per_day', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'n',
        (select count(*) from public.listings l where l.status <> 'draft' and (l.created_at at time zone 'America/New_York')::date = d.day)) order by d.day)
      from days d),
    'listings_by_trade', (
      select coalesce(jsonb_agg(jsonb_build_object('trade', t.trade, 'n', t.n) order by t.n desc), '[]'::jsonb)
      from (select trade, count(*) as n from public.listings where status = 'active' group by trade) t),
    'top_referrers', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'name', r.display_name, 'email', r.email, 'code', r.referral_code,
          'signed_up', r.signed_up, 'sellers', r.sellers) order by r.sellers desc, r.signed_up desc), '[]'::jsonb)
      from (
        select ref.id, ref.display_name, u.email, ref.referral_code,
               count(*) as signed_up,
               count(*) filter (where p.first_listed_at is not null) as sellers
        from public.profiles p
        join public.profiles ref on ref.id = p.referred_by
        left join auth.users u on u.id = ref.id
        group by ref.id, ref.display_name, u.email, ref.referral_code
        order by sellers desc, signed_up desc
        limit 25
      ) r),
    'badges_left', public.founding_seller_badges_left(),
    'total_profiles', (select count(*) from public.profiles),
    'total_sellers', (select count(*) from public.profiles where first_listed_at is not null),
    'referred_signups', (select count(*) from public.profiles where referred_by is not null)
  );
$$;
revoke all on function public.admin_launch_stats(int) from public, anon, authenticated;
grant execute on function public.admin_launch_stats(int) to service_role;

-- Sellers who'll be over the free limit when the Launch Pass ends:
-- more than 10 active listings and no active paid plan.
drop function if exists public.launch_pass_over_limit_sellers();
create function public.launch_pass_over_limit_sellers()
returns table (user_id uuid, email text, display_name text, role text, active_listings int, has_business boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.display_name, p.role, count(l.id)::int, (b.id is not null)
  from public.profiles p
  join auth.users u on u.id = p.id
  join public.listings l on l.seller_id = p.id and l.status = 'active'
  left join public.businesses b on b.id = p.business_id
  where coalesce(b.plan, 'free') = 'free'
  group by p.id, u.email, p.display_name, p.role, b.id
  having count(l.id) > 10
  order by count(l.id) desc;
$$;
revoke all on function public.launch_pass_over_limit_sellers() from public, anon, authenticated;
grant execute on function public.launch_pass_over_limit_sellers() to service_role;

-- Trigger functions aren't meant to be called directly.
revoke all on function public.profiles_set_referral_code() from public, anon, authenticated;
revoke all on function public.listings_first_active() from public, anon, authenticated;
revoke all on function public.new_referral_code() from public, anon, authenticated;
