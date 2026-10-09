import { useState } from 'react'
import ErrorBanner from '../components/ErrorBanner'
import { addBlock, deleteBlock, exportAll, MAX_BLOCK_TOPICS, saveSettings, setExamDate, updateBlock, type Block, type Track } from '../lib/data'
import { todayIST } from '../lib/date'
import { ExamDateField, PageHeader } from '../components/ui'
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
type BlockPatch = Partial<Pick<Block, 'track_id' | 'label' | 'topics' | 'sort_order'>>

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
  const [count, setCount] = useState(String(block.topics))
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

  function saveCount() {
    const n = Number(count)
    if (!Number.isInteger(n) || n < 1 || n > MAX_BLOCK_TOPICS) {
      setCount(String(block.topics))
      return
    }
    if (n !== block.topics) void run(() => onPatch({ topics: n }))
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
        {block.track_id !== null && (
          <>
            <input
              aria-label={`Topics for ${name}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_BLOCK_TOPICS}
              value={count}
              disabled={busy}
              onChange={(e) => setCount(e.target.value)}
              onBlur={saveCount}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={`${inputCls} w-16 tabular-nums`}
            />
            <span className="text-sm text-muted">topics</span>
          </>
        )}
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

/** Whole-number field that saves on blur/Enter and snaps back if out of range. */
function NumberSetting({
  id,
  label,
  suffix,
  min,
  max,
  value,
  onSave,
}: {
  id: string
  label: string
  suffix?: string
  min: number
  max: number
  value: number
  onSave: (n: number) => Promise<void>
}) {
  const [text, setText] = useState(String(value))
  function commit() {
    const n = Number(text)
    if (!Number.isInteger(n) || n < min || n > max) {
      setText(String(value))
      return
    }
    if (n !== value) void onSave(n)
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-soft">
        {label}
      </label>
      <span className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`${inputCls} w-20 tabular-nums`}
        />
        {suffix && <span className="w-3 text-sm text-muted">{suffix}</span>}
      </span>
    </div>
  )
}

/** Daily minutes budget; empty = use the sum of the day's block minutes (shown as the placeholder). */
function BudgetField({ id, value, fallback, onSave }: { id: string; value: number | null; fallback: number; onSave: (n: number | null) => Promise<void> }) {
  const [text, setText] = useState(value === null ? '' : String(value))
  function commit() {
    const t = text.trim()
    if (t === '') {
      if (value !== null) void onSave(null)
      return
    }
    const n = Number(t)
    if (!Number.isInteger(n) || n < 0 || n > 1440) {
      setText(value === null ? '' : String(value))
      return
    }
    if (n !== value) void onSave(n)
  }
  return (
    <div className="flex items-center gap-2 px-3 pb-2 text-xs text-soft">
      <label htmlFor={id}>Time budget</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={1440}
        placeholder={String(fallback)}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`${inputCls} w-20 py-1.5 tabular-nums placeholder:text-muted`}
      />
      <span>min</span>
      {value === null && <span className="text-muted">(from blocks)</span>}
    </div>
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
              const total = blocks.reduce((s, b) => (b.track_id === null ? s : s + b.topics), 0)
              return (
                <section key={weekday} aria-label={dayName} className="overflow-hidden rounded-[14px] border border-line bg-card">
                  <div className="flex items-baseline justify-between px-3 pt-3 pb-1">
                    <h3 className="font-medium">{dayName}</h3>
                    <span className="text-xs text-soft tabular-nums">{blocks.length === 0 ? 'Rest day' : total ? `${total} ${total === 1 ? 'topic' : 'topics'}` : ''}</span>
                  </div>
                  <BudgetField
                    id={`budget-${weekday}`}
                    value={cat.settings.daily_budget?.[weekday] ?? null}
                    fallback={blocks.reduce((n, b) => n + b.minutes, 0)}
                    onSave={guard(async (minutes: number | null) => {
                      const next = [...(cat.settings.daily_budget ?? Array<number | null>(7).fill(null))]
                      next[weekday] = minutes
                      await saveSettings({ daily_budget: next })
                      setCat((c) => (c ? { ...c, settings: { ...c.settings, daily_budget: next } } : c))
                    })}
                  />
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

      {cat && (
        <section aria-labelledby="streak" className="mt-8 px-4 md:px-8">
          <h2 id="streak" className="text-base font-medium">
            Streak rule
          </h2>
          <p className="mb-3 text-soft">A day keeps the streak alive when you finish enough of it.</p>
          <div className="flex max-w-xl flex-col gap-2 rounded-[14px] border border-line bg-card px-3 py-3">
            <NumberSetting
              id="streak-pct"
              label="Share of the day's plan"
              suffix="%"
              min={1}
              max={100}
              value={cat.settings.streak_plan_pct}
              onSave={guard(async (n: number) => {
                await saveSettings({ streak_plan_pct: n })
                setCat((c) => (c ? { ...c, settings: { ...c.settings, streak_plan_pct: n } } : c))
              })}
            />
            <NumberSetting
              id="streak-min"
              label="Topics on a day with no plan"
              min={1}
              max={50}
              value={cat.settings.streak_min_no_plan}
              onSave={guard(async (n: number) => {
                await saveSettings({ streak_min_no_plan: n })
                setCat((c) => (c ? { ...c, settings: { ...c.settings, streak_min_no_plan: n } } : c))
              })}
            />
            <p className="text-xs text-muted">At least one item always counts on a planned day.</p>
          </div>
        </section>
      )}

      {cat && (
        <section aria-labelledby="exams" className="mt-8 px-4 md:px-8">
          <h2 id="exams" className="text-base font-medium">
            Exam dates
          </h2>
          <p className="mb-3 text-soft">Used for days left, topics needed per day and the on-track banner.</p>
          <ul className="max-w-xl divide-y divide-line rounded-[14px] border border-line bg-card">
            {cat.tracks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <label htmlFor={`exam-${t.id}`} className="min-w-0 flex-1 truncate">
                  {t.name}
                </label>
                <ExamDateField
                  id={`exam-${t.id}`}
                  value={t.exam_date}
                  onSave={guard(async (v: string | null) => {
                    await setExamDate(t.id, v)
                    setCat((c) => (c ? { ...c, tracks: c.tracks.map((x) => (x.id === t.id ? { ...x, exam_date: v } : x)) } : c))
                  })}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="data" className="mt-8 px-4 md:px-8">
        <h2 id="data" className="text-base font-medium">
          Your data
        </h2>
        <p className="mb-3 text-soft">Download every track, topic, schedule block and plan as one JSON file.</p>
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
