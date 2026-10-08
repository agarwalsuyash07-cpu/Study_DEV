import { useState } from 'react'
import ErrorBanner from '../components/ErrorBanner'
import { addBlock, deleteBlock, exportAll, updateBlock, type Block, type Track } from '../lib/data'
import { todayIST } from '../lib/date'
import { fmtMin } from '../lib/format'
import { PageHeader } from '../components/ui'
import { supabase } from '../lib/supabase'
import { message, useCatalog } from '../lib/useCatalog'

// Monday-first display order; values are weekday numbers (0 = Sunday)
const DAYS: [number, string][] = [
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
  [0, 'Sunday'],
]

const inputCls = 'rounded-lg border border-line bg-raised px-2 py-2 outline-none focus:border-accent'
type BlockPatch = Partial<Pick<Block, 'track_id' | 'label' | 'minutes' | 'sort_order'>>

function BlockRow({
  block,
  tracks,
  first,
  last,
  onPatch,
  onMove,
  onRemove,
}: {
  block: Block
  tracks: Track[]
  first: boolean
  last: boolean
  onPatch: (patch: BlockPatch) => Promise<void>
  onMove: (dir: -1 | 1) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [minutes, setMinutes] = useState(String(block.minutes))
  const [label, setLabel] = useState(block.label ?? '')
  const [busy, setBusy] = useState(false)
  const name = tracks.find((t) => t.id === block.track_id)?.name ?? block.label ?? 'block'

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  function saveMinutes() {
    const n = Number(minutes)
    if (!Number.isInteger(n) || n < 1 || n > 1440) {
      setMinutes(String(block.minutes))
      return
    }
    if (n !== block.minutes) void run(() => onPatch({ minutes: n }))
  }

  function saveLabel() {
    const v = label.trim()
    if (!v) {
      setLabel(block.label ?? '')
      return
    }
    if (v !== block.label) void run(() => onPatch({ label: v }))
  }

  return (
    <li className="flex flex-col gap-2 px-3 py-3">
      <div className="flex items-center gap-2">
        <select
          aria-label="Track"
          value={block.track_id ?? ''}
          disabled={busy}
          onChange={(e) => {
            const trackId = e.target.value || null
            const fallback = block.label ?? 'Study block'
            if (!trackId) setLabel(fallback)
            void run(() => onPatch(trackId ? { track_id: trackId } : { track_id: null, label: fallback }))
          }}
          className={`${inputCls} min-w-0 flex-1`}
        >
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="">No track (checklist item)</option>
        </select>
        <input
          aria-label={`Minutes for ${name}`}
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          value={minutes}
          disabled={busy}
          onChange={(e) => setMinutes(e.target.value)}
          onBlur={saveMinutes}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`${inputCls} w-16 tabular-nums`}
        />
        <span className="text-sm text-muted">min</span>
      </div>
      {block.track_id === null && (
        <input
          aria-label="Checklist label"
          value={label}
          disabled={busy}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveLabel}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={inputCls}
        />
      )}
      <div className="flex gap-1 text-xs text-soft">
        <button
          type="button"
          disabled={first || busy}
          onClick={() => void run(() => onMove(-1))}
          className="rounded-md px-3 py-1.5 disabled:opacity-30"
          aria-label={`Move ${name} up`}
        >
          Up
        </button>
        <button
          type="button"
          disabled={last || busy}
          onClick={() => void run(() => onMove(1))}
          className="rounded-md px-3 py-1.5 disabled:opacity-30"
          aria-label={`Move ${name} down`}
        >
          Down
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(onRemove)}
          className="ml-auto rounded-md px-3 py-1.5 text-red-300"
          aria-label={`Remove ${name}`}
        >
          Remove
        </button>
      </div>
    </li>
  )
}

