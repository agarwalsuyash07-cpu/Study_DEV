-- Reverts 20261016000000_sync_done_day: back to syncing only today's (IST) item.
create or replace function public.sync_today_item() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.day_plan_items
     set done_at = new.done_at
   where topic_id = new.id
     and user_id = new.user_id
     and deferred_to is null
     and date = (now() at time zone 'Asia/Kolkata')::date;
  return new;
end $$;
