import { describe, expect, it } from 'vitest'
import { addDays, todayIST, weekDates, weekdayOf } from './date'

describe('todayIST', () => {
  it('rolls to the next day at 18:30 UTC', () => {
    expect(todayIST(new Date('2026-10-08T18:29:00Z'))).toBe('2026-10-08')
    expect(todayIST(new Date('2026-10-08T19:00:00Z'))).toBe('2026-10-09')
  })
  it('matches the UTC date just after UTC midnight', () => {
    expect(todayIST(new Date('2026-10-08T00:10:00Z'))).toBe('2026-10-08')
  })
})

describe('weekdayOf', () => {
  it('uses 0 = Sunday', () => {
    expect(weekdayOf('2026-10-11')).toBe(0)
    expect(weekdayOf('2026-10-12')).toBe(1)
    expect(weekdayOf('2026-10-17')).toBe(6)
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('weekDates', () => {
  it('returns Mon–Sun containing the date', () => {
    const thu = weekDates('2026-10-08')
    expect(thu).toHaveLength(7)
    expect(thu[0]).toBe('2026-10-05')
    expect(thu[6]).toBe('2026-10-11')
  })
  it('treats Sunday as the end of the week', () => {
    expect(weekDates('2026-10-11')[0]).toBe('2026-10-05')
  })
})
