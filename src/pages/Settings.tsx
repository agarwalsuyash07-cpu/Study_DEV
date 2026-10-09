import { useId, useRef, useState, type DragEvent, type LiHTMLAttributes, type ReactNode } from 'react'
import ErrorBanner from '../components/ErrorBanner'
import { ConfirmDialog, ExamDateField, PageHeader } from '../components/ui'
import { parseBackup, type Backup, type BackupCounts } from '../lib/backup'
import {
  addBlock,
  deleteBlock,
  exportAll,
  importBackup,
  loadCatalog,
  MAX_BLOCK_MINUTES,
  MAX_BLOCK_TOPICS,
  restoreBlock,
  saveSettings,
  setCountInOverall,
  setExamDate,
  updateBlock,
  type Block,
  type BlockPatch,
  type Track,
} from '../lib/data'
import { todayIST } from '../lib/date'
import { reorderGroup } from '../lib/plan'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
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

const inputCls = 'rounded-lg border border-line bg-raised px-2 py-2 focus-visible:border-accent'
const MAX_IMPORT_BYTES = 10_000_000
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Labelled whole-number field that saves on blur/Enter; invalid input is flagged and not saved. */
function IntField({
  label,
  suffix,
  min,
  max,
  value,
  onSave,
  disabled,
}: {
  label: string
  suffix?: string
  min: number
  max: number
  value: number
  onSave: (n: number) => Promise<void>
  disabled?: boolean
}) {
  const id = useId()
  const [text, setText] = useState(String(value))
  const n = Number(text)
  const invalid = text.trim() === '' || !Number.isInteger(n) || n < min || n > max
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <span className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          required
          min={min}
          max={max}
          value={text}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-err` : undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (!invalid && n !== value) void onSave(n)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`${inputCls} w-20 tabular-nums ${invalid ? 'border-red-400/70' : ''}`}
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </span>
      {invalid && (
        <span id={`${id}-err`} className="text-xs text-red-300">
          {min}–{max} required
        </span>
      )}
    </div>
  )
}

function BlockRow({
  block,
  tracks,
  index,
  total,
  dragging,
  dragProps,
  onPatch,
  onMove,
  onRemove,
}: {
  block: Block
  tracks: Track[]
  index: number
  total: number
  dragging: boolean
  dragProps: Pick<LiHTMLAttributes<HTMLLIElement>, 'draggable' | 'onDragStart' | 'onDragOver' | 'onDrop' | 'onDragEnd'>
  onPatch: (patch: BlockPatch) => Promise<void>
  onMove: (to: number) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [label, setLabel] = useState(block.label ?? '')
  const name = tracks.find((t) => t.id === block.track_id)?.name ?? block.label ?? 'block'

  function saveLabel() {
    const v = label.trim()
    if (!v) {
      setLabel(block.label ?? '')
      return
    }
    if (v !== block.label) void onPatch({ label: v })
  }

  return (
    <li {...dragProps} className={`flex flex-col gap-2 px-3 py-3 ${dragging ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Reorder ${name} (${index + 1} of ${total}): use the up and down arrow keys, or drag`}
          title="Drag, or use arrow keys, to reorder"
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' && index > 0) {
              e.preventDefault()
              void onMove(index - 1)
            } else if (e.key === 'ArrowDown' && index < total - 1) {
              e.preventDefault()
              void onMove(index + 1)
            }
          }}
          className="-ml-2 grid size-10 shrink-0 cursor-grab place-items-center rounded-lg text-muted hover:text-soft active:cursor-grabbing"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M6 3.5h.01M10 3.5h.01M6 8h.01M10 8h.01M6 12.5h.01M10 12.5h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
        <select
          aria-label="Track"
          value={block.track_id ?? ''}
          onChange={(e) => {
            const trackId = e.target.value || null
            const fallback = block.label ?? 'Study block'
            if (!trackId) setLabel(fallback)
            void onPatch(trackId ? { track_id: trackId } : { track_id: null, label: fallback })
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
        <button
          type="button"
          onClick={() => void onRemove()}
          aria-label={`Remove ${name}`}
          className="-mr-2 grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:text-red-300"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="flex flex-wrap items-start gap-3 pl-8">
        {block.track_id !== null ? (
          <IntField label="Topics" min={1} max={MAX_BLOCK_TOPICS} value={block.topics} onSave={(n) => onPatch({ topics: n })} />
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={`label-${block.id}`} className="text-xs text-muted">
              Checklist item
            </label>
            <input
              id={`label-${block.id}`}
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={inputCls}
            />
          </div>
        )}
        <IntField label="Minutes" suffix="min" min={1} max={MAX_BLOCK_MINUTES} value={block.minutes} onSave={(n) => onPatch({ minutes: n })} />
      </div>
    </li>
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

/** Whole-number setting that saves on blur/Enter and snaps back if out of range. */
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

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8 px-4 md:px-8">
      <h2 id={id} className="text-base font-medium">
        {title}
      </h2>
      {intro && <p className="mb-3 text-soft">{intro}</p>}
      {children}
    </section>
  )
}

const TABLE_ORDER: (keyof BackupCounts)[] = ['tracks', 'modules', 'topics', 'revisions', 'user_settings', 'weekly_reviews', 'schedule_blocks', 'day_plan_items']
const TABLE_LABELS: Record<keyof BackupCounts, string> = {
  tracks: 'tracks',
  modules: 'modules',
  topics: 'topics (with progress and notes)',
  revisions: 'review schedules',
  user_settings: 'settings',
  weekly_reviews: 'weekly reviews',
  schedule_blocks: 'schedule blocks (existing only)',
  day_plan_items: 'plan items (existing only)',
}

export default function Settings() {
  const { cat, setCat, error, setError } = useCatalog()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const pending = useRef(0)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState<{ file: string; data: Backup; counts: BackupCounts } | null>(null)
  const [restoring, setRestoring] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const dragFrom = useRef<{ weekday: number; index: number } | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  const setBlocks = (fn: (blocks: Block[]) => Block[]) => setCat((c) => (c ? { ...c, blocks: fn(c.blocks) } : c))

  // every save goes through here: drives the "Saving… / All changes saved" indicator and reports failures
  const guard =
    <A extends unknown[]>(fn: (...args: A) => Promise<void>) =>
    async (...args: A) => {
      pending.current++
      setSaveState('saving')
      try {
        await fn(...args)
        pending.current--
        if (pending.current === 0) setSaveState('saved')
      } catch (e) {
        pending.current--
        setSaveState('error')
        setError(message(e))
      }
    }

  async function exportJson() {
    setExporting(true)
    try {
      const data = await exportAll()
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' })
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

  async function pickImport(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) {
      setError('That file is over 10 MB, which is far larger than any export.')
      return
    }
    let json: unknown
    try {
      json = JSON.parse(await file.text())
    } catch {
      setError(`${file.name} isn't valid JSON.`)
      return
    }
    const parsed = parseBackup(json)
    if (!parsed.ok) {
      setError(`Can't import ${file.name}: ${parsed.error}`)
      return
    }
    setImporting({ file: file.name, data: parsed.data, counts: parsed.counts })
  }

  async function confirmImport() {
    if (!importing) return
    setRestoring(true)
    try {
      await importBackup(importing.data)
      setCat(await loadCatalog())
      setImporting(null)
      showToast({ message: `Imported ${importing.file}`, actions: [] })
    } catch (e) {
      setError(message(e))
    } finally {
      setRestoring(false)
    }
  }

  async function moveBlock(dayBlocks: Block[], from: number, to: number) {
    const updates = reorderGroup(dayBlocks.map((b) => ({ id: b.id, sortOrder: b.sort_order })), from, to)
    if (updates.length === 0) return
    await Promise.all(updates.map((u) => updateBlock(u.id, { sort_order: u.sortOrder })))
    const next = new Map(updates.map((u) => [u.id, u.sortOrder]))
    setBlocks((bs) => bs.map((x) => (next.has(x.id) ? { ...x, sort_order: next.get(x.id)! } : x)))
  }

  async function removeBlock(b: Block) {
    await deleteBlock(b.id)
    setBlocks((bs) => bs.filter((x) => x.id !== b.id))
    showToast({
      message: 'Block removed',
      actions: [
        {
          label: 'Undo',
          run: async () => {
            const back = await restoreBlock(b)
            setBlocks((bs) => [...bs, back])
          },
        },
      ],
    })
  }

  return (
    <main>
      <PageHeader
        title="Settings"
        action={
          <span aria-live="polite" className={`text-xs ${saveState === 'error' ? 'text-red-300' : 'text-muted'}`}>
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Not saved' : 'Changes save automatically'}
          </span>
        }
      />
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
          Each block plans that many topics from its track. Drag the handle (or focus it and use the arrow keys) to reorder. Changes apply to days
          that haven't been planned yet; use Regenerate on Today to apply them now.
        </p>
        {!cat && !error && <p className="text-muted">Loading schedule…</p>}
        {cat && (
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {DAYS.map(([weekday, dayName]) => {
              const blocks = cat.blocks.filter((b) => b.weekday === weekday).sort((a, b) => a.sort_order - b.sort_order)
              const total = blocks.reduce((s, b) => (b.track_id === null ? s : s + b.topics), 0)
              const minutes = blocks.reduce((s, b) => s + b.minutes, 0)
              return (
                <section key={weekday} aria-label={dayName} className="overflow-hidden rounded-[14px] border border-line bg-card">
                  <div className="flex items-baseline justify-between px-3 pt-3 pb-1">
                    <h3 className="font-medium">{dayName}</h3>
                    <span className="text-xs text-soft tabular-nums">
                      {blocks.length === 0 ? 'Rest day' : `${total} ${total === 1 ? 'topic' : 'topics'} · ${minutes} min`}
                    </span>
                  </div>
                  <BudgetField
                    id={`budget-${weekday}`}
                    value={cat.settings.daily_budget?.[weekday] ?? null}
                    fallback={minutes}
                    onSave={guard(async (n: number | null) => {
                      const next = [...(cat.settings.daily_budget ?? Array<number | null>(7).fill(null))]
                      next[weekday] = n
                      await saveSettings({ daily_budget: next })
                      setCat((c) => (c ? { ...c, settings: { ...c.settings, daily_budget: next } } : c))
                    })}
                  />
                  <ul className="divide-y divide-line border-t border-line">
                    {blocks.map((b, i) => (
                      <BlockRow
                        key={b.id}
                        block={b}
                        tracks={cat.tracks}
                        index={i}
                        total={blocks.length}
                        dragging={dragging === b.id}
                        dragProps={{
                          draggable: true,
                          onDragStart: (e: DragEvent<HTMLLIElement>) => {
                            dragFrom.current = { weekday, index: i }
                            setDragging(b.id)
                            e.dataTransfer.effectAllowed = 'move'
                          },
                          onDragOver: (e: DragEvent<HTMLLIElement>) => {
                            if (dragFrom.current?.weekday === weekday) e.preventDefault()
                          },
                          onDrop: (e: DragEvent<HTMLLIElement>) => {
                            e.preventDefault()
                            const from = dragFrom.current
                            dragFrom.current = null
                            setDragging(null)
                            if (from?.weekday === weekday) void guard(() => moveBlock(blocks, from.index, i))()
                          },
                          onDragEnd: () => setDragging(null),
                        }}
                        onPatch={guard(async (patch: BlockPatch) => {
                          await updateBlock(b.id, patch)
                          setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, ...patch } : x)))
                        })}
                        onMove={guard((to: number) => moveBlock(blocks, i, to))}
                        onRemove={guard(() => removeBlock(b))}
                      />
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={guard(async () => {
                      const maxOrder = Math.max(-1, ...cat.blocks.map((x) => x.sort_order))
                      const created = await addBlock(weekday, cat.tracks[0]?.id ?? null, maxOrder + 1)
                      setBlocks((bs) => [...bs, created])
                    })}
                    className="min-h-11 w-full border-t border-line px-3 text-left text-xs font-medium text-accent"
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
        <Section id="streak" title="Streak rule" intro="A day keeps the streak alive when you finish enough of it.">
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
        </Section>
      )}

      {cat && (
        <Section
          id="tracks"
          title="Tracks"
          intro="Exam dates drive days left, topics needed per day and the on-track banner. Untick checklist-style tracks (like DSA) to keep them out of the overall %."
        >
          <ul className="max-w-2xl divide-y divide-line rounded-[14px] border border-line bg-card">
            {cat.tracks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                <label htmlFor={`exam-${t.id}`} className="min-w-0 flex-[1_1_12rem] truncate">
                  {t.name}
                </label>
                <label className="flex min-h-10 items-center gap-2 text-xs text-soft">
                  <input
                    type="checkbox"
                    checked={t.count_in_overall}
                    onChange={(e) => {
                      const v = e.target.checked
                      void guard(async () => {
                        await setCountInOverall(t.id, v)
                        setCat((c) => (c ? { ...c, tracks: c.tracks.map((x) => (x.id === t.id ? { ...x, count_in_overall: v } : x)) } : c))
                      })()
                    }}
                    className="size-4 accent-[var(--color-accent)]"
                  />
                  Count in overall %
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
        </Section>
      )}

      <Section id="data" title="Your data" intro="Export everything as one JSON file, or restore from an export.">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportJson()}
            disabled={exporting}
            className="min-h-11 rounded-[10px] bg-accent px-4 font-medium text-white disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export as JSON'}
          </button>
          <button
            type="button"
            onClick={() => importInput.current?.click()}
            className="min-h-11 rounded-[10px] border border-line bg-raised px-4 font-medium hover:border-check"
          >
            Import from JSON
          </button>
          <input
            ref={importInput}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              void pickImport(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </Section>

      <section className="mt-8 mb-8 px-4 md:px-8">
        <button
          type="button"
          onClick={() =>
            void supabase.auth.signOut().then(({ error: e }) => {
              if (e) setError(e.message)
            })
          }
          className="min-h-10 text-soft underline"
        >
          Sign out
        </button>
      </section>

      <ConfirmDialog
        open={importing !== null}
        title="Import this export?"
        confirmLabel="Import"
        busy={restoring}
        onConfirm={() => void confirmImport()}
        onCancel={() => setImporting(null)}
      >
        {importing && (
          <div className="flex flex-col gap-3 text-soft">
            <p>
              <span className="text-text">{importing.file}</span> will be merged in. Rows with the same id are overwritten with the file's values;
              nothing is deleted. Schedule blocks and plan items are only updated if they still exist.
            </p>
            <ul className="flex flex-col gap-0.5 text-sm">
              {TABLE_ORDER
                .filter((k) => importing.counts[k] > 0)
                .map((k) => (
                  <li key={k} className="tabular-nums">
                    {importing.counts[k]} {TABLE_LABELS[k]}
                  </li>
                ))}
            </ul>
            <p className="text-xs text-muted">Tip: export first, so you can go back.</p>
          </div>
        )}
      </ConfirmDialog>
    </main>
  )
}
