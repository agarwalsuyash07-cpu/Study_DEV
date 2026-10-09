-- Additive replacement for the never-applied remove_time migration: blocks get a topic count, minutes stay (per-block time budget).
alter table public.schedule_blocks
  add column topics int not null default 2 check (topics between 1 and 20);

-- ~1 topic per hour of the block's planned minutes
update public.schedule_blocks set topics = least(20, greatest(1, round(minutes / 60.0)));

-- the app inserts blocks without minutes; without a default every "Add block" failed
alter table public.schedule_blocks alter column minutes set default 60;
