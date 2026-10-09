export type SearchDoc = { kind: 'track' | 'module' | 'topic'; id: string; title: string; trackId: string; context: string }

// ponytail: linear scan over ~300 docs per keystroke; build an index if the catalog reaches thousands.
function termScore(term: string, title: string, context: string): number {
  if (title.startsWith(term)) return 3
  if (title.split(/[\s(/-]+/).some((w) => w.startsWith(term))) return 2
  if (title.includes(term) || context.includes(term)) return 1
  return 0
}

/** Every word must match a doc's title or context; best matches first. */
export function searchCatalog(docs: readonly SearchDoc[], query: string, limit = 30): SearchDoc[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  const scored: { doc: SearchDoc; score: number }[] = []
  for (const doc of docs) {
    const title = doc.title.toLowerCase()
    const context = doc.context.toLowerCase()
    let score = 0
    for (const t of terms) {
      const s = termScore(t, title, context)
      if (s === 0) {
        score = 0
        break
      }
      score += s
    }
    if (score > 0) scored.push({ doc, score })
  }
  scored.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
  return scored.slice(0, limit).map((s) => s.doc)
}
