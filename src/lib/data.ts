import { supabase } from './supabase'
import type { Tables, TablesUpdate } from './database.types'
import { addDays, weekdayOf } from './date'
import type { TopicCsvRow } from './csv'
import { safeUrl } from './markdown'
import { trackPace, type Pace } from './pace'
import { isDue, type Confidence, type ReviewState } from './revision'
import type { WeekSummary } from './review'
import { activeDays, completionsByDay, streaks } from './stats'
import { assignDay, planRegeneration, type DayItem, type PlanBlock, type PlanItem, type PlanTopic } from './plan'

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
  confidence: Confidence | null
  lastReviewedAt: string | null
  /** Minutes this topic is expected to take: its own estimate, else derived (see estimateMinutes). */
  estMinutes: number
  /** The topic's own estimate, null when derived. */
  estOverride: number | null
  /** What the estimate would be without an override. */
  estDerived: number
  notes: string
  links: string[]
  practiceDone: boolean
}
export type Settings = Omit<Tables<'user_settings'>, 'user_id' | 'updated_at'>
/** Mirrors the column defaults in user_settings; used until the first save creates the row. */
export const DEFAULT_SETTINGS: Settings = { streak_plan_pct: 50, streak_min_no_plan: 3, daily_budget: null }

// fallback minutes by Bloom tag when the module has no estimate
const BLOOM_MINUTES: Record<string, number> = { Remember: 30, Understand: 40, Apply: 60, Analyze: 60, Evaluate: 75, Create: 90 }
export const DEFAULT_TOPIC_MINUTES = 45

/** Topic estimate: its own, else its module's estimate split across the module's topics, else by Bloom tag, else 45. */
export function estimateMinutes(own: number | null, moduleMinutes: number | null, moduleTopics: number, bloom: string | null): number {
  if (own) return own
  if (moduleMinutes && moduleTopics > 0) return Math.max(5, Math.round(moduleMinutes / moduleTopics))
  return (bloom && BLOOM_MINUTES[bloom]) || DEFAULT_TOPIC_MINUTES
}

export type Catalog = {
  tracks: Track[]
  modules: Module[]
  topics: Topic[]
  topicById: Map<string, Topic>
  blocks: Block[]
  settings: Settings
  /** Review schedule per topic; topics never completed have no entry. */
  revisions: Map<string, ReviewState>
}

const toConfidence = (n: number | null): Confidence | null => (n === 1 || n === 2 || n === 3 ? n : null)

function rows<T>(res: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data ?? []
}
function ok(res: { error: { message: string } | null }, what: string): void {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
}

// ponytail: plain selects cap at the API's 1000-row limit; fine for ~300 topics, paginate if the syllabus grows past that.
export async function loadCatalog(): Promise<Catalog> {
  const [t, m, tp, b, s, r] = await Promise.all([
    supabase.from('tracks').select('*').order('sort_order'),
    supabase.from('modules').select('*').order('sort_order'),
    supabase.from('topics').select('*').order('sort_order'),
    supabase.from('schedule_blocks').select('*').order('weekday').order('sort_order'),
    supabase.from('user_settings').select('*').maybeSingle(),
    supabase.from('revisions').select('topic_id, due_date, interval_step'),
  ])
  if (s.error) throw new Error(`load settings: ${s.error.message}`)
  const { user_id: _u, updated_at: _at, ...saved } = s.data ?? { user_id: '', updated_at: '', ...DEFAULT_SETTINGS }
  const settings: Settings = { ...DEFAULT_SETTINGS, ...saved }
  const tracks = rows(t, 'load tracks')
  const modules = rows(m, 'load modules')
  const topicRows = rows(tp, 'load topics')
  const blocks = rows(b, 'load schedule')
  // a missing count means the DB is behind the code; fail loudly instead of rendering NaN as "Not scheduled"
  const uncounted = blocks.find((x) => !Number.isInteger(x.topics))
  if (uncounted) throw new Error(`schedule block ${uncounted.id} has no topic count: apply the latest supabase/migrations`)

  const moduleById = new Map(modules.map((x) => [x.id, x]))
  const perModule = new Map<string, number>()
  for (const x of topicRows) perModule.set(x.module_id, (perModule.get(x.module_id) ?? 0) + 1)

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
      confidence: toConfidence(x.confidence),
      lastReviewedAt: x.last_reviewed_at,
      estMinutes: estimateMinutes(x.est_minutes, mod.est_minutes, perModule.get(mod.id) ?? 0, x.bloom),
      estOverride: x.est_minutes,
      estDerived: estimateMinutes(null, mod.est_minutes, perModule.get(mod.id) ?? 0, x.bloom),
      notes: x.notes ?? '',
      links: x.links,
      practiceDone: x.practice_done,
    })
  }
  topics.sort((a, b) => a.moduleOrder - b.moduleOrder || a.order - b.order)
  const revisions = new Map(rows(r, 'load revisions').map((x) => [x.topic_id, { dueDate: x.due_date, step: x.interval_step }]))
  return { tracks, modules, topics, topicById: new Map(topics.map((x) => [x.id, x])), blocks, settings, revisions }
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

