-- Reverts 20261017000000_revisions. Loses review schedules, confidence and last-reviewed times.
drop table if exists public.revisions;
alter table public.topics drop column if exists last_reviewed_at, drop column if exists confidence;
