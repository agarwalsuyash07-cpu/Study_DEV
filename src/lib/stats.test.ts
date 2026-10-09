import { describe, expect, it } from 'vitest'
import { activeDays, completionsByDay, heatLevel, heatmapWeeks, streaks, topicsCompletedOn } from './stats'

describe('streaks', () => {
  it('counts back from today', () => {
    const active = new Set(['2026-10-06', '2026-10-07', '2026-10-08'])
    expect(streaks(active, '2026-10-08')).toEqual({ current: 3, best: 3 })
  })
  it('keeps the streak alive if today has no activity yet', () => {
    const active = new Set(['2026-10-06', '2026-10-07'])
    expect(streaks(active, '2026-10-08').current).toBe(2)
  })
  it('breaks after a missed day and tracks the best run', () => {
    const active = new Set(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-05'])
    expect(streaks(active, '2026-10-08')).toEqual({ current: 0, best: 4 })
  })
  it('is zero with no activity', () => {
    expect(streaks(new Set(), '2026-10-08')).toEqual({ current: 0, best: 0 })
  })
})

describe('heatmapWeeks', () => {
  it('returns Mon-first columns ending on the week containing today', () => {
    const weeks = heatmapWeeks('2026-10-08', 3)
    expect(weeks).toHaveLength(3)
    expect(weeks[0]![0]).toBe('2026-09-21')
    expect(weeks[2]![0]).toBe('2026-10-05')
    expect(weeks[2]![6]).toBe('2026-10-11')
  })
})

describe('heatLevel', () => {
  it('buckets topics done into 0–4', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(1)).toBe(1)
    expect(heatLevel(2)).toBe(2)
    expect(heatLevel(3)).toBe(3)
    expect(heatLevel(4)).toBe(4)
    expect(heatLevel(9)).toBe(4)
  })
})

describe('completed-on selector', () => {
  // 2026-10-08T20:00Z is 01:30 on the 9th in IST
  const topics = [
    { id: 'a', doneAt: '2026-10-09T05:00:00Z' },
    { id: 'b', doneAt: '2026-10-08T20:00:00Z' },
    { id: 'c', doneAt: '2026-10-08T10:00:00Z' },
    { id: 'd', doneAt: null },
  ]

  it('buckets topics by their IST completion day, wherever they were ticked', () => {
    expect(topicsCompletedOn(topics, '2026-10-09').map((t) => t.id)).toEqual(['a', 'b'])
    expect(topicsCompletedOn(topics, '2026-10-08').map((t) => t.id)).toEqual(['c'])
  })

  it('adds ticked checklist items on their own plan day', () => {
    const checklist = [
      { date: '2026-10-09', done: true },
      { date: '2026-10-09', done: false },
      { date: '2026-10-04', done: true },
    ]
    const byDay = completionsByDay(topics, checklist)
    expect(byDay.get('2026-10-09')).toBe(3)
    expect(byDay.get('2026-10-08')).toBe(1)
    expect(byDay.get('2026-10-04')).toBe(1)
  })
})

describe('streak rule', () => {
  const rule = { planPct: 50, minNoPlan: 3 }

  it('needs half the day\'s plan (at least one) when there was a plan', () => {
    const done = new Map([
      ['2026-10-05', 1], // plan 7 → needs 3.5
      ['2026-10-06', 4], // plan 7 → ok
      ['2026-10-07', 1], // plan 1 → needs max(1, 0.5) = 1
      ['2026-10-08', 2], // plan 4 → exactly half
    ])
    const plans = new Map([
      ['2026-10-05', 7],
      ['2026-10-06', 7],
      ['2026-10-07', 1],
      ['2026-10-08', 4],
    ])
    expect([...activeDays(done, plans, rule)].sort()).toEqual(['2026-10-06', '2026-10-07', '2026-10-08'])
  })

  it('needs minNoPlan topics on a day without a plan (or an empty one)', () => {
    const done = new Map([
      ['2026-10-01', 2],
      ['2026-10-02', 3],
      ['2026-10-03', 3],
    ])
    const plans = new Map([['2026-10-03', 0]])
    expect([...activeDays(done, plans, rule)].sort()).toEqual(['2026-10-02', '2026-10-03'])
  })

  it('one ticked topic no longer keeps a 7-item day alive', () => {
    const done = new Map([
      ['2026-10-07', 5],
      ['2026-10-08', 1],
    ])
    const plans = new Map([
      ['2026-10-07', 7],
      ['2026-10-08', 7],
    ])
    expect(streaks(activeDays(done, plans, rule), '2026-10-09')).toEqual({ current: 0, best: 1 })
  })

  it('respects a custom threshold', () => {
    const done = new Map([['2026-10-08', 3]])
    const plans = new Map([['2026-10-08', 4]])
    expect(activeDays(done, plans, { planPct: 100, minNoPlan: 3 }).size).toBe(0)
    expect(activeDays(done, plans, { planPct: 75, minNoPlan: 3 }).size).toBe(1)
  })

  it('recomputes best streak from history', () => {
    const done = new Map(['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-08'].map((d) => [d, 3]))
    expect(streaks(activeDays(done, new Map(), rule), '2026-10-09')).toEqual({ current: 1, best: 3 })
  })
})