const toRpcItems = (items: PlanItem[]) =>
  items.map((i) => ({ block_id: i.blockId, topic_id: i.topicId, label: i.label, sort_order: i.sortOrder }))

export async function loadItems(date: string): Promise<Item[]> {
  return rows(await supabase.from('day_plan_items').select('*').eq('date', date).order('sort_order'), 'load plan')
}

/** Generates and freezes the plan on first open of `date`; afterwards just loads it. */
export async function ensureDayPlan(cat: Catalog, date: string): Promise<Item[]> {
  const existing = await supabase.from('day_plans').select('generated_at').eq('date', date).maybeSingle()
  if (existing.error) throw new Error(`load day plan: ${existing.error.message}`)
  if (!existing.data || existing.data.generated_at === null) {
    // the day may already hold deferred or hand-added items; don't plan those topics twice
    const held = existing.data ? await loadItems(date) : []
    const exclude = new Set(held.flatMap((i) => (i.topic_id ? [i.topic_id] : [])))
    // hand-added / deferred-in topics already use part of the day's budget
    const used = held.reduce((n, i) => (i.topic_id && i.deferred_to === null ? n + (cat.topicById.get(i.topic_id)?.estMinutes ?? 0) : n), 0)
    const items = assignDay(blocksFor(cat, date), cat.topics, { exclude, budget: { ...budgetOf(cat, date), used } })
    // false = another tab generated it first; loading below picks that up
    ok(await supabase.rpc('save_day_plan', { p_date: date, p_items: toRpcItems(items), p_replace: false }), 'save plan')
  }
  return loadItems(date)
}

/** Pure-planner view of a saved item; topic items count as done when the topic is. */
export const toDayItem = (cat: Catalog, i: Item): DayItem => ({
  id: i.id,
  date: i.date,
  blockId: i.block_id,
  topicId: i.topic_id,
  label: i.label,
  sortOrder: i.sort_order,
  done: i.topic_id ? (cat.topicById.get(i.topic_id)?.done ?? false) : i.done_at !== null,
  manual: i.manual,
  deferredTo: i.deferred_to,
})

/** Dry run of "Regenerate": nothing is saved. `ignoreBudget` is the explicit override. */
export const previewRegeneration = (cat: Catalog, date: string, current: Item[], ignoreBudget = false) =>
  planRegeneration(
    blocksFor(cat, date),
    cat.topics,
    current.map((i) => toDayItem(cat, i)),
    ignoreBudget ? undefined : budgetOf(cat, date),
  )

/** Saves a confirmed regeneration. The RPC keeps done, hand-added and deferred items and appends after them. */
export async function saveRegeneration(date: string, items: PlanItem[]): Promise<Item[]> {
  ok(await supabase.rpc('save_day_plan', { p_date: date, p_items: toRpcItems(items), p_replace: true }), 'regenerate plan')
  return loadItems(date)
}

/** Adds a topic or free-text item to `date`. Returns false if that topic is already planned there. */
export async function addPlanItem(date: string, topicId: string | null, label: string | null): Promise<boolean> {
  const res = await supabase.rpc('add_plan_item', { p_date: date, p_topic_id: topicId, p_label: label })
  if (res.error) throw new Error(`add item: ${res.error.message}`)
  return res.data !== null
}

/** Moves an unfinished item to `to`; the original stays as history. */
export async function deferItem(itemId: number, to: string): Promise<void> {
  ok(await supabase.rpc('defer_plan_item', { p_item_id: itemId, p_to: to }), 'defer item')
}

export async function setItemOrder(updates: { id: number; sortOrder: number }[]): Promise<void> {
  const res = await Promise.all(updates.map((u) => supabase.from('day_plan_items').update({ sort_order: u.sortOrder }).eq('id', u.id)))
  for (const r of res) ok(r, 'reorder')
}

// ponytail: misses older than 30 days stop carrying over; widen if older ones should resurface
const OVERDUE_DAYS = 30

/** Undone, undeferred topic items from the last month before `today` (overdueItems() filters the rest). */
export async function loadPastUndone(today: string): Promise<Item[]> {
  return rows(
    await supabase
      .from('day_plan_items')
      .select('*')
      .lt('date', today)
      .gte('date', addDays(today, -OVERDUE_DAYS))
      .is('done_at', null)
      .is('deferred_to', null)
      .not('topic_id', 'is', null),
    'load overdue',
  )
}

