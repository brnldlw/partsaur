-- Phase 2: listings, photos, EPA 608 certifications
-- Run in Supabase → SQL Editor (safe to run more than once).

-- ---------------------------------------------------------------
-- Seller choice: show phone number to signed-in buyers.
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists show_phone boolean not null default false;
grant insert (show_phone), update (show_phone) on public.profiles to authenticated;

-- ---------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------
create table if not exists public.listings (
  id                     uuid primary key default gen_random_uuid(),
  seller_id              uuid not null references public.profiles (id) on delete cascade,
  business_id            uuid references public.businesses (id) on delete set null,
  part_id                uuid,  -- linked to parts in phase 3
  title                  text not null check (length(title) between 1 and 140),
  brand                  text check (length(brand) <= 80),
  part_number            text check (length(part_number) <= 80),
  part_number_normalized text generated always as
                           (upper(regexp_replace(coalesce(part_number, ''), '[^A-Za-z0-9]', '', 'g'))) stored,
  description            text check (length(description) <= 4000),
  category               text not null check (category in (
                           'compressors', 'motors_fans', 'controls_boards', 'thermostats_sensors',
                           'pressure_safety', 'valves', 'contactors_relays', 'capacitors', 'defrost',
                           'coils_heat_exchangers', 'filter_driers_line', 'refrigerant', 'gas_ignition',
                           'drives_vfds', 'economizers_actuators', 'walkin_reachin', 'ice_machine',
                           'belts_pulleys', 'tools', 'other')),
  trade                  text not null default 'hvacr' check (trade in ('hvacr', 'electrical', 'plumbing')),
  condition              text not null check (condition in
                           ('new_in_box', 'new_open_box', 'new_old_stock', 'used_working', 'for_parts')),
  quantity               int not null default 1 check (quantity between 1 and 9999),
  price_cents            int check (price_cents between 0 and 100000000),  -- null = make offer
  pickup                 boolean not null default true,
  ships                  boolean not null default false,
  zip                    text not null references public.zip_codes (zip),
  location               extensions.geography(Point, 4326),
  status                 text not null default 'active' check (status in ('draft', 'active', 'sold', 'removed')),
  is_refrigerant         boolean not null default false,
  ai_extracted           jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (pickup or ships)
);

create index if not exists listings_seller_id_idx on public.listings (seller_id);
create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_part_number_normalized_idx on public.listings (part_number_normalized);
create index if not exists listings_location_idx on public.listings using gist (location);

alter table public.listings enable row level security;

drop policy if exists "Active and sold listings are public" on public.listings;
create policy "Active and sold listings are public"
  on public.listings for select
  to anon, authenticated
  using (status in ('active', 'sold'));

drop policy if exists "Sellers can see all their listings" on public.listings;
create policy "Sellers can see all their listings"
  on public.listings for select
  to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists "Sellers can create listings" on public.listings;
create policy "Sellers can create listings"
  on public.listings for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and (business_id is null or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = (select auth.uid())
    ))
  );

drop policy if exists "Sellers can update their listings" on public.listings;
create policy "Sellers can update their listings"
  on public.listings for update
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (
    seller_id = (select auth.uid())
    and (business_id is null or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = (select auth.uid())
    ))
  );
-- No delete policy: sellers mark listings 'removed' instead.

revoke all on public.listings from anon;
grant select on public.listings to anon;
revoke insert, update on public.listings from authenticated;
grant insert (seller_id, business_id, title, brand, part_number, description, category, trade,
              condition, quantity, price_cents, pickup, ships, zip, status, ai_extracted)
  on public.listings to authenticated;
grant update (business_id, title, brand, part_number, description, category, trade,
              condition, quantity, price_cents, pickup, ships, zip, status)
  on public.listings to authenticated;

drop trigger if exists listings_set_location on public.listings;
create trigger listings_set_location
  before insert or update of zip on public.listings
  for each row execute function public.set_location_from_zip();

-- updated_at + refrigerant flag (server-decided, not seller-decided).
create or replace function public.listings_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- Category, or a title like "R-22 30 lb cylinder". Titles only: descriptions of
  -- parts routinely mention the refrigerant they're rated for.
  new.is_refrigerant :=
    new.category = 'refrigerant'
    or (
      new.title ~* '\mR-?\d{2,4}[A-Z]?\M'
      and new.title ~* '(refrigerant|cylinder|jug|\d+\s*(lb|lbs|pound)s?\M|recovery tank|virgin|reclaimed)'
    );
  return new;
end;
$$;

drop trigger if exists listings_before_write on public.listings;
create trigger listings_before_write
  before insert or update on public.listings
  for each row execute function public.listings_before_write();

-- Free plan: max 10 active listings. Paid plans: unlimited.
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

drop trigger if exists listings_enforce_limit on public.listings;
create trigger listings_enforce_limit
  before insert or update of status on public.listings
  for each row execute function public.enforce_listing_limit();

-- ---------------------------------------------------------------
-- listing_photos
-- ---------------------------------------------------------------
create table if not exists public.listing_photos (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  sort_order   int not null default 0
);

create index if not exists listing_photos_listing_id_idx on public.listing_photos (listing_id, sort_order);

alter table public.listing_photos enable row level security;

-- Visible whenever the listing itself is visible to the viewer.
drop policy if exists "Photos follow listing visibility" on public.listing_photos;
create policy "Photos follow listing visibility"
  on public.listing_photos for select
  to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));

