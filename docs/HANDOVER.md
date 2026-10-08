# Handover

How it's built and why: [ARCHITECTURE.md](ARCHITECTURE.md) · decisions: [DECISIONS.md](DECISIONS.md).

## Current state
- **Works:** magic-link login; Dashboard (`/`: KPIs, streak, 26-week study heatmap, track progress, today snapshot, recent completions); Today (`/today`: auto-assigned plan, timer, manual minutes, regenerate); Tracks + TrackDetail (progress, estimates, est. finish); Week (saved days + forecast); Revision (starred topics); Settings (schedule editor, JSON export).
- **Not done:** no error tracking, no CI, no Vercel project linked yet (only the `vercel.json` SPA rewrite).

## Run locally
1. `npm install`
2. Copy `.env.example` → `.env.local` and fill it in (Supabase URL + anon key for the browser; service-role key + `IMPORT_USER_EMAIL` for the import script only).
3. Log in once via the app so your user exists, then `npm run import` to load `seed/*.json` (idempotent, safe to re-run).
4. `npm run dev` → http://localhost:3000 (port is fixed to match Supabase's default auth Site URL).

## Deploy
- Target: Vercel static hosting (`npm run build` → `dist/`). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel env; **never** the service-role key.
- Add the deployed URL to Supabase Auth → URL configuration, or magic links will redirect to localhost.
- Migrations live in `supabase/migrations/` and are applied to the remote project (no local Docker stack). Rollback: run the matching file in `supabase/rollback/` by hand.
- Roll back a frontend deploy by promoting the previous Vercel deployment.

## Tests and gates
- `npm test`: vitest, pure logic (`plan`, `date`, `format`, `stats`).
- `npm run build`: `tsc --noEmit` + Vite build. The >500 kB chunk warning is known and harmless at this size.

## Open threads
- Wire Sentry (or equivalent) if this ever gets a second user.
- Code-split routes if bundle size starts to matter.

## Gotchas
- All dates are IST `YYYY-MM-DD` strings (`src/lib/date.ts`); don't use `new Date().toISOString()` for "today".
- Opening `/today` freezes that day's plan (`ensureDayPlan`); the Dashboard deliberately only reads it.
- Marking a topic done is mirrored onto today's plan item by a DB trigger. Don't duplicate that sync in the client.
- `.env.local` holds the service-role key and is gitignored. Keep it that way.