/** Sets a topic's completion time (null = not done). A DB trigger mirrors it onto the plan item of that day. */
export async function setTopicDoneAt(topicId: string, doneAt: string | null): Promise<void> {
  ok(await supabase.from('topics').update({ done_at: doneAt }).eq('id', topicId), 'update topic')
}

export async function setItemDoneAt(itemId: number, doneAt: string | null): Promise<void> {
  ok(await supabase.from('day_plan_items').update({ done_at: doneAt }).eq('id', itemId), 'update item')
}

/** Completion time for "done on `date`": now if that's today, else noon IST that day (backfill). */
export const doneAtFor = (date: string, today: string): string =>
  date === today ? new Date().toISOString() : new Date(`${date}T12:00:00+05:30`).toISOString()

export async function setRevision(topicId: string, revision: boolean): Promise<void> {
  ok(await supabase.from('topics').update({ revision }).eq('id', topicId), 'update star')
}

const PAGE = 1000

/** Runs a ranged query page by page so results are never cut at the API's 1000-row cap. */
async function allPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const got = rows(await page(from, from + PAGE - 1), what)
    all.push(...got)
    if (got.length < PAGE) return all
  }
}

/** Saved plan items for a date range, keyed by date; dates without a saved plan are absent. */
export async function loadPlansBetween(from: string, to: string): Promise<Map<string, Item[]>> {
  const [plans, items] = await Promise.all([
    allPages((a, b) => supabase.from('day_plans').select('date').gte('date', from).lte('date', to).order('date').range(a, b), 'load plans'),
    allPages(
      (a, b) =>
        supabase.from('day_plan_items').select('*').gte('date', from).lte('date', to).order('date').order('sort_order').order('id').range(a, b),
      'load plan items',
    ),
  ])
  const out = new Map<string, Item[]>(plans.map((p) => [p.date, []]))
  for (const i of items) out.get(i.date)?.push(i)
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
  const out: Record<string, unknown[]> = {}
  for (const [table, orderBy] of EXPORT_TABLES) {
    out[table] = await allPages<unknown>((a, b) => supabase.from(table).select('*').order(orderBy).range(a, b), `export ${table}`)
  }
  return out
}

/** Pace for one track from its topics and exam date. */
export function paceFor(cat: Catalog, trackId: string, today: string): Pace {
  const track = cat.tracks.find((t) => t.id === trackId)
  return trackPace(
    cat.topics.filter((t) => t.trackId === trackId),
    track?.exam_date ?? null,
    today,
  )
}

export async function setExamDate(trackId: string, examDate: string | null): Promise<void> {
  ok(await supabase.from('tracks').update({ exam_date: examDate }).eq('id', trackId), 'update exam date')
}

/** Items a week's schedule produces: topics from track blocks, one per checklist block. */
export function weeklyItems(cat: Catalog): number {
  return cat.blocks.reduce((sum, b) => sum + (b.track_id === null ? 1 : b.topics), 0)
}

/** Checklist (free-text) items of saved plans, in the shape completionsByDay() takes. */
export const checklistOf = (plans: Map<string, Item[]>) =>
  [...plans.values()].flat().flatMap((i) => (i.topic_id === null && i.deferred_to === null ? [{ date: i.date, done: i.done_at !== null }] : []))

/** Saves preference changes, creating the settings row on first save. */
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  ok(await supabase.from('user_settings').upsert({ ...patch, updated_at: new Date().toISOString() }), 'save settings')
}

/** Saves a topic's review schedule; `reviewedAt` also stamps the topic's last review. */
export async function saveReview(topicId: string, state: ReviewState, reviewedAt?: string): Promise<void> {
  ok(
    await supabase
      .from('revisions')
      .upsert({ topic_id: topicId, due_date: state.dueDate, interval_step: state.step, updated_at: new Date().toISOString() }),
    'save review',
  )
  if (reviewedAt) ok(await supabase.from('topics').update({ last_reviewed_at: reviewedAt }).eq('id', topicId), 'stamp review')
}

export async function setConfidence(topicId: string, confidence: Confidence | null): Promise<void> {
  ok(await supabase.from('topics').update({ confidence }).eq('id', topicId), 'update confidence')
}

/** Reviews due today or earlier, for completed topics only. */
export const revisionsDue = (cat: Catalog, today: string): number =>
  [...cat.revisions].filter(([id, r]) => cat.topicById.get(id)?.done && isDue(r, today)).length

