import { supabase } from './supabase'
import type { Tables } from './database.types'
import { weekdayOf } from './date'
import { assignDay, keptByBlock, type PlanBlock, type PlanItem, type PlanTopic } from './plan'

export type Track = Tables<'tracks'>
export type Module = Tables<'modules'>
export type Block = Tables<'schedule_blocks'>
export type Item = Tables<'day_plan_items'>
export type Topic = PlanTopic & {
  title: string
  moduleId: string
  moduleName: string
  bloom: string | null
  revision: boolean
  doneAt: string | null
}
export type Catalog = {
  tracks: Track[]
  modules: Module[]
  topics: Topic[]
  topicById: Map<string, Topic>
  blocks: Block[]
}

function rows<T>(res: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data ?? []
}
function ok(res: { error: { message: string } | null }, what: string): void {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
}

// ponytail: plain selects cap at the API's 1000-row limit; fine for ~300 topics, paginate if the syllabus grows past that.
export async function loadCatalog(): Promise<Catalog> {
  const [t, m, tp, b] = await Promise.all([
    supabase.from('tracks').select('*').order('sort_order'),
    supabase.from('modules').select('*').order('sort_order'),
    supabase.from('topics').select('*').order('sort_order'),
    supabase.from('schedule_blocks').select('*').order('weekday').order('sort_order'),
  ])
  const tracks = rows(t, 'load tracks')
  const modules = rows(m, 'load modules')
  const topicRows = rows(tp, 'load topics')
  const blocks = rows(b, 'load schedule')
  // a missing count means the DB is behind the code; fail loudly instead of rendering NaN as "Not scheduled"
  const uncounted = blocks.find((x) => !Number.isInteger(x.topics))
  if (uncounted) throw new Error(`schedule block ${uncounted.id} has no topic count: apply the latest supabase/migrations`)

  const moduleById = new Map(modules.map((x) => [x.id, x]))

  const topics: Topic[] = []
  for (const x of topicRows) {
    const mod = moduleById.get(x.module_id)
    if (!mod) throw new Error(`topic ${x.id} references missing module ${x.module_id}`)
    topics.push({
      id: x.id,
      trackId: mod.track_id,
      moduleOrder: mod.sort_order,
      order: x.sort_order,
      done: x.done_at !== null,
      title: x.title,
      moduleId: mod.id,
      moduleName: mod.name,
      bloom: x.bloom,
      revision: x.revision,
      doneAt: x.done_at,
    })
  }
  topics.sort((a, b) => a.moduleOrder - b.moduleOrder || a.order - b.order)
  return { tracks, modules, topics, topicById: new Map(topics.map((x) => [x.id, x])), blocks }
}

const toPlanBlock = (b: Block): PlanBlock => ({
  id: b.id,
  trackId: b.track_id,
  label: b.label,
  topics: b.topics,
  sortOrder: b.sort_order,
})

export function blocksFor(cat: Catalog, date: string): PlanBlock[] {
  const wd = weekdayOf(date)
  return cat.blocks.filter((b) => b.weekday === wd).map(toPlanBlock)
}

/** Topics per week the schedule gives a track (all tracks when omitted). */
export function weeklyTopics(cat: Catalog, trackId?: string): number {
  return cat.blocks.reduce((sum, b) => (b.track_id !== null && (trackId === undefined || b.track_id === trackId) ? sum + b.topics : sum), 0)
}

const toRpcItems =(items: PlanItem[]) =>
  items.map((i) => ({ block_id: i.blockId, topic_id: i.topicId, label: i.label, sort_order: i.sortOrder }))

export async function loadItems(date: string): Promise<Item[]> {
  return rows(await supabase.from('day_plan_items').select('*').eq('date', date).order('sort_order'), 'load plan')
}

/** Generates and freezes the plan on first open of `date`; afterwards just loads it. */
export async function ensureDayPlan(cat: Catalog, date: string): Promise<Item[]> {
  const existing = await supabase.from('day_plans').select('date').eq('date', date).maybeSingle()
  if (existing.error) throw new Error(`load day plan: ${existing.error.message}`)
  if (!existing.data) {
    const items = assignDay(blocksFor(cat, date), cat.topics)
    // false = another tab created it first; loading below picks that up
    ok(await supabase.rpc('save_day_plan', { p_date: date, p_items: toRpcItems(items), p_replace: false }), 'save plan')
  }
  return loadItems(date)
}