drop policy if exists "Sellers manage their listing photos" on public.listing_photos;
create policy "Sellers manage their listing photos"
  on public.listing_photos for all
  to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid())))
  with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid()))
    and storage_path like (select auth.uid())::text || '/%'
  );

revoke all on public.listing_photos from anon;
grant select on public.listing_photos to anon;

-- ---------------------------------------------------------------
-- certifications (EPA 608)
-- ---------------------------------------------------------------
create table if not exists public.certifications (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  type         text not null default 'epa608' check (type in ('epa608')),
  cert_number  text check (length(cert_number) <= 40),
  storage_path text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

create index if not exists certifications_profile_id_idx on public.certifications (profile_id);

alter table public.certifications enable row level security;

drop policy if exists "Users can see their certifications" on public.certifications;
create policy "Users can see their certifications"
  on public.certifications for select
  to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Users can submit certifications" on public.certifications;
create policy "Users can submit certifications"
  on public.certifications for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and storage_path like (select auth.uid())::text || '/%'
  );

-- status/reviewed_at are set by an admin only.
revoke all on public.certifications from anon;
revoke insert, update, delete on public.certifications from authenticated;
grant insert (profile_id, type, cert_number, storage_path) on public.certifications to authenticated;

-- Approving/rejecting a cert updates the profile's verified flag.
create or replace function public.certification_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    update public.profiles p
    set epa608_verified = exists (
      select 1 from public.certifications c
      where c.profile_id = new.profile_id and c.type = 'epa608'
        and (case when c.id = new.id then new.status else c.status end) = 'approved'
    )
    where p.id = new.profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists certifications_status_changed on public.certifications;
create trigger certifications_status_changed
  before update of status on public.certifications
  for each row execute function public.certification_status_changed();

-- ---------------------------------------------------------------
-- AI photo reads: per-user daily cap (written by the server only).
-- ---------------------------------------------------------------
create table if not exists public.ai_extractions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_extractions_user_created_idx on public.ai_extractions (user_id, created_at);
alter table public.ai_extractions enable row level security;
-- No policies: service role only.

-- ---------------------------------------------------------------
-- Public listing view: listing + seller's public name + zip centroid.
-- Never exposes seller email/phone.
-- ---------------------------------------------------------------
create or replace function public.listing_public(p_id uuid)
returns table (
  id uuid, seller_id uuid, title text, brand text, part_number text, description text,
  category text, trade text, condition text, quantity int, price_cents int, pickup boolean,
  ships boolean, zip text, status text, is_refrigerant boolean, ai_extracted jsonb,
  created_at timestamptz, seller_name text, business_name text, lat double precision,
  lng double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.seller_id, l.title, l.brand, l.part_number, l.description, l.category, l.trade,
         l.condition, l.quantity, l.price_cents, l.pickup, l.ships, l.zip, l.status,
         l.is_refrigerant, l.ai_extracted, l.created_at,
         -- "Brian L." style: first name + last initial
         trim(split_part(p.display_name, ' ', 1) || ' ' ||
              coalesce(nullif(left(split_part(p.display_name, ' ', 2), 1), '') || '.', '')),
         b.name, z.lat, z.lng
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  left join public.businesses b on b.id = l.business_id
  left join public.zip_codes z on z.zip = l.zip
  where l.id = p_id and l.status in ('active', 'sold');
$$;

revoke all on function public.listing_public(uuid) from public;
grant execute on function public.listing_public(uuid) to anon, authenticated;

-- Seller contact details for a signed-in buyer. Refrigerant listings require
-- an approved EPA 608 cert.
create or replace function public.listing_contact(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  buyer uuid := auth.uid();
  l record;
begin
  if buyer is null then
    return jsonb_build_object('error', 'sign_in');
  end if;
  if not exists (select 1 from public.profiles where id = buyer) then
    return jsonb_build_object('error', 'onboarding');
  end if;

  select li.is_refrigerant, li.seller_id, p.display_name, p.phone, p.show_phone, u.email
    into l
  from public.listings li
  join public.profiles p on p.id = li.seller_id
  join auth.users u on u.id = li.seller_id
  where li.id = p_id and li.status = 'active';

  if not found then
    return jsonb_build_object('error', 'not_available');
  end if;

  if l.is_refrigerant and l.seller_id <> buyer and not exists (
    select 1 from public.profiles where id = buyer and epa608_verified
  ) then
    return jsonb_build_object('error', 'epa608_required');
  end if;

  return jsonb_build_object(
    'name', l.display_name,
    'email', l.email,
    'phone', case when l.show_phone then l.phone else null end
  );
end;
$$;

revoke all on function public.listing_contact(uuid) from public, anon;
grant execute on function public.listing_contact(uuid) to authenticated;

revoke all on function public.listings_before_write() from public, anon, authenticated;
revoke all on function public.enforce_listing_limit() from public, anon, authenticated;
revoke all on function public.certification_status_changed() from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certifications', 'certifications', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Listing photos: anyone can view (public bucket); users upload/delete only in their own folder.
drop policy if exists "Users upload listing photos to own folder" on storage.objects;
create policy "Users upload listing photos to own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own listing photos" on storage.objects;
create policy "Users delete own listing photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Certifications: private. Owner can upload and view their own; admin uses the dashboard.
drop policy if exists "Users upload own certifications" on storage.objects;
create policy "Users upload own certifications"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'certifications' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users view own certifications" on storage.objects;
create policy "Users view own certifications"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'certifications' and (storage.foldername(name))[1] = (select auth.uid())::text);
