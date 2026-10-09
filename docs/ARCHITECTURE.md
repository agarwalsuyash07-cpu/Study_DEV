# Architecture

## What and why
A single-user study tracker for 7 tracks (5 semester courses, DSA as a checklist track, Applied AI filled via CSV). A weekly schedule of blocks (a track + how many topics + minutes) drives an auto-generated daily plan, capped by a daily time budget. Missed topics carry over, items can be deferred or added by hand, completed topics come back for spaced revision (1/3/7/21-day gaps), and per-track pace is measured against exam dates. Visual language follows takeUforward (dark, DM Sans), laptop-first with a mobile tab bar; installable as a PWA.

## System
```
Browser (Vite + React 19 SPA, Vercel static hosting, PWA manifest)
   │  supabase-js (anon key + user JWT)
   ▼
Supabase
   ├─ Auth: email + password, one user (sign-ups off)
   ├─ Postgres: 10 tables, RLS own-row on all; anon has no grants
   ├─ RPCs: save_day_plan, add_plan_item, defer_plan_item, import_topics (SECURITY INVOKER, ownership-checked)
   └─ Trigger topics_done_sync (topic done ⇄ plan item on the completion day)

scripts/import-seed.ts, backup.ts, set-password.ts (local, service-role key)
```
No custom backend. Atomic writes live in Postgres RPCs; planning, pace, streak and revision logic is pure TypeScript in `src/lib/`, unit-tested.

## Directory map
| Path | What |
|---|---|
| `seed/*.json` | Syllabus per track (modules → topics) |
| `scripts/` | `import-seed` (prunes only `origin='seed'` rows), `backup` (all tables → `backups/`), `set-password`, `make-icons` (PWA PNGs) |
| `supabase/migrations/`, `supabase/rollback/` | Schema, RLS, RPCs; a down script per migration |
| `src/lib/plan.ts` | `assignDay` (counts + time budget), `planRegeneration` (diff), `overdueItems`, `reorderGroup`, `previewDays` |
| `src/lib/pace.ts` | Per-track pace vs exam date; overall on-track status |
| `src/lib/stats.ts` | The one "completed on day" selector, streak rule, heatmap |
| `src/lib/revision.ts` | Spaced-revision scheduling |
| `src/lib/review.ts` | Weekly summary, weakest track |
| `src/lib/csv.ts`, `backup.ts`, `markdown.tsx`, `search.ts` | CSV import parsing, JSON import validation (zod), safe Markdown (no innerHTML), search ranking |
| `src/lib/data.ts` | Every Supabase read/write |
| `src/lib/catalogStore.ts` | Shared catalog cache (stale-while-revalidate, 60s; race-safe) |
| `src/lib/useCatalog.ts` | Catalog + shared topic actions (tick with Undo, confidence, review, drawer) |
| `src/lib/toast.ts` + `components/Toaster.tsx` | Undo/info toasts |
| `src/components/` | `Layout`, `TopicRow`, `TopicDrawer`, `PlanControls` (menu/add/subject), `SearchPalette`, `WeeklyReview`, `CsvImport`, `ui.tsx` primitives |
| `src/pages/` | Dashboard (`/`), Today, Tracks, TrackDetail, Week, Revision, Settings, Login |

## Files that matter most
1. `src/lib/plan.ts` — what goes on each day.
2. `src/lib/useCatalog.ts` + `catalogStore.ts` — shared state; every tick goes through here.
3. `src/lib/data.ts` — all queries and RPC calls.
4. `supabase/migrations/20261013000000_carry_over.sql` — `save_day_plan` / add / defer semantics.
5. `supabase/migrations/20261022000000_harden_access.sql` — grants and ownership policies.
6. `src/pages/Today.tsx` — the daily flow.

## Data model
- `tracks` 1─* `modules` 1─* `topics` (text PKs from the seed; `origin` = seed | app).
- `topics`: `done_at`, `revision` (starred), `confidence`, `last_reviewed_at`, `est_minutes`, `notes`, `links` (http(s) only, DB-checked), `practice_done`.
- `revisions` (1 per topic): `due_date`, `interval_step`.
- `schedule_blocks`: weekday, track or checklist label, `topics`, `minutes`.
- `day_plans` (one per date; `generated_at` null = holds only added/deferred items) 1─* `day_plan_items` (`manual`, `deferred_to`, `track_id` for PYQ subject).
- `user_settings` (streak thresholds, daily budgets), `weekly_reviews` (reflection + summary snapshot).
- `sessions` + view `topic_spent`: legacy, unused, kept (no data deleted).

## Key decisions
See [DECISIONS.md](DECISIONS.md).

## Rough edges / ponytail ceilings
- Catalog selects rely on the 1000-row API cap (~200 topics now); plan history is paged.
- Search is a linear scan per keystroke; fine to a few thousand docs.
- JSON import isn't one transaction (idempotent upserts, safe to re-run).
- Drag reorder is mouse-only; touch uses the menu / keyboard.
- Carry-over looks back 30 days; checklist items don't carry over.
- No error tracking (Sentry): personal app, errors surface in the banner/toasts.
