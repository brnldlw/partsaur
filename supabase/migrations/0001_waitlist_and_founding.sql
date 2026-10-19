-- Phase 0: waitlist + Founding presale
-- Run in Supabase → SQL Editor (safe to run more than once).

-- ---------------------------------------------------------------
-- waitlist: anyone can join; nobody can read it from the browser.
-- ---------------------------------------------------------------
create table if not exists public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  trade         text not null check (trade in ('hvacr', 'electrical', 'plumbing')),
  role          text not null check (role in ('tech', 'shop', 'supply_house')),
  zip           text check (zip ~ '^\d{5}$'),
  plan_interest text check (plan_interest in ('founding_shop', 'founding_supply')),
  created_at    timestamptz not null default now()
);

-- One row per email per plan interest (plain waitlist counts as its own "plan").
create unique index if not exists waitlist_email_plan_key
  on public.waitlist (lower(email), coalesce(plan_interest, ''));

alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);
-- No select/update/delete policies: rows are only readable with the service role
-- (Supabase dashboard / admin pages).

-- ---------------------------------------------------------------
-- founding_signups: written only by the Stripe webhook (service role).
-- ---------------------------------------------------------------
create table if not exists public.founding_signups (
  id                     uuid primary key default gen_random_uuid(),
  email                  text,
  plan                   text not null check (plan in ('founding_shop', 'founding_supply')),
  stripe_customer_id     text,
  stripe_subscription_id text not null unique,
  created_at             timestamptz not null default now()
);

alter table public.founding_signups enable row level security;
-- Intentionally no policies: browser clients (anon/authenticated) get nothing.
-- The webhook uses the service role, which bypasses RLS.

-- ---------------------------------------------------------------
-- Public counter: how many Founding spots are left.
-- Exposes only counts, never emails.
-- ---------------------------------------------------------------
drop function if exists public.founding_spots_left();
create function public.founding_spots_left()
returns table (plan text, cap int, spots_left int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.plan,
         p.cap,
         greatest(p.cap - (select count(*) from public.founding_signups s where s.plan = p.plan), 0)::int
  from (values ('founding_shop', 50), ('founding_supply', 10)) as p(plan, cap);
$$;

revoke all on function public.founding_spots_left() from public;
grant execute on function public.founding_spots_left() to anon, authenticated, service_role;
