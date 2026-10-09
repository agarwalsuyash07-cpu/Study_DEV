# Handover

How it's built and why: [ARCHITECTURE.md](ARCHITECTURE.md) · decisions: [DECISIONS.md](DECISIONS.md) · what changed: [../CHANGELOG.md](../CHANGELOG.md).

## Current state
- **Works:** login; Dashboard (pace banner, KPIs, streak, heatmap, track pace); Today (plan, overdue, defer/add/reorder, safe Regenerate with diff, time budget, also-done, PYQ subject, weekly review on Sundays); Tracks / TrackDetail (pace, exam date, CSV import, search jump); Week (edit any day, backfill, weekly review); Revision (due/upcoming/starred); Settings (schedule editor, streak rule, budgets, tracks, JSON export/import); topic drawer; Ctrl/Cmd+K search; Undo toasts; PWA install.
- **Not done:** offline mode (no service worker), touch drag reorder, error tracking, CI.

## Run locally
1. `npm install`
2. Copy `.env.example` → `.env.local` (browser: URL + anon key; scripts only: service-role key + `IMPORT_USER_EMAIL`).
3. `npm run set-password`, then `npm run import` (idempotent; never prunes app-created rows).
4. `npm run dev` → http://localhost:3000.

## Deploy
- Vercel static hosting from `main`. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel, then redeploy. **Never** put the service-role key in Vercel.
- Supabase Auth: Email on, sign-ups **off**; turn on **leaked-password protection** (advisor warning, dashboard toggle).
- Migrations are applied to the remote project (no local Docker). Rollback: run the matching `supabase/rollback/*.down.sql` by hand. Take `npm run backup` first.
- Frontend rollback: promote the previous Vercel deployment.

## Tests and gates
- `npm run check` = lint (oxlint) + tests (vitest, 99) + `tsc --noEmit` + build.
- Security probe: with only the anon key, every table/RPC must return 401 (see CHANGELOG, item 16).

## Open threads
- Wire Sentry (or similar) if a second user ever appears.
- Service worker for offline use, if wanted.
- Pointer-events drag for touch reorder, if the menu isn't enough.

## Gotchas
- Dates are IST `YYYY-MM-DD` strings (`src/lib/date.ts`); never `toISOString()` for "today".
- Opening `/today` generates that day's plan if it isn't generated yet; the Dashboard and Week only read.
- The done-sync trigger marks the plan item on the **completion day**; don't duplicate that in the client.
- `schedule_blocks.topics` must exist: the live DB once lacked it (unapplied migration) and every pace read NaN. `loadCatalog` now throws if it's missing.
- `database.types.ts` is maintained by hand to match the live schema; update it with every migration.
- New Postgres functions need an explicit `grant execute ... to authenticated` (default EXECUTE was revoked in `harden_access`).
- `.env.local` holds the service-role key and is gitignored. Keep it that way.
