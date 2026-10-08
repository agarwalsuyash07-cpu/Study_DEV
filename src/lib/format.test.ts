import { describe, expect, it } from 'vitest'
import { fmtMin } from './format'

describe('fmtMin', () => {
  it('formats minutes under an hour', () => expect(fmtMin(45)).toBe('45m'))
  it('formats hours with padded minutes', () => expect(fmtMin(65)).toBe('1h 05m'))
  it('drops minutes on whole hours', () => expect(fmtMin(120)).toBe('2h'))
  it('rounds fractional estimates', () => expect(fmtMin(29.6)).toBe('30m'))
})
