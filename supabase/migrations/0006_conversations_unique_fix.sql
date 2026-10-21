-- Fix: "I have it" couldn't save the conversation. The upsert needs a plain
-- (non-partial) unique index on (wanted_id, seller_id). Nulls stay distinct,
-- so listing-only conversations (wanted_id null) are unaffected.
drop index if exists public.conversations_wanted_seller_key;
create unique index if not exists conversations_wanted_seller_key
  on public.conversations (wanted_id, seller_id);
