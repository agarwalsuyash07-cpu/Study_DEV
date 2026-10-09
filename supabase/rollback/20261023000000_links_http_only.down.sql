-- Reverts 20261023000000_links_http_only. No data changes.
alter table public.topics drop constraint if exists topics_links_http;
drop function if exists public.all_http_links(text[]);
