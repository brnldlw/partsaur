-- Phase 5: in-app messages, reports, moderation
-- Run in Supabase → SQL Editor (safe to run more than once).

-- ---------------------------------------------------------------
-- conversations: listing threads + bookkeeping
-- ---------------------------------------------------------------
alter table public.conversations add column if not exists last_message_at timestamptz;
alter table public.conversations add column if not exists buyer_notified_at timestamptz;
alter table public.conversations add column if not exists seller_notified_at timestamptz;

-- One thread per buyer per listing.
create unique index if not exists conversations_listing_buyer_key
  on public.conversations (listing_id, buyer_id);

-- ---------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (length(trim(body)) between 1 and 4000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages (conversation_id) where read_at is null;

alter table public.messages enable row level security;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and (select auth.uid()) in (c.buyer_id, c.seller_id)
  );
$$;

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages"
  on public.messages for insert
  to authenticated
  with check (sender_id = (select auth.uid()) and public.is_conversation_participant(conversation_id));

drop policy if exists "Recipients mark messages read" on public.messages;
create policy "Recipients mark messages read"
  on public.messages for update
  to authenticated
  using (sender_id <> (select auth.uid()) and public.is_conversation_participant(conversation_id))
  with check (sender_id <> (select auth.uid()) and public.is_conversation_participant(conversation_id));

revoke all on public.messages from anon;
revoke insert, update, delete on public.messages from authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Keep the thread's "last activity" current.
create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_after_insert();

