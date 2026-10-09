import { loadCatalog, type Catalog } from './data'

// Shared catalog cache (tracks, modules, topics, blocks + settings/revisions), stale-while-revalidate:
// pages render the cached copy at once and refetch in the background only when it is older than STALE_MS.
// Local writes patch the cache via updateCatalog, so every page sees them without a refetch.
export const STALE_MS = 60_000

let cached: Catalog | null = null
let fetchedAt = 0
let inflight: Promise<Catalog> | null = null
// bumped by every local edit: a fetch that started before an edit must not overwrite it
let version = 0
// bumped by sign-out: a fetch from the previous session must never land in the cache
let generation = 0
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

function startFetch(): Promise<Catalog> {
  const gen = generation
  const startVersion = version
  const p = loadCatalog().then((c) => {
    if (gen !== generation) return c
    if (version !== startVersion && cached) {
      // edited while this was in flight: keep the edits, and stay stale so the next read refetches
      fetchedAt = 0
      return cached
    }
    fetchedAt = Date.now()
    publish(c)
    return c
  })
  const clear = () => {
    if (inflight === p) inflight = null
  }
  p.then(clear, clear)
  return p
}

/** The catalog: cached if fresh, otherwise one shared request. `force` always gets data fetched after the call. */
export function getCatalog({ force = false }: { force?: boolean } = {}): Promise<Catalog> {
  if (!force && cached && !isStale()) return Promise.resolve(cached)
  if (!inflight) {
    inflight = startFetch()
    return inflight
  }
  if (!force) return inflight
  // an in-flight fetch may predate the write the caller just made: queue a fresh one behind it
  const chained = inflight.then(startFetch, startFetch)
  inflight = chained
  const clear = () => {
    if (inflight === chained) inflight = null
  }
  chained.then(clear, clear)
  return chained
}

/** Applies a local edit to the cached catalog and tells every subscriber. */
export function updateCatalog(fn: (c: Catalog) => Catalog): void {
  if (!cached) return
  version++
  publish(fn(cached))
}

/** Replaces the cached catalog with a freshly loaded one. */
export function setCatalog(c: Catalog): void {
  version++
  fetchedAt = Date.now()
  publish(c)
}

/** Sign-out (and tests): forget everything, including fetches still in flight. */
export function resetCatalogStore(): void {
  generation++
  cached = null
  fetchedAt = 0
  inflight = null
  listeners.clear()
}
