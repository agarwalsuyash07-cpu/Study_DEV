import { BLOOM_LEVELS } from './bloom'

/** RFC 4180-ish: quoted fields, "" escapes, commas/newlines inside quotes, CRLF; blank lines dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const endRow = () => {
    row.push(field)
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
    field = ''
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else field += c
  }
  if (field !== '' || row.length) endRow()
  return rows
}

export type TopicCsvRow = { module: string; title: string; bloom: string | null; est_minutes: number | null }

export const MAX_IMPORT_ROWS = 2000

/** Topics CSV with a header row: module, title (required), bloom, est_minutes (optional). */
export function parseTopicsCsv(text: string): { rows: TopicCsvRow[]; errors: string[] } {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ''))
  const cols = (header ?? []).map((h) => h.trim().toLowerCase())
  const at = (name: string) => cols.indexOf(name)
  for (const req of ['module', 'title']) {
    if (at(req) < 0) return { rows: [], errors: [`Missing required column "${req}" (header must include module and title).`] }
  }

  const rows: TopicCsvRow[] = []
  const errors: string[] = []
  const get = (r: string[], name: string) => (at(name) >= 0 ? (r[at(name)] ?? '').trim() : '')
  body.forEach((r, i) => {
    const line = i + 2
    if (rows.length >= MAX_IMPORT_ROWS) return
    const module = get(r, 'module')
    const title = get(r, 'title')
    if (!module || !title) {
      errors.push(`Line ${line}: module and title are required.`)
      return
    }
    const rawBloom = get(r, 'bloom')
    const bloom = BLOOM_LEVELS.find((b) => b.toLowerCase() === rawBloom.toLowerCase()) ?? null
    if (rawBloom && !bloom) errors.push(`Line ${line}: unknown Bloom level "${rawBloom}" (left blank).`)
    const rawMin = get(r, 'est_minutes')
    const n = Number(rawMin)
    const est_minutes = rawMin && Number.isInteger(n) && n >= 1 && n <= 600 ? n : null
    if (rawMin && est_minutes === null) errors.push(`Line ${line}: est_minutes must be 1–600 (left blank).`)
    rows.push({ module, title, bloom, est_minutes })
  })
  if (body.length > MAX_IMPORT_ROWS && rows.length === MAX_IMPORT_ROWS) errors.push(`Only the first ${MAX_IMPORT_ROWS} rows are imported.`)
  return { rows, errors }
}
