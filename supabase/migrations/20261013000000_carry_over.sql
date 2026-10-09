-- Carry-over and defer: items can be added by hand or moved to another day, and regenerate keeps both.
alter table public.day_plan_items
  add column manual boolean not null default false,
  add column deferred_to date;

-- a day can exist before it is generated (something was deferred or added into it); null = not generated yet
alter table public.day_plans alter column generated_at drop not null;

-- create once (also claims a day that only holds added items) or regenerate; done, manual and deferred items always survive
create or replace function public.save_day_plan(p_date date, p_items jsonb, p_replace boolean) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  base int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as i
     where (i->>'topic_id' is not null and not exists (
              select 1 from public.topics t where t.id = i->>'topic_id' and t.user_id = uid))
        or (i->>'block_id' is not null and not exists (
              select 1 from public.schedule_blocks b where b.id = (i->>'block_id')::bigint and b.user_id = uid))
  ) then
    raise exception 'plan references a topic or block you do not own';
  end if;

  if p_replace then
    if not exists (select 1 from public.day_plans where user_id = uid and date = p_date) then
      raise exception 'no plan for %', p_date;
    end if;
    delete from public.day_plan_items
     where user_id = uid and date = p_date and done_at is null and not manual and deferred_to is null;
    update public.day_plans set generated_at = now() where user_id = uid and date = p_date;
  else
    insert into public.day_plans (user_id, date) values (uid, p_date)
      on conflict (user_id, date) do update set generated_at = now() where public.day_plans.generated_at is null;
    if not found then
      return false;
    end if;
  end if;

  -- new items go after whatever the day already holds
  select coalesce(max(sort_order) + 1, 0) into base from public.day_plan_items where user_id = uid and date = p_date;
  insert into public.day_plan_items (user_id, date, block_id, topic_id, label, sort_order)
  select uid, p_date, (i->>'block_id')::bigint, i->>'topic_id', i->>'label', base + (i->>'sort_order')::int
    from jsonb_array_elements(p_items) as i
  on conflict (user_id, date, topic_id) do nothing;

  return true;
end $$;

-- Adds a topic or free-text item to a day, creating the day if needed. Returns the item id, or null if the topic is already planned that day.
create function public.add_plan_item(p_date date, p_topic_id text, p_label text) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_id bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if (p_topic_id is null) = (nullif(trim(p_label), '') is null) then
    raise exception 'give either a topic or a label';
  end if;
  -- FK checks ignore RLS
  if p_topic_id is not null and not exists (select 1 from public.topics where id = p_topic_id and user_id = uid) then
    raise exception 'topic not found';
  end if;

  insert into public.day_plans (user_id, date, generated_at) values (uid, p_date, null) on conflict do nothing;
  insert into public.day_plan_items (user_id, date, topic_id, label, sort_order, manual)
  values (uid, p_date, p_topic_id, nullif(trim(p_label), ''),
          (select coalesce(max(sort_order) + 1, 0) from public.day_plan_items where user_id = uid and date = p_date), true)
  on conflict (user_id, date, topic_id) do nothing
  returning id into new_id;
  return new_id;
end $$;

-- Moves an unfinished item to a later day: a copy is added there, the original stays as history with deferred_to set.
create function public.defer_plan_item(p_item_id bigint, p_to date) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  src public.day_plan_items;
  new_id bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select * into src from public.day_plan_items where id = p_item_id and user_id = uid;
  if not found then
    raise exception 'item not found';
  end if;
  if src.done_at is not null or src.deferred_to is not null then
    raise exception 'item is already done or deferred';
  end if;
  if p_to = src.date or p_to < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'pick today or a later day other than the item''s own';
  end if;

  new_id := public.add_plan_item(p_to, src.topic_id, src.label);
  update public.day_plan_items set deferred_to = p_to where id = p_item_id;
  return new_id;
end $$;

-- deferred originals are history; don't tick them when the topic is done
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

revoke execute on function public.add_plan_item(date, text, text) from public, anon;
revoke execute on function public.defer_plan_item(bigint, date) from public, anon;
grant execute on function public.add_plan_item(date, text, text) to authenticated;
grant execute on function public.defer_plan_item(bigint, date) to authenticated;
