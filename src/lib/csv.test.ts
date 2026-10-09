import { describe, expect, it } from 'vitest'
import { parseCsv, parseTopicsCsv } from './csv'

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
  })

  it('keeps newlines inside quoted fields and skips blank lines', () => {
    expect(parseCsv('a\n\n"line1\nline2"\n')).toEqual([['a'], ['line1\nline2']])
  })
})

describe('parseTopicsCsv', () => {
  it('maps header columns case-insensitively and normalises bloom/minutes', () => {
    const { rows, errors } = parseTopicsCsv('Module,Title,Bloom,Est_Minutes\nArrays,Two pointers,apply,40\nArrays,Sliding window,,')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { module: 'Arrays', title: 'Two pointers', bloom: 'Apply', est_minutes: 40 },
      { module: 'Arrays', title: 'Sliding window', bloom: null, est_minutes: null },
    ])
  })

  it('reports missing columns and bad rows with their line numbers', () => {
    expect(parseTopicsCsv('title\nx').errors).toEqual(['Missing required column "module" (header must include module and title).'])
    const { rows, errors } = parseTopicsCsv('module,title,bloom,est_minutes\n,No module\nM,,\nM,Ok,Wizardry,9999')
    expect(rows).toEqual([{ module: 'M', title: 'Ok', bloom: null, est_minutes: null }])
    expect(errors).toEqual([
      'Line 2: module and title are required.',
      'Line 3: module and title are required.',
      'Line 4: unknown Bloom level "Wizardry" (left blank).',
      'Line 4: est_minutes must be 1–600 (left blank).',
    ])
  })

  it('caps the number of rows', () => {
    const body = Array.from({ length: 2001 }, (_, i) => `M,T${i}`).join('\n')
    const { rows, errors } = parseTopicsCsv(`module,title\n${body}`)
    expect(rows).toHaveLength(2000)
    expect(errors).toEqual(['Only the first 2000 rows are imported.'])
  })
})
