import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { loadCatalog, type Catalog } from '../lib/data'
import { searchCatalog, type SearchDoc } from '../lib/search'
import { shortTrackName, trackColor } from './trackColor'

export const OPEN_SEARCH_EVENT = 'study:open-search'
/** Opens the palette from anywhere (buttons; the shortcut is handled inside). */
export const openSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))

function docsOf(cat: Catalog): SearchDoc[] {
  const trackName = new Map(cat.tracks.map((t) => [t.id, shortTrackName(t.name)]))
  return [
    ...cat.tracks.map((t) => ({ kind: 'track' as const, id: t.id, title: t.name, trackId: t.id, context: t.course_code ?? '' })),
    ...cat.modules.map((m) => ({ kind: 'module' as const, id: m.id, title: m.name, trackId: m.track_id, context: trackName.get(m.track_id) ?? '' })),
    ...cat.topics.map((t) => ({ kind: 'topic' as const, id: t.id, title: t.title, trackId: t.trackId, context: t.moduleName })),
  ]
}

const target = (d: SearchDoc) =>
  d.kind === 'track' ? `/tracks/${d.trackId}` : d.kind === 'module' ? `/tracks/${d.trackId}?module=${d.id}` : `/tracks/${d.trackId}?topic=${d.id}`

/** Ctrl/Cmd+K palette over tracks, modules and topics (ARIA combobox + listbox). */
export default function SearchPalette() {
  const ref = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ids = { list: useId(), label: useId() }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
    if (!open) return
    // fresh catalog each time it opens, so new imports and edits are searchable
    let cancelled = false
    loadCatalog().then(
      (c) => {
        if (!cancelled) setCat(c)
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      },
    )
    return () => {
      cancelled = true
    }
  }, [open])

  const docs = useMemo(() => (cat ? docsOf(cat) : []), [cat])
  const results = useMemo(() => searchCatalog(docs, query), [docs, query])
  const trackById = useMemo(() => new Map(cat?.tracks.map((t) => [t.id, t]) ?? []), [cat])

  function close() {
    setOpen(false)
    setQuery('')
    setActive(0)
  }

  function go(d: SearchDoc | undefined) {
    if (!d) return
    close()
    void navigate(target(d))
  }

  const optionId = (i: number) => `${ids.list}-${i}`

  return (
    <dialog
      ref={ref}
      onClose={close}
      aria-labelledby={ids.label}
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] rounded-[14px] border border-line bg-card p-0 text-text backdrop:bg-black/60"
    >
      <h2 id={ids.label} className="sr-only">
        Search topics, modules and tracks
      </h2>
      {/* the ring sits on the whole bar while the input has focus */}
      <div className="flex items-center gap-2 border-b border-line px-3 focus-within:ring-2 focus-within:ring-accent focus-within:ring-inset">
        <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-muted" aria-hidden="true">
          <path d="M9 15a6 6 0 100-12 6 6 0 000 12zM17 17l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          autoFocus
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={ids.list}
          aria-activedescendant={results.length ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-label="Search"
          placeholder="Search topics, modules, tracks…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(results.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              go(results[active])
            }
          }}
          className="min-h-12 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
        />
        <kbd className="hidden rounded border border-line px-1.5 text-[11px] text-muted sm:inline">Esc</kbd>
      </div>
      {error && <p className="px-4 py-3 text-red-300">{error}</p>}
      {!cat && !error && <p className="px-4 py-3 text-muted">Loading…</p>}
      {cat && query.trim() && results.length === 0 && <p className="px-4 py-3 text-muted">No matches.</p>}
      <ul id={ids.list} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto py-1">
        {results.map((d, i) => {
          const track = trackById.get(d.trackId)
          return (
            <li
              key={`${d.kind}-${d.id}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseMove={() => setActive(i)}
              onClick={() => go(d)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === active ? 'bg-raised' : ''}`}
            >
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: track ? trackColor(track.sort_order) : undefined }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{d.title}</span>
                <span className="block truncate text-xs text-muted">
                  {d.kind === 'track' ? 'Track' : d.kind === 'module' ? `Module · ${d.context}` : `${shortTrackName(track?.name ?? '')} · ${d.context}`}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </dialog>
  )
}
