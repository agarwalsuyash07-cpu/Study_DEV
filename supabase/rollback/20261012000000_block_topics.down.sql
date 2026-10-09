-- Reverts 20261012000000_block_topics. Loses only the topic counts.
alter table public.schedule_blocks alter column minutes drop default;
alter table public.schedule_blocks drop column if exists topics;
