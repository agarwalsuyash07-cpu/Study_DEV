-- Done-state sync follows the completion day, not "today": backfilling a past day ticks that day's item,
-- un-ticking clears the item on the day it had been done, and undo (restoring an old timestamp) lands on the right day.
create or replace function public.sync_today_item() returns trigger
language plpgsql set search_path = '' as $$
declare
  old_day date := (old.done_at at time zone 'Asia/Kolkata')::date;
  new_day date := (new.done_at at time zone 'Asia/Kolkata')::date;
begin
  -- completion moved to another day: the old day's item is no longer done
  if old_day is not null and old_day is distinct from new_day then
    update public.day_plan_items
       set done_at = null
     where topic_id = new.id and user_id = new.user_id and deferred_to is null and date = old_day;
  end if;
  if new_day is not null then
    update public.day_plan_items
       set done_at = new.done_at
     where topic_id = new.id and user_id = new.user_id and deferred_to is null and date = new_day;
  end if;
  return new;
end $$;
