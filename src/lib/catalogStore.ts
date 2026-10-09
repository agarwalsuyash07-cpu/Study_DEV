import { loadCatalog, type Catalog } from './data'

// Shared catalog cache (tracks, modules, topics, blocks + settings/revisions), stale-while-revalidate:
// pages render the cached copy at once and refetch in the background only when it is older than STALE_MS.
// Local writes patch the cache via updateCatalog, so every page sees them without a refetch.
export const STALE_MS = 60_000

let cached: Catalog | null = null
let fetchedAt = 0
let inflight: Promise<Catalog> | null = null
const listeners = new Set<(c: Catalog) => void>()

function publish(c: Catalog) {
  cached = c
  for (const l of listeners) l(c)
}

export const peekCatalog = () => cached
export const isStale = () => cached === null || Date.now() - fetchedAt > STALE_MS

export function subscribeCatalog(l: (c: Catalog) => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The catalog: cached if fresh, otherwise one shared request (concurrent callers wait on the same one). */
export function getCatalog({ force = false }: { force?: boolean } = {}): Promise<Catalog> {
  if (!force && cached && !isStale()) return Promise.resolve(cached)
  inflight ??= loadCatalog()
    .then((c) => {
      fetchedAt = Date.now()
      publish(c)
      return c
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Applies a local edit to the cached catalog and tells every subscriber. */
export function updateCatalog(fn: (c: Catalog) => Catalog): void {
  if (cached) publish(fn(cached))
}

/** Tests and sign-out: forget everything. */
export function resetCatalogStore(): void {
  cached = null
  fetchedAt = 0
  inflight = null
  listeners.clear()
}

/** Replaces the cached catalog with a freshly loaded one (e.g. a page that loads it itself). */
export function setCatalog(c: Catalog): void {
  fetchedAt = Date.now()
  publish(c)
}
