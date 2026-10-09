-- Reverts 20261019000000_topic_details. Loses notes, links and practice flags.
alter table public.topics drop column if exists practice_done, drop column if exists links, drop column if exists notes;
