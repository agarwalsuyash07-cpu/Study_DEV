import { beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal stand-in for the supabase query builder: every chain resolves to the table's canned rows.
const tables: Record<string, unknown[]> = {}
vi.mock('./supabase', () => {
  const query = (table: string) => {
    const result = { data: tables[table] ?? [], error: null }
    const chain = { select: () => chain, order: () => chain, maybeSingle: () => ({ data: null, error: null }), then: (f: (r: typeof result) => unknown) => Promise.resolve(result).then(f) }
    return chain
  }
  return { supabase: { from: query } }
})

const { blocksFor, budgetFor, doneAtFor, effectiveWeekday, estimateMinutes, loadCatalog, weeklyTopics } = await import('./data')
const { doneDay } = await import('./stats')

const block = (id: number, weekday: number, track_id: string | null, topics: unknown) => ({
  id,
  weekday,
  track_id,
  label: track_id ? null : 'Weekly review',
  topics,
  minutes: 60,
  sort_order: id,
  user_id: 'u',
})

beforeEach(() => {
  tables.tracks = [{ id: 'cn', name: 'CN', type: 'semester', course_code: null, sort_order: 0, user_id: 'u' }]
  tables.modules = [{ id: 'm', track_id: 'cn', sort_order: 0, name: 'M', co: null, est_minutes: null, user_id: 'u' }]
  tables.topics = []
})

describe('schedule vs pace', () => {
  it('sums topic counts per track, ignoring checklist blocks', async () => {
    tables.schedule_blocks = [block(1, 3, 'cn', 2), block(2, 5, 'cn', 2), block(3, 0, null, 1)]
    const cat = await loadCatalog()
    expect(weeklyTopics(cat, 'cn')).toBe(4)
    expect(weeklyTopics(cat)).toBe(4)
  })

  // regression: the live DB lacked schedule_blocks.topics, so every count was undefined and pace showed "Not scheduled"
  it('fails loudly when a block has no topic count', async () => {
    tables.schedule_blocks = [block(1, 3, 'cn', undefined)]
    await expect(loadCatalog()).rejects.toThrow(/no topic count/)
  })
})

describe('backfill timestamp', () => {
  it('lands on the chosen IST day for past dates and is "now" for today', () => {
    expect(doneDay(doneAtFor('2026-10-07', '2026-10-09'))).toBe('2026-10-07')
    const now = Date.now()
    expect(Math.abs(Date.parse(doneAtFor('2026-10-09', '2026-10-09')) - now)).toBeLessThan(1000)
  })
})

describe('topic estimate', () => {
  it('prefers the topic, then the module split, then the Bloom tag, then 45', () => {
    expect(estimateMinutes(20, 300, 5, 'Apply')).toBe(20)
    expect(estimateMinutes(null, 300, 4, 'Apply')).toBe(75)
    expect(estimateMinutes(null, null, 4, 'Evaluate')).toBe(75)
    expect(estimateMinutes(null, null, 4, 'Weird')).toBe(45)
    expect(estimateMinutes(null, null, 0, null)).toBe(45)
  })
})

describe('timetable date overrides', () => {
  it('treats Oct 17, 18, 19 as holidays with no blocks and zero budget', async () => {
    tables.schedule_blocks = [block(1, 1, 'cn', 2), block(2, 6, 'cn', 2), block(3, 0, 'cn', 2)]
    const cat = await loadCatalog()

    for (const d of ['2026-10-17', '2026-10-18', '2026-10-19']) {
      expect(effectiveWeekday(d)).toBeNull()
      expect(blocksFor(cat, d)).toEqual([])
      expect(budgetFor(cat, d)).toBe(0)
    }
  })

  it('overrides Oct 24 (Sat) to Monday schedule and Oct 31 (Sat) to Wednesday schedule', async () => {
    tables.schedule_blocks = [
      block(1, 1, 'cn', 3), // Monday
      block(2, 3, 'cn', 4), // Wednesday
      block(3, 6, 'cn', 5), // Saturday
    ]
    const cat = await loadCatalog()

    expect(effectiveWeekday('2026-10-24')).toBe(1)
    expect(blocksFor(cat, '2026-10-24')).toHaveLength(1)
    expect(blocksFor(cat, '2026-10-24')[0]!.topics).toBe(3)

    expect(effectiveWeekday('2026-10-31')).toBe(3)
    expect(blocksFor(cat, '2026-10-31')).toHaveLength(1)
    expect(blocksFor(cat, '2026-10-31')[0]!.topics).toBe(4)

    // Other Saturdays use regular Saturday (6)
    expect(effectiveWeekday('2026-10-10')).toBe(6)
    expect(blocksFor(cat, '2026-10-10')[0]!.topics).toBe(5)
  })
})
