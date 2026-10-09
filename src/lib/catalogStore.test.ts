import { beforeEach, describe, expect, it, vi } from 'vitest'

let fetches = 0
vi.mock('./data', () => ({
  loadCatalog: vi.fn(async () => {
    fetches++
    return { tracks: [], modules: [], topics: [], topicById: new Map(), blocks: [], revisions: new Map(), settings: {}, n: fetches }
  }),
}))

const store = await import('./catalogStore')

beforeEach(() => {
  fetches = 0
  store.resetCatalogStore()
  vi.useRealTimers()
})

describe('catalog store', () => {
  it('shares one request between concurrent callers', async () => {
    const [a, b] = await Promise.all([store.getCatalog(), store.getCatalog()])
    expect(fetches).toBe(1)
    expect(a).toBe(b)
  })

  it('serves a fresh cache without refetching, and refetches when stale or forced', async () => {
    vi.useFakeTimers()
    await store.getCatalog()
    await store.getCatalog()
    expect(fetches).toBe(1)
    vi.advanceTimersByTime(store.STALE_MS + 1)
    await store.getCatalog()
    expect(fetches).toBe(2)
    await store.getCatalog({ force: true })
    expect(fetches).toBe(3)
  })

  it('publishes local edits to every subscriber without a fetch', async () => {
    const seen: unknown[] = []
    const off = store.subscribeCatalog((c) => seen.push(c))
    const c = await store.getCatalog()
    store.updateCatalog((x) => ({ ...x, blocks: [] }))
    off()
    expect(fetches).toBe(1)
    expect(seen).toHaveLength(2)
    expect(seen[1]).not.toBe(c)
    expect(store.peekCatalog()).toBe(seen[1])
  })
})

describe('catalog store races', () => {
  // a fetch we can resolve by hand, to interleave edits with it
  async function withDeferredFetch(run: (resolveFetch: () => void) => Promise<void>) {
    const { loadCatalog } = await import('./data')
    let release!: () => void
    vi.mocked(loadCatalog).mockImplementationOnce(
      () =>
        new Promise((res) => {
          release = () => res({ tracks: [], modules: [], topics: [], topicById: new Map(), blocks: [], revisions: new Map(), settings: {}, stale: true } as never)
        }),
    )
    await run(() => release())
  }

  it('a refetch that started before a local edit does not overwrite it', async () => {
    await store.getCatalog()
    await withDeferredFetch(async (resolveFetch) => {
      const pending = store.getCatalog({ force: true })
      store.updateCatalog((c) => ({ ...c, blocks: [{ id: 1 } as never] }))
      resolveFetch()
      await pending
    })
    expect(store.peekCatalog()?.blocks).toHaveLength(1)
    // and it stays stale, so the next read refetches
    expect(store.isStale()).toBe(true)
  })

  it('force waits for a fetch that starts after any in-flight one', async () => {
    await withDeferredFetch(async (resolveFetch) => {
      const first = store.getCatalog()
      const forced = store.getCatalog({ force: true })
      resolveFetch()
      await first
      await forced
    })
    expect(fetches).toBe(1)
    expect(store.peekCatalog()).not.toHaveProperty('stale')
  })

  it('a fetch in flight at sign-out never repopulates the cache', async () => {
    await withDeferredFetch(async (resolveFetch) => {
      const pending = store.getCatalog()
      store.resetCatalogStore()
      resolveFetch()
      await pending
    })
    expect(store.peekCatalog()).toBeNull()
  })
})
