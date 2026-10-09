# Architecture

## What and why
A single-user study tracker for 6 tracks (5 semester courses + DSA; Applied AI is paused, its seed kept in `seed/applied-ai.json`). A weekly schedule of blocks (each = a track and how many topics) drives an auto-generated daily task list; ticking topics done (anywhere) moves the plan forward. Each track shows % done and topics left. There is deliberately no time tracking: no timers, estimates, hours or finish dates. Visual language follows takeUforward (Planly / A2Z sheet), laid out for a laptop.

## System
```
Browser (Vite + React SPA, Vercel static hosting)
   │  supabase-js (anon/publishable key + user JWT)
   ▼
Supabase
   ├─ Auth: email + password, one user (no sign-up UI)
   ├─ Postgres: 6 tables, RLS user_id = auth.uid() on all
   ├─ RPC save_day_plan (atomic plan create / regenerate)
   └─ Trigger topics_done_sync (topic done ⇄ today's plan item)

scripts/import-seed.ts (local, service-role key) ── upserts seed/*.json ──▶ Postgres
```
There is no custom backend. All business logic that must be atomic lives in Postgres (RPC, trigger); planning logic is pure TypeScript in the client.

## Directory map
| Path | What |
|---|---|
| `seed/*.json` | Syllabus per track (modules → topics) |
| `scripts/import-seed.ts` | Idempotent import of the tracks in `TRACK_FILES`: upserts tracks/modules/topics, deletes ones dropped from the seed unless they have progress (a removed track also loses its schedule blocks), default schedule if empty |
| `scripts/set-password.ts` | Sets (or creates) the login password for `IMPORT_USER_EMAIL` via the admin API |
| `supabase/migrations/` | Schema, RLS, RPC, trigger |
| `supabase/rollback/` | Down scripts per migration (run by hand) |
| `src/lib/plan.ts` | Pure logic: `assignDay`, `previewDays`, `keptByBlock` |
| `src/lib/date.ts` | IST "today", weekday (0 = Sunday), Mon–Sun week |
| `src/lib/stats.ts` | Pure dashboard math: `streaks`, `heatmapWeeks`, `heatLevel` |
| `src/lib/links.ts` | Track id → external URL (DSA → takeuforward.org/dashboard); linked titles open in a new tab |
| `src/lib/data.ts` | All Supabase reads/writes |
| `src/lib/useCatalog.ts` | Catalog state + shared topic actions (done, star) |
| `src/components/` | `Layout` (sidebar), `TopicRow`, `ui.tsx` primitives, `TrackStats`, `ProgressBar` |
| `src/pages/` | Dashboard (`/`), Today (`/today`), Tracks, TrackDetail, Week, Revision, Settings, Login |

## Files that matter most
1. `src/lib/plan.ts`: the auto-assign algorithm (fully unit-tested).
2. `supabase/migrations/20261008000000_init.sql`: schema, RLS, `save_day_plan`, done-sync trigger.
3. `src/lib/data.ts`: every query; `ensureDayPlan` and `regenerateDay` wire plan.ts to the RPC.
4. `src/lib/useCatalog.ts`: shared state shape every page builds on.
5. `scripts/import-seed.ts`: the only writer of syllabus data.
6. `src/pages/Today.tsx`: daily flow, regenerate.
7. `src/pages/Dashboard.tsx`: home page; read-only progress overview (KPIs, 26-week topics-done heatmap, track bars, recent completions).

## Data model
- `tracks` 1─* `modules` 1─* `topics` (seed IDs are the primary keys, text).
- `topics.done_at`, `topics.revision` hold progress.
- `schedule_blocks` (weekday, track or checklist label, `topics` count 1–20) define the week.
- `day_plans` (one per date, frozen once generated) 1─* `day_plan_items` (topic or checklist label).
- Every row has `user_id`; RLS restricts all access to the owner.

## Key decisions
See [DECISIONS.md](DECISIONS.md).

## Rough edges / ponytail ceilings
- Plain selects rely on the API's 1000-row cap being enough for topics/blocks (~300); Export paginates. Paginate catalog loads if the syllabus grows past ~1000 topics.
- Dashboard heatmap/streak count topics by their current `done_at`; un-ticking a topic removes it from history (no separate activity log).
- Week preview assumes earlier-planned topics get done; it is a forecast, not a promise.
- Topic text IDs are global primary keys, so the schema is single-user by design; multi-user would need composite keys.
- No error tracking (Sentry) or structured logging: personal app, errors surface in the UI banner.
