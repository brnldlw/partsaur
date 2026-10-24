-- Trades are now a config list in the app (lib/trades.ts).
-- The database only checks the *format* of trade/category codes, so adding a
-- trade later needs no SQL. Existing HVAC/R codes are unchanged.
-- Run in Supabase → SQL Editor (safe to run more than once).

-- Drop the old fixed-list checks on trade / category columns.
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.listings'::regclass, 'public.profiles'::regclass,
                         'public.wanted_requests'::regclass, 'public.waitlist'::regclass)
      and (pg_get_constraintdef(c.oid) ilike '%trade%' or pg_get_constraintdef(c.oid) ilike '%category%')
      and c.conname not like '%_format_check'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- Format checks: lowercase codes like "hvacr", "breakers_panels".
alter table public.listings drop constraint if exists listings_trade_format_check;
alter table public.listings add constraint listings_trade_format_check check (trade ~ '^[a-z][a-z0-9_]{1,39}$');
alter table public.listings drop constraint if exists listings_category_format_check;
alter table public.listings add constraint listings_category_format_check check (category ~ '^[a-z][a-z0-9_]{1,59}$');
alter table public.profiles drop constraint if exists profiles_trade_format_check;
alter table public.profiles add constraint profiles_trade_format_check check (trade ~ '^[a-z][a-z0-9_]{1,39}$');
alter table public.wanted_requests drop constraint if exists wanted_trade_format_check;
alter table public.wanted_requests add constraint wanted_trade_format_check check (trade ~ '^[a-z][a-z0-9_]{1,39}$');
alter table public.wanted_requests drop constraint if exists wanted_category_format_check;
alter table public.wanted_requests add constraint wanted_category_format_check check (category is null or category ~ '^[a-z][a-z0-9_]{1,59}$');
alter table public.waitlist drop constraint if exists waitlist_trade_format_check;
alter table public.waitlist add constraint waitlist_trade_format_check check (trade ~ '^[a-z][a-z0-9_]{1,39}$');

create index if not exists listings_trade_idx on public.listings (trade);

-- ---------------------------------------------------------------
-- Search: optional trade filter (p_trade), returns trade.
-- ---------------------------------------------------------------
drop function if exists public.search_listings(text, double precision, double precision, int, text, text, uuid, int, int);
drop function if exists public.search_listings(text, double precision, double precision, int, text, text, uuid, int, int, text);
create function public.search_listings(
  q            text default null,
  lat          double precision default null,
  lng          double precision default null,
  radius_miles int default null,
  p_category   text default null,
  p_condition  text default null,
  p_part_id    uuid default null,
  lim          int default 30,
  off          int default 0,
  p_trade      text default null
)
returns table (
  id uuid, title text, brand text, part_number text, condition text, trade text, category text,
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
      and (p_trade is null or l.trade = p_trade)
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
  select m.id, m.title, m.brand, m.part_number, m.condition, m.trade, m.category,
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

grant execute on function public.search_listings(text, double precision, double precision, int, text, text, uuid, int, int, text)
  to anon, authenticated;

-- Wanted board: optional trade filter, returns trade.
drop function if exists public.search_wanted(double precision, double precision, int, text, uuid, int, int);
drop function if exists public.search_wanted(double precision, double precision, int, text, uuid, int, int, text);
create function public.search_wanted(
  lat          double precision default null,
  lng          double precision default null,
  radius_miles int default null,
  q            text default null,
  p_id         uuid default null,
  lim          int default 30,
  off          int default 0,
  p_trade      text default null
)
returns table (
  id uuid, part_number text, brand text, description text, trade text, category text, needed_by date,
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
  select w.id, w.part_number, w.brand, w.description, w.trade, w.category, w.needed_by,
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
    and (p_trade is null or w.trade = p_trade)
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

revoke all on function public.search_wanted(double precision, double precision, int, text, uuid, int, int, text) from public;
grant execute on function public.search_wanted(double precision, double precision, int, text, uuid, int, int, text)
  to anon, authenticated;

-- Likely matches: the same category code can exist in two trades, so match both.
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
     and (w.category is null or (l.category = w.category and l.trade = w.trade))
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