export default function Settings() {
  const { cat, setCat, error, setError } = useCatalog()
  const [exporting, setExporting] = useState(false)

  const setBlocks = (fn: (blocks: Block[]) => Block[]) => setCat((c) => (c ? { ...c, blocks: fn(c.blocks) } : c))
  // reports failures in the banner instead of letting them reject unhandled
  const guard =
    <A extends unknown[]>(fn: (...args: A) => Promise<void>) =>
    async (...args: A) => {
      try {
        await fn(...args)
      } catch (e) {
        setError(message(e))
      }
    }

  async function exportJson() {
    setExporting(true)
    try {
      const data = await exportAll()
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `study-tracker-${todayIST()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(message(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <main>
      <PageHeader title="Settings" />
      {error && (
        <div className="px-4 pb-3 md:px-8">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <section aria-labelledby="schedule" className="px-4 md:px-8">
        <h2 id="schedule" className="pt-1 text-xl font-medium">
          Weekly schedule
        </h2>
        <p className="mb-4 text-soft">
          Changes apply to days that haven't been planned yet. To apply them to today, use Regenerate today.
        </p>
        {!cat && !error && <p className="text-muted">Loading schedule…</p>}
        {cat && (
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {DAYS.map(([weekday, dayName]) => {
              const blocks = cat.blocks.filter((b) => b.weekday === weekday).sort((a, b) => a.sort_order - b.sort_order)
              const total = blocks.reduce((s, b) => s + b.minutes, 0)
              return (
                <section key={weekday} aria-label={dayName} className="overflow-hidden rounded-[14px] border border-line bg-card">
                  <div className="flex items-baseline justify-between px-3 pt-3 pb-1">
                    <h3 className="font-medium">{dayName}</h3>
                    <span className="text-xs text-soft tabular-nums">{total ? fmtMin(total) : 'Rest day'}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {blocks.map((b, i) => (
                      <BlockRow
                        key={b.id}
                        block={b}
                        tracks={cat.tracks}
                        first={i === 0}
                        last={i === blocks.length - 1}
                        onPatch={guard(async (patch: BlockPatch) => {
                          await updateBlock(b.id, patch)
                          setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, ...patch } : x)))
                        })}
                        onMove={guard(async (dir: -1 | 1) => {
                          const other = blocks[i + dir]
                          if (!other) return
                          await Promise.all([
                            updateBlock(b.id, { sort_order: other.sort_order }),
                            updateBlock(other.id, { sort_order: b.sort_order }),
                          ])
                          setBlocks((bs) =>
                            bs.map((x) =>
                              x.id === b.id
                                ? { ...x, sort_order: other.sort_order }
                                : x.id === other.id
                                  ? { ...x, sort_order: b.sort_order }
                                  : x,
                            ),
                          )
                        })}
                        onRemove={guard(async () => {
                          await deleteBlock(b.id)
                          setBlocks((bs) => bs.filter((x) => x.id !== b.id))
                        })}
                      />
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={guard(async () => {
                      const maxOrder = Math.max(-1, ...cat.blocks.map((b) => b.sort_order))
                      const created = await addBlock(weekday, cat.tracks[0]?.id ?? null, maxOrder + 1)
                      setBlocks((bs) => [...bs, created])
                    })}
                    className="w-full border-t border-line px-3 py-3 text-left text-xs font-medium text-accent"
                  >
                    Add block to {dayName}
                  </button>
                </section>
              )
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="data" className="mt-8 px-4 md:px-8">
        <h2 id="data" className="text-base font-medium">
          Your data
        </h2>
        <p className="mb-3 text-soft">Download every track, topic, session and plan as one JSON file.</p>
        <button
          type="button"
          onClick={() => void exportJson()}
          disabled={exporting}
          className="rounded-[10px] bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export as JSON'}
        </button>
      </section>

      <section className="mt-8 mb-8 px-4 md:px-8">
        <button
          type="button"
          onClick={() =>
            void supabase.auth.signOut().then(({ error: e }) => {
              if (e) setError(e.message)
            })
          }
          className="text-soft underline"
        >
          Sign out
        </button>
      </section>
    </main>
  )
}
