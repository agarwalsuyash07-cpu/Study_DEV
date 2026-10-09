-- Time tracking removed: no sessions, no module estimates; schedule blocks hold a topic count instead of minutes.
-- Destroys logged sessions and estimates: export from Settings first if you want them.
drop view if exists public.topic_spent;
drop table if exists public.sessions;

alter table public.modules drop column if exists est_minutes;

-- ~1 topic per hour keeps the old block sizes roughly proportional
alter table public.schedule_blocks rename column minutes to topics;
alter table public.schedule_blocks drop constraint if exists schedule_blocks_minutes_check;
update public.schedule_blocks set topics = least(20, greatest(1, round(topics / 60.0)));
alter table public.schedule_blocks
  alter column topics set default 2,
  add constraint schedule_blocks_topics_check check (topics between 1 and 20);