-- Live updates in the browser (Supabase Realtime respects the RLS above).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------------------------------------------------------------
-- Start (or reopen) a thread about a listing. Enforces EPA 608 for refrigerant.
-- ---------------------------------------------------------------
create or replace function public.start_listing_conversation(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := auth.uid();
  l record;
  conv_id uuid;
begin
  if buyer is null then return jsonb_build_object('error', 'sign_in'); end if;
  if not exists (select 1 from public.profiles where id = buyer) then
    return jsonb_build_object('error', 'onboarding');
  end if;

  select li.id, li.seller_id, li.is_refrigerant into l
  from public.listings li where li.id = p_listing_id and li.status = 'active';
  if not found then return jsonb_build_object('error', 'not_available'); end if;
  if l.seller_id = buyer then return jsonb_build_object('error', 'own_listing'); end if;
  if l.is_refrigerant and not exists (select 1 from public.profiles where id = buyer and epa608_verified) then
    return jsonb_build_object('error', 'epa608_required');
  end if;

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (l.id, buyer, l.seller_id)
  on conflict (listing_id, buyer_id) do nothing
  returning id into conv_id;

  if conv_id is null then
    select c.id into conv_id from public.conversations c where c.listing_id = l.id and c.buyer_id = buyer;
  end if;
  return jsonb_build_object('id', conv_id);
end;
$$;

revoke all on function public.start_listing_conversation(uuid) from public, anon;
grant execute on function public.start_listing_conversation(uuid) to authenticated;

-- Inbox rows for the signed-in user (other person's public name only).
drop function if exists public.my_conversations(uuid);
create function public.my_conversations(p_id uuid default null)
returns table (
  id uuid, listing_id uuid, listing_title text, cover_path text, wanted_id uuid,
  wanted_part_number text, wanted_brand text, wanted_description text,
  other_id uuid, other_name text, i_am text, last_message_at timestamptz,
  last_body text, last_sender_id uuid, unread int
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.listing_id, l.title,
         (select ph.storage_path from public.listing_photos ph where ph.listing_id = l.id order by ph.sort_order limit 1),
         c.wanted_id, w.part_number, w.brand, w.description,
         o.id,
         trim(split_part(o.display_name, ' ', 1) || ' ' ||
              coalesce(nullif(left(split_part(o.display_name, ' ', 2), 1), '') || '.', '')),
         case when c.buyer_id = (select auth.uid()) then 'buyer' else 'seller' end,
         coalesce(c.last_message_at, c.created_at),
         lm.body, lm.sender_id,
         (select count(*)::int from public.messages m
          where m.conversation_id = c.id and m.sender_id <> (select auth.uid()) and m.read_at is null)
  from public.conversations c
  join public.profiles o
    on o.id = case when c.buyer_id = (select auth.uid()) then c.seller_id else c.buyer_id end
  left join public.listings l on l.id = c.listing_id
  left join public.wanted_requests w on w.id = c.wanted_id
  left join lateral (
    select m.body, m.sender_id from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where (select auth.uid()) in (c.buyer_id, c.seller_id)
    and (p_id is null or c.id = p_id)
  order by coalesce(c.last_message_at, c.created_at) desc
  limit 200;
$$;

revoke all on function public.my_conversations(uuid) from public, anon;
grant execute on function public.my_conversations(uuid) to authenticated;

create or replace function public.my_unread_count()
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int from public.messages m
  where m.sender_id <> (select auth.uid()) and m.read_at is null;
$$;

grant execute on function public.my_unread_count() to authenticated;

-- ---------------------------------------------------------------
-- listing_contact: phone only now (email stays private; buyers message instead).
-- ---------------------------------------------------------------
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
  if buyer is null then return jsonb_build_object('error', 'sign_in'); end if;
  if not exists (select 1 from public.profiles where id = buyer) then
    return jsonb_build_object('error', 'onboarding');
  end if;

  select li.is_refrigerant, li.seller_id, p.display_name, p.phone, p.show_phone into l
  from public.listings li
  join public.profiles p on p.id = li.seller_id
  where li.id = p_id and li.status = 'active';
  if not found then return jsonb_build_object('error', 'not_available'); end if;

  if l.is_refrigerant and l.seller_id <> buyer and not exists (
    select 1 from public.profiles where id = buyer and epa608_verified
  ) then
    return jsonb_build_object('error', 'epa608_required');
  end if;

  return jsonb_build_object(
    'name', split_part(l.display_name, ' ', 1),
    'phone', case when l.show_phone then l.phone else null end
  );
end;
$$;

-- ---------------------------------------------------------------
-- Moderation on listings
-- ---------------------------------------------------------------
alter table public.listings add column if not exists moderation text
  check (moderation in ('auto_hidden', 'admin_removed'));
alter table public.listings add column if not exists moderation_prev_status text;

-- Sellers can't bring back a listing that's under review or removed by Partsaur.
create or replace function public.listings_block_moderated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Admin actions always change `moderation` too (sellers can't write that column).
  if old.moderation is not null and new.moderation is not distinct from old.moderation
     and new.status is distinct from old.status then
    raise exception 'MODERATED: this listing is under review by Partsaur' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_block_moderated on public.listings;
create trigger listings_block_moderated
  before update of status on public.listings
  for each row execute function public.listings_block_moderated();

-- ---------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid not null references public.listings (id) on delete cascade,
  reason      text not null check (reason in
                ('prohibited', 'refrigerant', 'recalled', 'scam', 'wrong_info', 'other')),
  note        text check (length(note) <= 1000),
  status      text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (reporter_id, listing_id)
);

create index if not exists reports_listing_idx on public.reports (listing_id);
create index if not exists reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

drop policy if exists "Users can report listings" on public.reports;
create policy "Users can report listings"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

drop policy if exists "Users see their own reports" on public.reports;
create policy "Users see their own reports"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

revoke all on public.reports from anon;
revoke insert, update, delete on public.reports from authenticated;
grant insert (reporter_id, listing_id, reason, note) on public.reports to authenticated;

-- 3 different people report it → hide until Brian reviews.
create or replace function public.reports_auto_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(distinct r.reporter_id) from public.reports r
      where r.listing_id = new.listing_id and r.status = 'open') >= 3 then
    update public.listings
    set moderation_prev_status = status, status = 'removed', moderation = 'auto_hidden'
    where id = new.listing_id and moderation is null and status in ('active', 'sold');
  end if;
  return new;
end;
$$;

drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide
  after insert on public.reports
  for each row execute function public.reports_auto_hide();

-- Can't report your own listing.
create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.listings l where l.id = new.listing_id and l.seller_id = new.reporter_id) then
    raise exception 'OWN_LISTING' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_before_insert on public.reports;
create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

revoke all on function public.messages_after_insert() from public, anon, authenticated;
revoke all on function public.reports_auto_hide() from public, anon, authenticated;
revoke all on function public.reports_before_insert() from public, anon, authenticated;
revoke all on function public.listings_block_moderated() from public, anon, authenticated;
