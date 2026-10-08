# Architecture

## What and why
A single-user study tracker for 7 tracks (5 semester courses, DSA, Applied AI). A weekly schedule of time blocks drives an auto-generated daily task list; ticking topics done (anywhere) moves the plan forward. Each track shows % done, hours spent, hours left and an estimated finish date. Visual language follows takeUforward (Planly / A2Z sheet), laid out for a laptop.

## System
```
Browser (Vite + React SPA, Vercel static hosting)
   │  supabase-js (anon/publishable key + user JWT)
   ▼
Supabase
   ├─ Auth: email + password, one user (no sign-up UI)
   ├─ Postgres: 7 tables, RLS user_id = auth.uid() on all
   ├─ RPC save_day_plan (atomic plan create / regenerate)
   ├─ Trigger topics_done_sync (topic done ⇄ today's plan item)
   └─ View topic_spent (minutes per topic, security_invoker)

scripts/import-seed.ts (local, service-role key) ── upserts seed/*.json ──▶ Postgres
```
There is no custom backend. All business logic that must be atomic lives in Postgres (RPC, trigger); planning logic is pure TypeScript in the client.

## Directory map
| Path | What |
|---|---|
| `seed/*.json` | Syllabus per track (modules → topics, module `estMinutes`) |
| `scripts/import-seed.ts` | Idempotent import: tracks/modules/topics only, default schedule if empty |
| `scripts/set-password.ts` | Sets (or creates) the login password for `IMPORT_USER_EMAIL` via the admin API |
| `supabase/migrations/` | Schema, RLS, RPC, trigger, view |
| `supabase/rollback/` | Down scripts per migration (run by hand) |
| `src/lib/plan.ts` | Pure logic: `assignDay`, `previewDays`, `keptByBlock`, `topicEst`, `remainingEstimate`, `estCompletion`, `trackSummary` |
| `src/lib/date.ts` | IST "today", weekday (0 = Sunday), Mon–Sun week |
| `src/lib/stats.ts` | Pure dashboard math: `streaks`, `heatmapWeeks`, `heatLevel` |
| `src/lib/data.ts` | All Supabase reads/writes |
| `src/lib/useCatalog.ts` | Catalog state + shared topic actions (done, star, minutes, estimate) |
| `src/lib/useTimer.ts` | One active timer, persisted in localStorage |
| `src/components/` | `Layout` (sidebar), `TopicRow`, `ui.tsx` primitives, `TrackStats`, `ProgressBar` |
| `src/pages/` | Dashboard (`/`), Today (`/today`), Tracks, TrackDetail, Week, Revision, Settings, Login |

## Files that matter most
1. `src/lib/plan.ts`: the auto-assign algorithm and completion math (fully unit-tested).
2. `supabase/migrations/20261008000000_init.sql`: schema, RLS, `save_day_plan`, done-sync trigger.
3. `src/lib/data.ts`: every query; `ensureDayPlan` and `regenerateDay` wire plan.ts to the RPC.
4. `src/lib/useCatalog.ts`: shared state shape every page builds on.
5. `scripts/import-seed.ts`: the only writer of syllabus data.
6. `src/pages/Today.tsx`: daily flow, timer, regenerate.
7. `src/pages/Dashboard.tsx`: home page; read-only progress overview (KPIs, 26-week heatmap, track bars, recent completions).

## Data model
- `tracks` 1─* `modules` 1─* `topics` (seed IDs are the primary keys, text).
- `topics.done_at`, `topics.revision` hold progress; `sessions` (timer or manual minutes) hold time.
- `schedule_blocks` (weekday, track or checklist label, minutes) define the week.
- `day_plans` (one per date, frozen once generated) 1─* `day_plan_items` (topic or checklist label).
- Derived, never stored: topic estimate = module `est_minutes` ÷ topics in module; time spent = Σ session minutes (`topic_spent` view).
- Every row has `user_id`; RLS restricts all access to the owner.

## Key decisions
See [DECISIONS.md](DECISIONS.md).

## Rough edges / ponytail ceilings
- Plain selects rely on the API's 1000-row cap being enough for topics/blocks (~300). Sessions are aggregated in a view and Export paginates, so they are safe. Paginate catalog loads if the syllabus grows past ~1000 topics.
- Dashboard heatmap loads 26 weeks of sessions with a plain select; past ~1000 sessions in that window it would undercount. Aggregate per day in a view if that happens.
- Week preview assumes earlier-planned topics get done; it is a forecast, not a promise.
- Topic text IDs are global primary keys, so the schema is single-user by design; multi-user would need composite keys.
- No error tracking (Sentry) or structured logging: personal app, errors surface in the UI banner.
