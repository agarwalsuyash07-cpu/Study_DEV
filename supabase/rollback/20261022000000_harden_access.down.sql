-- Reverts 20261022000000_harden_access: restores the original grants and the plain own-row policies. No data changes.
grant select, insert, update, delete, truncate, references, trigger
  on public.tracks, public.modules, public.topics, public.sessions, public.schedule_blocks,
     public.day_plans, public.day_plan_items, public.topic_spent
  to anon;
grant truncate, trigger, references on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to anon;
alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant all on sequences to anon;
alter default privileges for role postgres in schema public grant execute on functions to anon, public;
alter default privileges for role postgres in schema public grant truncate, trigger, references on tables to authenticated;

alter policy own on public.modules with check ((select auth.uid()) = user_id);
alter policy own on public.topics with check ((select auth.uid()) = user_id);
alter policy own on public.schedule_blocks with check ((select auth.uid()) = user_id);
alter policy own on public.day_plan_items with check ((select auth.uid()) = user_id);