/** Minutes budgeted for `date`: the weekday's saved budget, else the sum of that day's block minutes. */
export function budgetFor(cat: Catalog, date: string): number {
  const wd = weekdayOf(date)
  const saved = cat.settings.daily_budget?.[wd]
  if (saved !== null && saved !== undefined) return saved
  return cat.blocks.reduce((n, b) => (b.weekday === wd ? n + b.minutes : n), 0)
}

const budgetOf = (cat: Catalog, date: string) => ({
  minutes: budgetFor(cat, date),
  estimate: (id: string) => cat.topicById.get(id)?.estMinutes ?? DEFAULT_TOPIC_MINUTES,
})


export type TopicPatch = Partial<Pick<Topic, 'notes' | 'links' | 'bloom' | 'practiceDone' | 'estOverride'>>

/** Saves drawer edits; links are re-validated here as http(s) only. */
export async function updateTopic(topicId: string, patch: TopicPatch): Promise<void> {
  if (patch.links?.some((l) => !safeUrl(l))) throw new Error('links must be http(s) URLs')
  if (patch.estOverride !== undefined && patch.estOverride !== null) {
    const m = patch.estOverride
    if (!Number.isInteger(m) || m < 1 || m > 600) throw new Error('estimate must be 1–600 minutes')
  }
  const row: TablesUpdate<'topics'> = {}
  if (patch.notes !== undefined) row.notes = patch.notes.trim() ? patch.notes : null
  if (patch.links !== undefined) row.links = patch.links
  if (patch.bloom !== undefined) row.bloom = patch.bloom
  if (patch.practiceDone !== undefined) row.practice_done = patch.practiceDone
  if (patch.estOverride !== undefined) row.est_minutes = patch.estOverride
  ok(await supabase.from('topics').update(row).eq('id', topicId), 'update topic')
}

/** Imports parsed CSV rows into a track in one transaction; returns how many topics were new. */
export async function importTopics(trackId: string, rows: TopicCsvRow[]): Promise<number> {
  const res = await supabase.rpc('import_topics', { p_track_id: trackId, p_rows: rows })
  if (res.error) throw new Error(`import topics: ${res.error.message}`)
  return res.data
}

export async function setCountInOverall(trackId: string, count: boolean): Promise<void> {
  ok(await supabase.from('tracks').update({ count_in_overall: count }).eq('id', trackId), 'update track')
}

/** Topics that count toward the overall % (checklist-style tracks like DSA can be left out). */
export function overallTopics(cat: Catalog): Topic[] {
  const counted = new Set(cat.tracks.filter((t) => t.count_in_overall).map((t) => t.id))
  return cat.topics.filter((t) => counted.has(t.trackId))
}

/** Days in the range whose plan has been generated (a day can exist ungenerated, holding only deferred/added items). */
export async function loadGeneratedDays(from: string, to: string): Promise<Set<string>> {
  const res = await supabase.from('day_plans').select('date').gte('date', from).lte('date', to).not('generated_at', 'is', null)
  return new Set(rows(res, 'load generated days').map((d) => d.date))
}

/** Subject for a checklist item such as "PYQs (weakest subject)"; null = use the suggestion. */
export async function setItemTrack(itemId: number, trackId: string | null): Promise<void> {
  ok(await supabase.from('day_plan_items').update({ track_id: trackId }).eq('id', itemId), 'update item subject')
}

/** Checklist labels that get a subject picker. */
export const needsSubject = (label: string | null) => label !== null && /weakest|pyq/i.test(label)

export async function loadWeeklyReview(weekStart: string): Promise<string> {
  const res = await supabase.from('weekly_reviews').select('reflection').eq('week_start', weekStart).maybeSingle()
  if (res.error) throw new Error(`load weekly review: ${res.error.message}`)
  return res.data?.reflection ?? ''
}

/** Saves the reflection with a snapshot of the week's numbers. */
export async function saveWeeklyReview(weekStart: string, reflection: string, summary: WeekSummary): Promise<void> {
  ok(
    await supabase.from('weekly_reviews').upsert({ week_start: weekStart, reflection, summary, updated_at: new Date().toISOString() }),
    'save weekly review',
  )
}

/** Current/best streak under the user's rule, from all saved plans + completions. */
export function streakFor(cat: Catalog, plans: Map<string, Item[]>, today: string): { current: number; best: number } {
  const doneByDay = completionsByDay(cat.topics, checklistOf(plans))
  const planSize = new Map([...plans].map(([d, its]) => [d, its.filter((i) => i.deferred_to === null).length]))
  const rule = { planPct: cat.settings.streak_plan_pct, minNoPlan: cat.settings.streak_min_no_plan }
  return streaks(activeDays(doneByDay, planSize, rule), today)
}

/** Start of "all history" for streaks and reviews. */
export const HISTORY_START = '2000-01-01'
