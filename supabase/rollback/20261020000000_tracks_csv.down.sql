-- Reverts 20261020000000_tracks_csv. Keeps any imported topics and the Applied AI track (data, not schema);
-- delete them by hand if wanted. After this, `npm run import` may prune app-created rows again.
drop function if exists public.import_topics(text, jsonb);
alter table public.tracks drop column if exists count_in_overall;
alter table public.topics drop column if exists origin;
alter table public.modules drop column if exists origin;
alter table public.tracks drop column if exists origin;
