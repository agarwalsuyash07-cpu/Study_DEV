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

const { doneAtFor, loadCatalog, weeklyTopics } = await import('./data')
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
