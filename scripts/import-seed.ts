// Idempotent seed import: upserts tracks/modules/topics only. Never touches progress, sessions or plans.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, TablesInsert } from '../src/lib/database.types'

const TRACK_FILES = ['prob-stats', 'dbms', 'cn', 'micro-econ', 'ops-research', 'dsa', 'applied-ai']

const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    IMPORT_USER_EMAIL: z.email(),
  })
  .parse(process.env)

const Topic = z.object({
  id: z.string().min(1),
  order: z.number().int(),
  title: z.string().min(1),
  bloom: z.string().nullish(),
})
const Module = z.object({
  id: z.string().min(1),
  order: z.number().int(),
  name: z.string().min(1),
  co: z.string().nullish(),
  estMinutes: z.number().int().positive().nullable(),
  topics: z.array(Topic),
})
const Track = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  courseCode: z.string().nullish(),
  modules: z.array(Module),
})

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
  if (!user) throw new Error(`No auth user ${email}. Sign in once via magic link, then re-run.`)
  return user.id
}

function loadTracks() {
  return TRACK_FILES.map((name) => {
    const file = join('seed', `${name}.json`)
    const parsed = Track.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    if (!parsed.success) throw new Error(`${file} invalid:\n${z.prettifyError(parsed.error)}`)
    return parsed.data
  })
}

function defaultSchedule(userId: string): TablesInsert<'schedule_blocks'>[] {
  // weekday: 0 = Sunday … 6 = Saturday
  const rows: [number, string | null, string | null, number][] = [
    [1, 'dsa', null, 75],
    [2, 'ops-research', null, 145],
    [3, 'cn', null, 100],
    [3, 'dbms', null, 90],
    [3, 'prob-stats', null, 120],
    [4, 'dsa', null, 75],
    [4, 'micro-econ', null, 120],
    [5, 'dbms', null, 90],
    [5, 'applied-ai', null, 90],
    [5, 'cn', null, 120],
    [6, null, 'PYQs (weakest subject)', 180],
    [0, null, 'Weekly review', 30],
  ]
  return rows.map(([weekday, track_id, label, minutes], i) => ({
    user_id: userId,
    weekday,
    track_id,
    label,
    minutes,
    sort_order: i,
  }))
}

async function main() {
  const tracks = loadTracks()
  const userId = await findUserId(env.IMPORT_USER_EMAIL)

  const trackRows: TablesInsert<'tracks'>[] = tracks.map((t, i) => ({
    id: t.id,
    user_id: userId,
    name: t.name,
    type: t.type,
    course_code: t.courseCode ?? null,
    sort_order: i,
  }))
  const allModules = tracks.flatMap((t) =>
    t.modules.map((m) => ({
      id: m.id,
      user_id: userId,
      track_id: t.id,
      sort_order: m.order,
      name: m.name,
      co: m.co ?? null,
      est: m.estMinutes,
    })),
  )
  // Split so a null seed estimate never overwrites an estimate edited in the app.
  const modulesWithEst: TablesInsert<'modules'>[] = allModules
    .filter((m) => m.est !== null)
    .map(({ est, ...m }) => ({ ...m, est_minutes: est }))
  const modulesNoEst: TablesInsert<'modules'>[] = allModules
    .filter((m) => m.est === null)
    .map(({ est: _est, ...m }) => m)
  const topicRows: TablesInsert<'topics'>[] = tracks.flatMap((t) =>
    t.modules.flatMap((m) =>
      m.topics.map((tp) => ({
        id: tp.id,
        user_id: userId,
        module_id: m.id,
        sort_order: tp.order,
        title: tp.title,
        bloom: tp.bloom ?? null,
      })),
    ),
  )

  ok(await db.from('tracks').upsert(trackRows, { onConflict: 'id' }), 'upsert tracks')
  if (modulesWithEst.length)
    ok(await db.from('modules').upsert(modulesWithEst, { onConflict: 'id' }), 'upsert modules (est)')
  if (modulesNoEst.length)
    ok(await db.from('modules').upsert(modulesNoEst, { onConflict: 'id' }), 'upsert modules')
  ok(await db.from('topics').upsert(topicRows, { onConflict: 'id' }), 'upsert topics')

  const seedTopicIds = new Set(topicRows.map((t) => t.id))
  const dbTopics = await db.from('topics').select('id').eq('user_id', userId)
  ok(dbTopics, 'select topics')
  const orphans = (dbTopics.data ?? []).filter((t) => !seedTopicIds.has(t.id)).map((t) => t.id)
  if (orphans.length) console.warn(`Orphan topics (in DB, not in seed; left untouched): ${orphans.join(', ')}`)

  const blocks = await db
    .from('schedule_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (blocks.error || blocks.count === null)
    throw new Error(`count schedule_blocks: ${JSON.stringify(blocks.error)}`)
  if (blocks.count === 0) {
    ok(await db.from('schedule_blocks').insert(defaultSchedule(userId)), 'insert default schedule')
    console.log('Inserted default schedule.')
  }

  console.log(
    `Upserted ${trackRows.length} tracks, ${allModules.length} modules (${modulesWithEst.length} with est), ${topicRows.length} topics.`,
  )
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
