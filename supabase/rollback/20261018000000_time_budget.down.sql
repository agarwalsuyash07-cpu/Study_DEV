-- Reverts 20261018000000_time_budget. Loses per-topic estimates and daily budgets.
alter table public.user_settings drop column if exists daily_budget;
alter table public.topics drop column if exists est_minutes;