/** Drops undone items for `date` and re-runs assignment around the done ones. */
export async function regenerateDay(cat: Catalog, date: string, current: Item[]): Promise<Item[]> {
  const kept = current.filter((i) => i.done_at !== null)
  const exclude = new Set(kept.flatMap((i) => (i.topic_id ? [i.topic_id] : [])))
  const keptCount = keptByBlock(kept.map((i) => ({ blockId: i.block_id, topicId: i.topic_id })))
  const offset = Math.max(-1, ...kept.map((i) => i.sort_order)) + 1
  const items = assignDay(blocksFor(cat, date), cat.topics, { exclude, kept: keptCount }).map((i) => ({
    ...i,
    sortOrder: i.sortOrder + offset,
  }))
  ok(await supabase.rpc('save_day_plan', { p_date: date, p_items: toRpcItems(items), p_replace: true }), 'regenerate plan')
  return loadItems(date)
}

/** Returns the new done_at. A DB trigger mirrors it onto today's plan item. */
export async function setTopicDone(topicId: string, done: boolean): Promise<string | null> {
  const doneAt = done ? new Date().toISOString() : null
  ok(await supabase.from('topics').update({ done_at: doneAt }).eq('id', topicId), 'update topic')
  return doneAt
}

export async function setItemDone(itemId: number, done: boolean): Promise<string | null> {
  const doneAt = done ? new Date().toISOString() : null
  ok(await supabase.from('day_plan_items').update({ done_at: doneAt }).eq('id', itemId), 'update item')
  return doneAt
}

export async function setRevision(topicId: string, revision: boolean): Promise<void> {
  ok(await supabase.from('topics').update({ revision }).eq('id', topicId), 'update star')
}

/** Saved plan items for a date range, keyed by date; dates without a saved plan are absent. */
export async function loadPlansBetween(from: string, to: string): Promise<Map<string, Item[]>> {
  const [plans, items] = await Promise.all([
    supabase.from('day_plans').select('date').gte('date', from).lte('date', to),
    supabase.from('day_plan_items').select('*').gte('date', from).lte('date', to).order('sort_order'),
  ])
  const out = new Map<string, Item[]>(rows(plans, 'load week plans').map((p) => [p.date, []]))
  for (const i of rows(items, 'load week items')) out.get(i.date)?.push(i)
  return out
}

/** Mirrors the schedule_blocks_topics_check constraint. */
export const MAX_BLOCK_TOPICS = 20

export async function addBlock(weekday: number, trackId: string | null, sortOrder: number): Promise<Block> {
  const res = await supabase
    .from('schedule_blocks')
    .insert({ weekday, track_id: trackId, label: trackId ? null : 'Study block', sort_order: sortOrder })
    .select()
    .single()
  if (res.error) throw new Error(`add block: ${res.error.message}`)
  return res.data
}

export async function updateBlock(
  id: number,
  patch: Partial<Pick<Block, 'track_id' | 'label' | 'topics' | 'sort_order'>>,
): Promise<void> {
  if (patch.topics !== undefined && (!Number.isInteger(patch.topics) || patch.topics < 1 || patch.topics > MAX_BLOCK_TOPICS))
    throw new Error(`topics must be a whole number between 1 and ${MAX_BLOCK_TOPICS}`)
  ok(await supabase.from('schedule_blocks').update(patch).eq('id', id), 'update block')
}

export async function deleteBlock(id: number): Promise<void> {
  ok(await supabase.from('schedule_blocks').delete().eq('id', id), 'remove block')
}

const EXPORT_TABLES = [
  ['tracks', 'id'],
  ['modules', 'id'],
  ['topics', 'id'],
  ['schedule_blocks', 'id'],
  ['day_plans', 'date'],
  ['day_plan_items', 'id'],
] as const

/** Every table, paged past the API row cap. */
export async function exportAll(): Promise<Record<string, unknown[]>> {
  const PAGE = 1000
  const out: Record<string, unknown[]> = {}
  for (const [table, orderBy] of EXPORT_TABLES) {
    const all: unknown[] = []
    for (let from = 0; ; from += PAGE) {
      const page = rows(
        await supabase.from(table).select('*').order(orderBy).range(from, from + PAGE - 1),
        `export ${table}`,
      )
      all.push(...page)
      if (page.length < PAGE) break
    }
    out[table] = all
  }
  return out
}
