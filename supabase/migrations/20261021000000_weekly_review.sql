-- Weekly review reflections (one per Mon–Sun week) and a subject for checklist items like "PYQs (weakest subject)".
create table public.weekly_reviews (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  reflection text not null default '' check (char_length(reflection) <= 10000),
  -- snapshot of the numbers shown when the reflection was saved
  summary jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.weekly_reviews enable row level security;
create policy own on public.weekly_reviews for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.weekly_reviews from anon;

-- null = not chosen yet (the app suggests the weakest track)
alter table public.day_plan_items add column track_id text references public.tracks on delete set null;
