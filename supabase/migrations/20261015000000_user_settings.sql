-- One row of preferences per user. Missing row = defaults (the client upserts on first save).
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  -- streak: a day counts when done >= max(1, streak_plan_pct% of its plan), or >= streak_min_no_plan without a plan
  streak_plan_pct int not null default 50 check (streak_plan_pct between 1 and 100),
  streak_min_no_plan int not null default 3 check (streak_min_no_plan between 1 and 50),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
create policy own on public.user_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_settings from anon;
