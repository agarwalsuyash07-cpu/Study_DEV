// Idempotent seed import: upserts tracks/modules/topics, prunes seed-origin ones dropped from the seed that have no progress.
// Rows created in the app (origin = 'app': CSV imports, Applied AI) are never pruned. Never touches done/starred topics, plans or the schedule.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, TablesInsert } from '../src/lib/database.types'

// applied-ai paused: seed/applied-ai.json is kept; add it back here to restore the track.
const TRACK_FILES = ['prob-stats', 'dbms', 'cn', 'micro-econ', 'ops-research', 'dsa']

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
  if (!user) throw new Error(`No auth user ${email}. Run 'npm run set-password' first, then re-run.`)
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
  // [weekday, track, checklist label, topics]
  const rows: [number, string | null, string | null, number][] = [
    [1, 'dsa', null, 1],
    [2, 'ops-research', null, 2],
    [3, 'cn', null, 2],
    [3, 'dbms', null, 2],
    [3, 'prob-stats', null, 2],
    [4, 'dsa', null, 1],
    [4, 'micro-econ', null, 2],
    [5, 'dbms', null, 2],
    [5, 'cn', null, 2],
    [6, null, 'PYQs (weakest subject)', 1],
    [0, null, 'Weekly review', 1],
  ]
  return rows.map(([weekday, track_id, label, topics], i) => ({
    user_id: userId,
    weekday,
    track_id,
    label,
    topics,
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
  const moduleRows: TablesInsert<'modules'>[] = tracks.flatMap((t) =>
    t.modules.map((m) => ({
      id: m.id,
      user_id: userId,
      track_id: t.id,
      sort_order: m.order,
      name: m.name,
      co: m.co ?? null,
    })),
  )
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

  ok(await db.from('tracks').upsert(trackRows.map((r) => ({ ...r, origin: 'seed' })), { onConflict: 'id' }), 'upsert tracks')
  ok(await db.from('modules').upsert(moduleRows.map((r) => ({ ...r, origin: 'seed' })), { onConflict: 'id' }), 'upsert modules')
  ok(await db.from('topics').upsert(topicRows.map((r) => ({ ...r, origin: 'seed' })), { onConflict: 'id' }), 'upsert topics')

  // Topics/modules dropped from the seed are deleted, unless they carry progress (done or starred).
  const seedTopicIds = new Set(topicRows.map((t) => t.id))
  const dbTopics = await db.from('topics').select('id, done_at, revision').eq('user_id', userId).eq('origin', 'seed')
  ok(dbTopics, 'select topics')
  const orphans = (dbTopics.data ?? []).filter((t) => !seedTopicIds.has(t.id))
  if (orphans.length) {
    const kept = orphans.filter((t) => t.done_at !== null || t.revision).map((t) => t.id)
    const dropped = orphans.map((t) => t.id).filter((id) => !kept.includes(id))
    if (dropped.length) ok(await db.from('topics').delete().in('id', dropped), 'delete orphan topics')
    console.log(`Removed ${dropped.length} topics no longer in the seed.`)
    if (kept.length) console.warn(`Kept (not in seed but have progress): ${kept.join(', ')}`)
  }

  const seedModuleIds = new Set(moduleRows.map((m) => m.id))
  const dbModules = await db.from('modules').select('id').eq('user_id', userId).eq('origin', 'seed')
  ok(dbModules, 'select modules')
  const orphanModules = (dbModules.data ?? []).map((m) => m.id).filter((id) => !seedModuleIds.has(id))
  if (orphanModules.length) {
    const left = await db.from('topics').select('module_id').in('module_id', orphanModules)
    ok(left, 'select orphan module topics')
    const inUse = new Set((left.data ?? []).map((t) => t.module_id))
    const emptyModules = orphanModules.filter((id) => !inUse.has(id))
    if (emptyModules.length) ok(await db.from('modules').delete().in('id', emptyModules), 'delete orphan modules')
    console.log(`Removed ${emptyModules.length} empty modules no longer in the seed.`)
  }

  // A track dropped from TRACK_FILES goes once it has no modules left, with its schedule blocks
  // (the FK would otherwise null them into unlabelled blocks).
  const seedTrackIds = new Set(trackRows.map((t) => t.id))
  const dbTracks = await db.from('tracks').select('id').eq('user_id', userId).eq('origin', 'seed')
  ok(dbTracks, 'select tracks')
  const orphanTracks = (dbTracks.data ?? []).map((t) => t.id).filter((id) => !seedTrackIds.has(id))
  if (orphanTracks.length) {
    const left = await db.from('modules').select('track_id').in('track_id', orphanTracks)
    ok(left, 'select orphan track modules')
    const inUse = new Set((left.data ?? []).map((m) => m.track_id))
    const emptyTracks = orphanTracks.filter((id) => !inUse.has(id))
    if (emptyTracks.length) {
      ok(await db.from('schedule_blocks').delete().in('track_id', emptyTracks), 'delete orphan track blocks')
      ok(await db.from('tracks').delete().in('id', emptyTracks), 'delete orphan tracks')
    }
    console.log(`Removed tracks no longer in the seed: ${emptyTracks.join(', ') || 'none'}.`)
    const kept = orphanTracks.filter((id) => inUse.has(id))
    if (kept.length) console.warn(`Kept tracks (not in seed but still have topics with progress): ${kept.join(', ')}`)
  }

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
    `Upserted ${trackRows.length} tracks, ${moduleRows.length} modules, ${topicRows.length} topics.`,
  )
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
