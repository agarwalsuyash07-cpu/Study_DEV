-- Down path for 20261011000000_remove_time.sql. Restores structure only: sessions and estimates come back empty.
alter table public.schedule_blocks drop constraint if exists schedule_blocks_topics_check;
alter table public.schedule_blocks alter column topics drop default;
update public.schedule_blocks set topics = topics * 60;
alter table public.schedule_blocks rename column topics to minutes;
alter table public.schedule_blocks add constraint schedule_blocks_minutes_check check (minutes > 0);

alter table public.modules add column if not exists est_minutes int check (est_minutes > 0);

create table public.sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id text not null references public.topics on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes int not null check (minutes > 0),
  check (ended_at >= started_at)
);
create index on public.sessions (topic_id);
alter table public.sessions enable row level security;
create policy own on public.sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create view public.topic_spent with (security_invoker = true) as
  select topic_id, sum(minutes)::int as minutes
    from public.sessions
   group by topic_id;
