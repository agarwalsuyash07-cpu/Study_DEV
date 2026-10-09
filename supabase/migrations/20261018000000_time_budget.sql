-- Time budget: per-topic estimate (null = derived from its module / Bloom tag) and a daily minutes budget per weekday.
alter table public.topics
  add column est_minutes int check (est_minutes between 1 and 600);

-- index = weekday (0 = Sunday); a null element means "use the sum of that day's block minutes"
alter table public.user_settings
  add column daily_budget int[] check (daily_budget is null or array_length(daily_budget, 1) = 7);
