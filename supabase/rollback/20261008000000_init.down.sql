-- Down path for 20261008000000_init.sql. Destroys all data: export from Settings first.
drop function if exists public.save_day_plan(date, jsonb, boolean);
drop trigger if exists topics_done_sync on public.topics;
drop function if exists public.sync_today_item();
drop table if exists public.day_plan_items;
drop table if exists public.day_plans;
drop table if exists public.schedule_blocks;
drop table if exists public.sessions;
drop table if exists public.topics;
drop table if exists public.modules;
drop table if exists public.tracks;
