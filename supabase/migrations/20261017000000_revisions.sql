-- Confidence (1 low – 3 high) and spaced revision. One revisions row per topic; due_date null = nothing scheduled (finished or not done).
alter table public.topics
  add column confidence smallint check (confidence between 1 and 3),
  add column last_reviewed_at timestamptz;

create table public.revisions (
  topic_id text primary key references public.topics on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  due_date date,
  interval_step int not null default 0 check (interval_step >= 0),
  updated_at timestamptz not null default now()
);
create index on public.revisions (user_id, due_date);

alter table public.revisions enable row level security;
-- FK checks ignore RLS, so writes also prove the topic is the caller's
create policy own on public.revisions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.topics t where t.id = topic_id and t.user_id = (select auth.uid()))
  );
revoke all on public.revisions from anon;
