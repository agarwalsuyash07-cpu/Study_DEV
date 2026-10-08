-- Study tracker schema. Single user; every row owned via user_id + RLS.

create table public.tracks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  type text not null,
  course_code text,
  sort_order int not null
);

create table public.modules (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  track_id text not null references public.tracks on delete cascade,
  sort_order int not null,
  name text not null,
  co text,
  est_minutes int check (est_minutes > 0)
);

create table public.topics (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  module_id text not null references public.modules on delete cascade,
  sort_order int not null,
  title text not null,
  bloom text,
  done_at timestamptz,
  revision boolean not null default false
);

create table public.sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id text not null references public.topics on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes int not null check (minutes > 0),
  check (ended_at >= started_at)
);

create table public.schedule_blocks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  track_id text references public.tracks on delete set null,
  label text,
  minutes int not null check (minutes > 0),
  sort_order int not null,
  check (track_id is not null or label is not null)
);

create table public.day_plans (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.day_plan_items (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  -- set null so past plans survive schedule edits
  block_id bigint references public.schedule_blocks on delete set null,
  topic_id text references public.topics on delete cascade,
  label text,
  sort_order int not null,
  done_at timestamptz,
  foreign key (user_id, date) references public.day_plans on delete cascade,
  check ((topic_id is null) <> (label is null)),
  unique (user_id, date, topic_id)
);

create index on public.modules (track_id);
create index on public.topics (module_id);
create index on public.sessions (topic_id);
create index on public.schedule_blocks (user_id, weekday);
create index on public.day_plan_items (block_id);

alter table public.tracks enable row level security;
alter table public.modules enable row level security;
alter table public.topics enable row level security;
alter table public.sessions enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.day_plans enable row level security;
alter table public.day_plan_items enable row level security;

create policy own on public.tracks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own on public.modules for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own on public.topics for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own on public.sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own on public.schedule_blocks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own on public.day_plans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own on public.day_plan_items for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Mirror topic done/undone onto today's (IST) plan item, whichever page changed it.
create function public.sync_today_item() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.day_plan_items
     set done_at = new.done_at
   where topic_id = new.id
     and user_id = new.user_id
     and date = (now() at time zone 'Asia/Kolkata')::date;
  return new;
end $$;

create trigger topics_done_sync
  after update of done_at on public.topics
  for each row when (old.done_at is distinct from new.done_at)
  execute function public.sync_today_item();

-- Atomic plan write. p_items: [{block_id, topic_id, label, sort_order}].
-- replace=false: create plan once (returns false if it already existed). replace=true: swap undone items.
create function public.save_day_plan(p_date date, p_items jsonb, p_replace boolean) returns boolean
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

revoke execute on function public.save_day_plan(date, jsonb, boolean) from public, anon;
grant execute on function public.save_day_plan(date, jsonb, boolean) to authenticated;
revoke execute on function public.sync_today_item() from public, anon, authenticated;
