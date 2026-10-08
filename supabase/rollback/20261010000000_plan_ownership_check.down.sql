-- Restores save_day_plan from 20261008000000_init.sql (without the ownership check).
create or replace function public.save_day_plan(p_date date, p_items jsonb, p_replace boolean) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_replace then
    if not exists (select 1 from public.day_plans where user_id = uid and date = p_date) then
      raise exception 'no plan for %', p_date;
    end if;
    delete from public.day_plan_items where user_id = uid and date = p_date and done_at is null;
    update public.day_plans set generated_at = now() where user_id = uid and date = p_date;
  else
    insert into public.day_plans (user_id, date) values (uid, p_date) on conflict do nothing;
    if not found then
      return false;
    end if;
  end if;

  insert into public.day_plan_items (user_id, date, block_id, topic_id, label, sort_order)
  select uid, p_date, (i->>'block_id')::bigint, i->>'topic_id', i->>'label', (i->>'sort_order')::int
    from jsonb_array_elements(p_items) as i;

  return true;
end $$;
