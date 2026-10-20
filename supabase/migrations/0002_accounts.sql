-- Phase 1: accounts — zip codes, profiles, businesses
-- Run in Supabase → SQL Editor (safe to run more than once).

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------
-- zip_codes: US Census ZCTA centroids (public domain). Public read.
-- Loaded by scripts/load-zip-codes.mjs.
-- ---------------------------------------------------------------
create table if not exists public.zip_codes (
  zip      text primary key check (zip ~ '^\d{5}$'),
  lat      double precision not null,
  lng      double precision not null,
  location extensions.geography(Point, 4326) not null
);

alter table public.zip_codes enable row level security;

drop policy if exists "Zip codes are public" on public.zip_codes;
create policy "Zip codes are public"
  on public.zip_codes for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------
-- businesses: shops and supply houses. Owner-only for now.
-- ---------------------------------------------------------------
create table if not exists public.businesses (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(name) between 1 and 120),
  type               text not null check (type in ('contractor', 'supply_house', 'surplus')),
  owner_id           uuid not null references auth.users (id) on delete cascade,
  address            text check (length(address) <= 200),
  zip                text references public.zip_codes (zip),
  location           extensions.geography(Point, 4326),
  plan               text not null default 'free'
                     check (plan in ('free', 'founding_shop', 'shop_pro', 'founding_supply', 'supply_house')),
  stripe_customer_id text,
  created_at         timestamptz not null default now()
);

create index if not exists businesses_owner_id_idx on public.businesses (owner_id);
create index if not exists businesses_location_idx on public.businesses using gist (location);

alter table public.businesses enable row level security;

drop policy if exists "Owners can read their business" on public.businesses;
create policy "Owners can read their business"
  on public.businesses for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Users can create their own business" on public.businesses;
create policy "Users can create their own business"
  on public.businesses for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners can update their business" on public.businesses;
create policy "Owners can update their business"
  on public.businesses for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Users may only write these columns. plan, stripe_customer_id and location
-- are set by the server (webhook / triggers), never the browser.
revoke all on public.businesses from anon;
revoke insert, update on public.businesses from authenticated;
grant insert (owner_id, name, type, address, zip) on public.businesses to authenticated;
grant update (name, type, address, zip) on public.businesses to authenticated;

-- ---------------------------------------------------------------
-- profiles: one per auth user.
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null check (length(display_name) between 1 and 80),
  phone           text check (phone ~ '^\d{10}$'),
  trade           text not null check (trade in ('hvacr', 'electrical', 'plumbing')),
  role            text not null check (role in ('tech', 'shop', 'supply_house')),
  business_id     uuid references public.businesses (id) on delete set null,
  zip             text not null references public.zip_codes (zip),
  location        extensions.geography(Point, 4326),
  epa608_verified boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists profiles_location_idx on public.profiles using gist (location);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
  on public.profiles for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and (business_id is null or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = (select auth.uid())
    ))
  );

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (business_id is null or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = (select auth.uid())
    ))
  );

-- epa608_verified and location are never user-writable.
revoke all on public.profiles from anon;
revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name, phone, trade, role, business_id, zip) on public.profiles to authenticated;
grant update (display_name, phone, trade, role, business_id, zip) on public.profiles to authenticated;

-- ---------------------------------------------------------------
-- Location comes from the zip code, computed in the database.
-- ---------------------------------------------------------------
create or replace function public.set_location_from_zip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.location := (select z.location from public.zip_codes z where z.zip = new.zip);
  return new;
end;
$$;

drop trigger if exists profiles_set_location on public.profiles;
create trigger profiles_set_location
  before insert or update of zip on public.profiles
  for each row execute function public.set_location_from_zip();

drop trigger if exists businesses_set_location on public.businesses;
create trigger businesses_set_location
  before insert or update of zip on public.businesses
  for each row execute function public.set_location_from_zip();

-- ---------------------------------------------------------------
-- Founding presale → business plan, whichever happens first.
-- ---------------------------------------------------------------

-- A new business picks up a Founding plan bought earlier with the owner's email.
create or replace function public.apply_founding_plan_to_new_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select fs.plan into new.plan
  from public.founding_signups fs
  join auth.users u on lower(u.email) = lower(fs.email)
  where u.id = new.owner_id
  order by fs.created_at desc
  limit 1;
  new.plan := coalesce(new.plan, 'free');
  return new;
end;
$$;

drop trigger if exists businesses_apply_founding_plan on public.businesses;
create trigger businesses_apply_founding_plan
  before insert on public.businesses
  for each row execute function public.apply_founding_plan_to_new_business();

-- A Founding purchase upgrades an existing free business with that owner email.
create or replace function public.apply_founding_signup_to_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.businesses b
  set plan = new.plan
  from auth.users u
  where u.id = b.owner_id
    and lower(u.email) = lower(new.email)
    and b.plan = 'free';
  return new;
end;
$$;

drop trigger if exists founding_signups_apply_to_business on public.founding_signups;
create trigger founding_signups_apply_to_business
  after insert on public.founding_signups
  for each row execute function public.apply_founding_signup_to_business();

-- Trigger functions aren't meant to be called directly.
revoke all on function public.set_location_from_zip() from public, anon, authenticated;
revoke all on function public.apply_founding_plan_to_new_business() from public, anon, authenticated;
revoke all on function public.apply_founding_signup_to_business() from public, anon, authenticated;
