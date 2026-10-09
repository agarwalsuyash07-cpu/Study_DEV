import { describe, expect, it } from 'vitest'
import { overallStatus, trackPace, type PaceTopic } from './pace'

const today = '2026-10-09'
// done_at timestamps at IST noon on the given date
const doneOn = (date: string): PaceTopic => ({ done: true, doneAt: `${date}T06:30:00Z` })
const undone = (n: number): PaceTopic[] => Array.from({ length: n }, () => ({ done: false, doneAt: null }))

describe('trackPace', () => {
  it('counts topics left, days left (today counts, exam day does not) and needed per day', () => {
    const p = trackPace([...undone(10), doneOn('2026-09-01')], '2026-10-19', today)
    expect(p.left).toBe(10)
    expect(p.daysLeft).toBe(10)
    expect(p.neededPerDay).toBe(1)
  })

  it('uses the last 7 days (today and 6 before) for the current pace', () => {
    const ts = [doneOn('2026-10-09'), doneOn('2026-10-03'), doneOn('2026-10-02'), ...undone(3)]
    // 10-02 is 7 days back, outside the window
    expect(trackPace(ts, null, today).recentPerDay).toBeCloseTo(2 / 7)
  })

  it('reports ahead when the current pace finishes before the exam', () => {
    // 7 done in the window = 1/day; 10 days left → 10 topics of capacity vs 6 left
    const ts = [...Array.from({ length: 7 }, (_, i) => doneOn(`2026-10-0${i + 3}`)), ...undone(6)]
    const p = trackPace(ts, '2026-10-19', today)
    expect(p.aheadBy).toBe(4)
    expect(p.status).toEqual({ kind: 'ahead', by: 4 })
  })

  it('reports behind by the shortfall at the exam, rounded up', () => {
    // 1 done in the window = 1/7 per day; 7 days left → 1 topic of capacity vs 5 left
    const ts = [doneOn('2026-10-08'), ...undone(5)]
    const p = trackPace(ts, '2026-10-16', today)
    expect(p.aheadBy).toBe(-4)
    expect(p.status).toEqual({ kind: 'behind', by: 4 })
  })

  it('handles no exam date, a finished track and a passed exam', () => {
    expect(trackPace(undone(3), null, today).status).toEqual({ kind: 'no-exam' })
    expect(trackPace([doneOn('2026-10-01')], '2026-11-01', today).status).toEqual({ kind: 'complete' })
    const past = trackPace(undone(2), '2026-10-09', today)
    expect(past.status).toEqual({ kind: 'exam-passed' })
    expect(past.neededPerDay).toBeNull()
  })
})

describe('overallStatus', () => {
  it('is behind if any dated track is behind, and ignores tracks without exams', () => {
    const ahead = trackPace([...Array.from({ length: 7 }, (_, i) => doneOn(`2026-10-0${i + 3}`)), ...undone(1)], '2026-10-19', today)
    const behind = trackPace(undone(20), '2026-10-12', today)
    const noExam = trackPace(undone(5), null, today)
    expect(overallStatus([ahead, noExam])).toEqual({ kind: 'on-track', behind: 0, dated: 1 })
    expect(overallStatus([ahead, behind, noExam])).toEqual({ kind: 'behind', behind: 1, dated: 2 })
    expect(overallStatus([noExam])).toEqual({ kind: 'no-exams', behind: 0, dated: 0 })
  })
})
