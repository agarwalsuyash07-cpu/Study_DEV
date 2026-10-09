import { describe, expect, it } from 'vitest'
import { parseBackup } from './backup'

const topic = {
  id: 'cn-m1-t1',
  user_id: 'someone-else',
  module_id: 'cn-m1',
  sort_order: 1,
  title: 'TCP',
  bloom: 'Apply',
  done_at: '2026-10-08T10:00:00Z',
  revision: true,
  confidence: 2,
  notes: 'n',
  links: ['https://example.com'],
}

describe('parseBackup', () => {
  it('accepts an export, strips user_id and unknown columns, and counts rows', () => {
    const res = parseBackup({
      exportedAt: '2026-10-09T00:00:00Z',
      tracks: [{ id: 'cn', user_id: 'x', name: 'CN', type: 'semester', sort_order: 0, weird: 1 }],
      modules: [{ id: 'cn-m1', track_id: 'cn', sort_order: 1, name: 'M' }],
      topics: [topic],
      unknown_table: [{}],
    })
    if (!res.ok) throw new Error(res.error)
    expect(res.data.tracks[0]).toEqual({ id: 'cn', name: 'CN', type: 'semester', sort_order: 0 })
    expect(res.data.topics[0]).not.toHaveProperty('user_id')
    expect(res.counts).toMatchObject({ tracks: 1, modules: 1, topics: 1, schedule_blocks: 0 })
  })

  it('rejects files that are not an export, naming the first problem', () => {
    expect(parseBackup('nope')).toEqual({ ok: false, error: 'Not a Study Tracker export (expected a JSON object).' })
    const bad = parseBackup({ topics: [{ ...topic, title: '' }] })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/^topics\.0\.title/)
  })

  it('refuses links that are not http(s)', () => {
    const res = parseBackup({ topics: [{ ...topic, links: ['javascript:alert(1)'] }] })
    expect(res.ok).toBe(false)
  })
})
