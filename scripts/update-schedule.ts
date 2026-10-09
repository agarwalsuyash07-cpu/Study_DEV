// Replaces all schedule blocks with the updated weekly timetable and sets FAT exam dates.
// Run: npm run update-schedule (needs .env.local with service-role key)
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, TablesInsert } from '../src/lib/database.types'

const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    IMPORT_USER_EMAIL: z.email(),
  })
  .parse(process.env)

const db = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

function ok(res: { error: unknown }, what: string): void {
  if (res.error) throw new Error(`${what}: ${JSON.stringify(res.error)}`)
}

async function findUserId(email: string): Promise<string> {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw new Error(`listUsers: ${error.message}`)
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`No auth user ${email}. Run 'npm run set-password' first.`)
  return user.id
}

// Track IDs match the seed file names
const TRACK = {
  micro: 'micro-econ',
  dbs: 'dbms',
  or: 'ops-research',
  cn: 'cn',
  ps: 'prob-stats',
} as const

// FAT exam dates
const EXAM_DATES: Record<string, string> = {
  [TRACK.dbs]: '2026-11-13',
  [TRACK.cn]: '2026-11-15',
  [TRACK.or]: '2026-11-24',
  [TRACK.ps]: '2026-11-26',
  [TRACK.micro]: '2026-11-30',
}

function buildSchedule(userId: string): TablesInsert<'schedule_blocks'>[] {
  // weekday: 0 = Sunday, 1 = Monday … 6 = Saturday
  // [weekday, track_id | null, label | null, topics, minutes]
  const rows: [number, string | null, string | null, number, number][] = [
    // Monday
    [1, TRACK.micro, null, 3, 180],
    [1, TRACK.dbs, null, 3, 180],
    [1, null, 'Revision', 1, 90],

    // Tuesday
    [2, TRACK.or, null, 3, 180],
    [2, TRACK.micro, null, 3, 180],
    [2, null, 'Revision', 1, 90],

    // Wednesday
    [3, TRACK.cn, null, 3, 180],
    [3, TRACK.ps, null, 3, 180],
    [3, null, 'Revision', 1, 90],

    // Thursday
    [4, TRACK.dbs, null, 3, 180],
    [4, TRACK.or, null, 3, 180],
    [4, null, 'Revision', 1, 90],

    // Friday
    [5, TRACK.ps, null, 3, 200],
    [5, TRACK.cn, null, 4, 240],
    [5, null, 'Revision', 1, 90],

    // Saturday (revision day: Micro, DBS, OR)
    [6, TRACK.micro, null, 3, 180],
    [6, TRACK.dbs, null, 3, 180],
    [6, TRACK.or, null, 3, 180],
    [6, null, 'Revision', 1, 90],

    // Sunday (revision day: P&S, CN, Micro)
    [0, TRACK.ps, null, 3, 180],
    [0, TRACK.cn, null, 3, 180],
    [0, TRACK.micro, null, 3, 180],
    [0, null, 'Revision', 1, 90],
  ]

  return rows.map(([weekday, track_id, label, topics, minutes], i) => ({
    user_id: userId,
    weekday,
    track_id,
    label,
    topics,
    minutes,
    sort_order: i,
  }))
}

async function main() {
  const userId = await findUserId(env.IMPORT_USER_EMAIL)
  console.log(`User: ${env.IMPORT_USER_EMAIL} (${userId})`)

  // 1. Verify tracks exist
  const { data: tracks, error: trackErr } = await db.from('tracks').select('id, name').eq('user_id', userId)
  if (trackErr) throw new Error(`fetch tracks: ${trackErr.message}`)
  const trackById = new Map((tracks ?? []).map((t) => [t.id, t.name]))
  for (const [key, id] of Object.entries(TRACK)) {
    if (!trackById.has(id)) throw new Error(`Track "${key}" (${id}) not found. Run 'npm run import' first.`)
  }
  console.log('Tracks verified:', [...trackById.entries()].map(([id, name]) => `${name} (${id})`).join(', '))

  // 2. Delete all existing schedule blocks
  const del = await db.from('schedule_blocks').delete().eq('user_id', userId)
  ok(del, 'delete schedule blocks')
  console.log('Deleted all existing schedule blocks.')

  // 3. Insert new blocks
  const blocks = buildSchedule(userId)
  ok(await db.from('schedule_blocks').insert(blocks), 'insert schedule blocks')
  console.log(`Inserted ${blocks.length} schedule blocks.`)

  // 4. Set FAT exam dates
  for (const [trackId, examDate] of Object.entries(EXAM_DATES)) {
    ok(await db.from('tracks').update({ exam_date: examDate }).eq('id', trackId), `set exam date ${trackId}`)
    console.log(`  ${trackById.get(trackId)} → exam ${examDate}`)
  }

  console.log('\nDone! Open the app and use "Regenerate today" to apply the new schedule to today\'s plan.')
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
