-- Reverts 20261021000000_weekly_review. Loses reflections and chosen PYQ subjects.
alter table public.day_plan_items drop column if exists track_id;
drop table if exists public.weekly_reviews;
