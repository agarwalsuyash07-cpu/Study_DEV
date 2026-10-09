-- Security hardening. RLS already returned zero rows to signed-out callers; this removes the grants themselves
-- and closes the foreign-key gap (FK checks ignore RLS, so a row could point at another user's row).

-- Signed out (anon): no table, view, sequence or function access at all, now and for objects created later.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

-- Signed in: plain CRUD only. TRUNCATE ignores RLS; TRIGGER/REFERENCES are never needed by the app.
revoke truncate, trigger, references on all tables in schema public from authenticated;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from authenticated;

-- Writes must also own whatever they point at.
alter policy own on public.modules
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.tracks t where t.id = track_id and t.user_id = (select auth.uid()))
  );
alter policy own on public.topics
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.modules m where m.id = module_id and m.user_id = (select auth.uid()))
  );
alter policy own on public.schedule_blocks
  with check (
    (select auth.uid()) = user_id
    and (track_id is null or exists (select 1 from public.tracks t where t.id = track_id and t.user_id = (select auth.uid())))
  );
alter policy own on public.day_plan_items
  with check (
    (select auth.uid()) = user_id
    and (topic_id is null or exists (select 1 from public.topics t where t.id = topic_id and t.user_id = (select auth.uid())))
    and (track_id is null or exists (select 1 from public.tracks t where t.id = track_id and t.user_id = (select auth.uid())))
    and (block_id is null or exists (select 1 from public.schedule_blocks b where b.id = block_id and b.user_id = (select auth.uid())))
  );

-- functions the app calls stay callable when signed in (the trigger function is never called directly)
grant execute on function public.save_day_plan(date, jsonb, boolean) to authenticated;
grant execute on function public.add_plan_item(date, text, text) to authenticated;
grant execute on function public.defer_plan_item(bigint, date) to authenticated;
grant execute on function public.import_topics(text, jsonb) to authenticated;
