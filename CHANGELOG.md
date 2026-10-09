# Changelog

## 2026-10-09 — branch `fix/tracker-roadmap`

All schema changes are additive, applied to the live Supabase project, and each has a down script in `supabase/rollback/`. A full JSON backup was taken first (`npm run backup` → `backups/`, gitignored). Nothing in your existing data was deleted.

### Fixes and features

1. **Schedule vs pace bug** — the `remove_time` migration was never applied to the live DB, so `schedule_blocks.topics` didn't exist and every count read as empty (NaN → "Not scheduled", "—", blank Settings inputs). Replaced it with an additive migration that adds `topics` (from `round(minutes/60)`) and keeps `minutes`, `sessions` and module estimates. `loadCatalog` now fails loudly if counts are missing. Dashboard, Tracks, Week and Settings all read the same numbers.
   *Migration:* `20261012000000_block_topics.sql`
2. **Carry-over and defer** — Overdue section on Today (undone topics from the last 30 days); every item can be deferred to tomorrow or any date; "Add item" (any topic or free text); drag or up/down reorder; Regenerate shows a dry-run diff and asks first, and never drops done, added, deferred or overdue items.
   *Migration:* `20261013000000_carry_over.sql` (`manual`, `deferred_to`, `add_plan_item`, `defer_plan_item`, safer `save_day_plan`)
3. **Exam dates and pace** — `tracks.exam_date`, editable in Settings and on the track page; per track: topics left, days left, needed per day, 7-day pace, ahead/behind by N; Dashboard banner.
   *Migration:* `20261014000000_exam_date.sql`
4. **Today consistency** — one shared "completed on day" selector (`stats.ts`) used by Today, Dashboard and Week; Today shows "Also done today".
5. **Streak rule** — a day counts at ≥ max(1, 50% of its plan), or ≥ 3 topics with no plan; both thresholds are settings; current and best streak recomputed from history.
   *Migration:* `20261015000000_user_settings.sql`
6. **Undo and backfill** — 5s Undo toast on every tick/untick (restores the exact previous time); tick past days on the Week page (backfilled at noon IST). The DB trigger now syncs the plan item on the completion day.
   *Migration:* `20261016000000_sync_done_day.sql`
7. **Confidence and spaced revision** — one-tap confidence 1–3 in the tick toast (skippable); reviews at 1/3/7/21-day gaps, confidence 1 halves them, Again resets; Revision page with Due today / Upcoming / Starred; "Revision due: N" chip on Today and Dashboard.
   *Migrations:* `20261017000000_revisions.sql`, `20261017000100_seed_revisions.sql` (first review for the 5 topics already done)
8. **Time budget** — topic estimates (own, else module ÷ topics, else Bloom default); daily budget per weekday; Today shows planned vs budget and warns; planning stops at the budget unless you tick "Ignore budget".
   *Migration:* `20261018000000_time_budget.sql`
9. **Topic drawer** — notes (Markdown, rendered without innerHTML), http(s) links, confidence, estimate, Bloom level, star, last/next review; practice-problems checkbox for Apply/Analyze; Bloom tags on every topic list.
   *Migration:* `20261019000000_topic_details.sql`
10. **DSA and Applied AI** — DSA excluded from overall % (toggle per track); CSV import of topics on any track (atomic, skips duplicates); Applied AI added as an empty track; `npm run import` no longer prunes rows created in the app.
    *Migration:* `20261020000000_tracks_csv.sql`
11. **Week and review** — tick, defer or add on any day; empty past days fold into chips; even grid gaps; weekly review card (done, per-track, missed, streak, revisions) with a saved reflection; PYQ subject picker defaulting to the weakest track.
    *Migration:* `20261021000000_weekly_review.sql`
12. **Search** — Ctrl/Cmd+K palette over topics, modules and tracks; jumps to and highlights the topic.
13. **Settings** — labelled, required Topics and Minutes per block; drag (or arrow-key) reorder; Undo on remove; "All changes saved" indicator; export now covers every table; validated JSON import (merge, never deletes).
14. **Polish and accessibility** — focus rings restored; `check` colour raised to ≥4.7:1; per-route page titles; Today's right column always filled; icons on the mobile tab bar; no horizontal scroll at 360/390/768/1280 (checked in the browser); PWA manifest + icons (installable, no offline mode).
15. **Performance** — shared catalog cache with stale-while-revalidate (60s): 4 requests on first load, 0 on route changes (was 4 per page).
16. **Security** — see below.
    *Migration:* `20261022000000_harden_access.sql`

17. **Review gates** — a security review found nothing critical/high/medium; a low finding (links were only validated client-side) is fixed with a DB check constraint. A React review found race conditions in the new cache (a background refetch could undo a just-made tick, sign-out could be overtaken by an in-flight fetch); fixed with tests.
    *Migration:* `20261023000000_links_http_only.sql`

Also: oxlint added (`npm run lint`, `npm run check`), `npm run backup`, one test file re-encoded to UTF-8, zod moved to runtime dependencies.

### Security audit (item 16)

| Table / view | RLS | Policy | Signed-out (anon) before → after |
|---|---|---|---|
| tracks, modules, topics, schedule_blocks, day_plans, day_plan_items, sessions | on | `own`: authenticated, `auth.uid() = user_id` | full grants incl. TRUNCATE (rows hidden by RLS) → no access |
| topic_spent (view, security_invoker) | n/a (uses sessions' RLS) | — | full grants → no access |
| user_settings, revisions, weekly_reviews | on | `own` (revisions also checks topic ownership) | no access → no access |

Gaps closed: anon grants revoked (also for future objects); authenticated loses TRUNCATE/TRIGGER/REFERENCES; writes to modules, topics, schedule_blocks and day_plan_items must also own what they reference (FK checks skip RLS). Functions: none are SECURITY DEFINER; all are denied to anon.

**Signed-out test** (anon key only, no user token), 17 requests covering every table, the view, writes and RPCs: all now `401 permission denied`. Before: reads returned `[]`, and PATCH/DELETE "succeeded" on 0 rows (verified nothing changed).

**Service-role key:** absent from `dist/`, all tracked files and the full git history. Only `VITE_SUPABASE_URL` and the anon key reach the browser.

### Tests

99 tests, all passing: pace (`pace.test.ts`), streak rule (`stats.test.ts`), carry-over (`carry.test.ts`), revision scheduling (`revision.test.ts`), plus CSV, backup validation, markdown/XSS, search, toast, catalog cache, review summary, the schedule regression and cache race conditions.

### Skipped or limited, and why

- **Offline PWA:** manifest + icons only, no service worker. Installs on Android/iOS; needs a connection to load data.
- **Touch drag reorder:** HTML5 drag works with a mouse only. On phones use the "⋯ → Move up/down" menu (Today) or the handle + arrow keys (Settings).
- **JSON import:** not one transaction (PostgREST); every step is an idempotent upsert, so re-running after a failure is safe. Plan items and schedule blocks are only updated, never inserted.
- **Carry-over window:** 30 days; checklist items (e.g. "Weekly review") don't carry over.
- **Leaked-password protection:** a Supabase dashboard toggle; I can't change it from here.
- **Pagination:** not added; 202 topics is far under the 1000-row API cap. Plan history is already paged.
