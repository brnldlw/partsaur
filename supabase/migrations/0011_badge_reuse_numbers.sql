-- Founding Seller badge: hand out the lowest free number (1-100) instead of
-- count + 1. With count + 1, removing a badge from the middle (e.g. #3 of 5)
-- would hand #5 out twice -> unique-index error -> that seller's listing fails.
create or replace function public.listings_first_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_num int;
begin
  if new.status <> 'active' then
    return new;
  end if;

  update public.profiles set first_listed_at = now()
  where id = new.seller_id and first_listed_at is null;
  if not found then
    return new;  -- not their first listing
  end if;

  -- One at a time, so the same badge number can't be handed out twice.
  perform pg_advisory_xact_lock(hashtext('founding_seller_badge'));
  select min(n) into next_num
  from generate_series(1, 100) as n
  where not exists (
    select 1 from public.profiles where founding_seller_number = n
  );
  if next_num is not null then
    update public.profiles set founding_seller_number = next_num
    where id = new.seller_id and founding_seller_number is null;
  end if;
  return new;
end;
$$;
