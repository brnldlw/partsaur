-- Phase 6: subscriptions, Founding spot holds, storefronts
-- Run in Supabase → SQL Editor (safe to run more than once).

-- ---------------------------------------------------------------
-- Subscription details on businesses (written by the Stripe webhook only;
-- users already can't write plan / stripe_* columns).
-- ---------------------------------------------------------------
alter table public.businesses add column if not exists stripe_subscription_id text;
alter table public.businesses add column if not exists subscription_status text;
alter table public.businesses add column if not exists current_period_end timestamptz;
alter table public.businesses add column if not exists cancel_at_period_end boolean not null default false;
alter table public.businesses add column if not exists branches int not null default 1 check (branches between 1 and 500);
alter table public.businesses add column if not exists slug text;
create unique index if not exists businesses_slug_key on public.businesses (slug);
create unique index if not exists businesses_stripe_subscription_key on public.businesses (stripe_subscription_id);

-- Founding purchases: track whether the subscription is still active.
alter table public.founding_signups add column if not exists status text not null default 'active'
  check (status in ('active', 'canceled'));
alter table public.founding_signups add column if not exists business_id uuid references public.businesses (id) on delete set null;

-- ---------------------------------------------------------------
-- Founding spot holds: a spot is held for 30 min while someone is in checkout.
-- ---------------------------------------------------------------
create table if not exists public.founding_holds (
  id                uuid primary key default gen_random_uuid(),
  plan              text not null check (plan in ('founding_shop', 'founding_supply')),
  stripe_session_id text unique,
  expires_at        timestamptz not null,
  created_at        timestamptz not null default now()
);
alter table public.founding_holds enable row level security;
-- No policies: server only.

drop function if exists public.founding_spots_left();
create function public.founding_spots_left()
returns table (plan text, cap int, spots_left int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.plan, p.cap,
         greatest(p.cap
           - (select count(*) from public.founding_signups s where s.plan = p.plan)
           - (select count(*) from public.founding_holds h where h.plan = p.plan and h.expires_at > now()),
         0)::int
  from (values ('founding_shop', 50), ('founding_supply', 10)) as p(plan, cap);
$$;
revoke all on function public.founding_spots_left() from public;
grant execute on function public.founding_spots_left() to anon, authenticated, service_role;

-- Atomically hold a spot (one at a time per plan, so the last spot can't be sold twice).
create or replace function public.reserve_founding_spot(p_plan text, p_minutes int default 30)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  hold_id uuid;
  cap int := case p_plan when 'founding_shop' then 50 when 'founding_supply' then 10 end;
begin
  if cap is null then return null; end if;
  perform pg_advisory_xact_lock(hashtext('founding:' || p_plan));
  delete from public.founding_holds where expires_at < now() - interval '1 day';
  if (select count(*) from public.founding_signups where plan = p_plan)
     + (select count(*) from public.founding_holds where plan = p_plan and expires_at > now()) >= cap then
    return null;
  end if;
  insert into public.founding_holds (plan, expires_at)
  values (p_plan, now() + make_interval(mins => p_minutes))
  returning id into hold_id;
  return hold_id;
end;
$$;
revoke all on function public.reserve_founding_spot(text, int) from public, anon, authenticated;
grant execute on function public.reserve_founding_spot(text, int) to service_role;

-- ---------------------------------------------------------------
-- Presale → business linking now also copies the Stripe ids, and only
-- applies subscriptions that are still active.
-- ---------------------------------------------------------------
create or replace function public.apply_founding_plan_to_new_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fs record;
begin
  select s.id, s.plan, s.stripe_customer_id, s.stripe_subscription_id into fs
  from public.founding_signups s
  join auth.users u on lower(u.email) = lower(s.email)
  where u.id = new.owner_id and s.status = 'active' and s.business_id is null
  order by s.created_at desc
  limit 1;
  if found then
    new.plan := fs.plan;
    new.stripe_customer_id := fs.stripe_customer_id;
    new.stripe_subscription_id := fs.stripe_subscription_id;
    new.subscription_status := 'active';
  else
    new.plan := 'free';
  end if;
  return new;
end;
$$;

create or replace function public.apply_founding_signup_to_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- In-app purchases set business_id themselves; this is for presale buyers.
  if new.business_id is null and new.status = 'active' then
    update public.businesses b
    set plan = new.plan,
        stripe_customer_id = coalesce(b.stripe_customer_id, new.stripe_customer_id),
        stripe_subscription_id = coalesce(b.stripe_subscription_id, new.stripe_subscription_id),
        subscription_status = 'active'
    from auth.users u
    where u.id = b.owner_id and lower(u.email) = lower(new.email) and b.plan = 'free';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Storefront slugs: "Ludlow Mechanical" → "ludlow-mechanical"
-- ---------------------------------------------------------------
create or replace function public.businesses_set_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := coalesce(nullif(trim(both '-' from lower(regexp_replace(new.name, '[^A-Za-z0-9]+', '-', 'g'))), ''), 'shop');
  try_slug text := base;
  n int := 1;
begin
  if tg_op = 'UPDATE' and new.name = old.name and new.slug is not null then
    return new;
  end if;
  while exists (select 1 from public.businesses b where b.slug = try_slug and b.id <> new.id) loop
    n := n + 1;
    try_slug := base || '-' || n;
  end loop;
  new.slug := try_slug;
  return new;
end;
$$;

drop trigger if exists businesses_set_slug on public.businesses;
create trigger businesses_set_slug
  before insert or update of name on public.businesses
  for each row execute function public.businesses_set_slug();

update public.businesses set name = name where slug is null;

-- Public storefront header (paid plans only; no contact info).
create or replace function public.storefront_public(p_slug text)
returns table (id uuid, name text, type text, zip text, slug text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.name, b.type, b.zip, b.slug, b.created_at
  from public.businesses b
  where b.slug = p_slug and b.plan <> 'free';
$$;
revoke all on function public.storefront_public(text) from public;
grant execute on function public.storefront_public(text) to anon, authenticated;

-- listing_public: add the storefront link for paid sellers.
drop function if exists public.listing_public(uuid);
create function public.listing_public(p_id uuid)
returns table (
  id uuid, seller_id uuid, title text, brand text, part_number text, description text,
  category text, trade text, condition text, quantity int, price_cents int, pickup boolean,
  ships boolean, zip text, status text, is_refrigerant boolean, ai_extracted jsonb,
  created_at timestamptz, seller_name text, business_name text, lat double precision,
  lng double precision, part_slug text, storefront_slug text
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
         case when b.plan <> 'free' then b.slug end
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  left join public.businesses b on b.id = l.business_id
  left join public.zip_codes z on z.zip = l.zip
  left join public.parts pt on pt.id = l.part_id
  where l.id = p_id and l.status in ('active', 'sold');
$$;
revoke all on function public.listing_public(uuid) from public;
grant execute on function public.listing_public(uuid) to anon, authenticated;

-- Reserved-spot emails: remember who we've told.
alter table public.waitlist add column if not exists checkout_emailed_at timestamptz;

revoke all on function public.businesses_set_slug() from public, anon, authenticated;
