import { describe, expect, it } from 'vitest'
import { completionsByDay, heatLevel, heatmapWeeks, streaks, topicsCompletedOn } from './stats'

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
