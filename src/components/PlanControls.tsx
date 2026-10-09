import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { shortTrackName } from './trackColor'

const menuBtn = 'w-full rounded-md px-3 py-2 text-left text-soft hover:bg-card hover:text-text disabled:opacity-40 disabled:hover:bg-transparent'

/** "More" menu on a plan row: reorder and defer. Native <details>, closed on outside click or Esc. */
export function ItemMenu({
  name,
  onMove,
  canUp = false,
  canDown = false,
  defers,
  minDate,
  onDefer,
}: {
  name: string
  onMove?: (dir: -1 | 1) => void
  canUp?: boolean
  canDown?: boolean
  defers: { label: string; date: string }[]
  minDate: string
  onDefer: (date: string) => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  const [date, setDate] = useState('')
  const dateId = useId()

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const d = ref.current
      if (d?.open && e.target instanceof Node && !d.contains(e.target)) d.open = false
    }
    const onKey = (e: KeyboardEvent) => {
      const d = ref.current
      if (e.key !== 'Escape' || !d?.open) return
      d.open = false
      d.querySelector('summary')?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const act = (fn: () => void) => () => {
    if (ref.current) ref.current.open = false
    fn()
  }

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={`More actions for "${name}"`}
        className="grid size-10 cursor-pointer list-none place-items-center rounded-lg text-check hover:text-soft [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
          <path d="M4.5 10h.01M10 10h.01M15.5 10h.01" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="absolute right-0 z-20 mt-1 flex w-56 flex-col rounded-[10px] border border-line bg-raised p-1 shadow-xl shadow-black/40">
        {onMove && (
          <>
            <button type="button" disabled={!canUp} onClick={act(() => onMove(-1))} className={menuBtn}>
              Move up
            </button>
            <button type="button" disabled={!canDown} onClick={act(() => onMove(1))} className={menuBtn}>
              Move down
            </button>
            <hr className="my-1 border-line" />
          </>
        )}
        {defers.map((d) => (
          <button key={d.date} type="button" onClick={act(() => onDefer(d.date))} className={menuBtn}>
            {d.label}
          </button>
        ))}
        <form
          className="flex items-center gap-1 px-1 pt-1 pb-0.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (date) act(() => onDefer(date))()
          }}
        >
          <label htmlFor={dateId} className="sr-only">
            Defer to date
          </label>
          <input
            id={dateId}
            type="date"
            required
            min={minDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-line bg-card px-2 py-1.5 text-sm [color-scheme:dark]"
          />
          <button type="submit" className="rounded-md px-2 py-1.5 text-sm font-medium text-accent">
            Move
          </button>
        </form>
      </div>
    </details>
  )
}

/** Adds a topic (picked from the list) or any free text to the day. */
export function AddItem({
  options,
  onAdd,
}: {
  options: { id: string; text: string }[]
  onAdd: (topicId: string | null, label: string | null) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const listId = useId()
  const byText = useMemo(() => new Map(options.map((o) => [o.text, o.id])), [options])

  async function submit() {
    const v = value.trim()
    if (!v) return
    const topicId = byText.get(v) ?? null
    setBusy(true)
    try {
      await onAdd(topicId, topicId ? null : v)
      setValue('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="flex gap-2">
        <input
          list={listId}
          aria-label="Add a topic or a task"
          placeholder="Add a topic or a task…"
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded-[10px] border border-line bg-card px-3 py-2.5 placeholder:text-muted"
        />
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o.id} value={o.text} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-[10px] border border-line bg-raised px-4 py-2.5 font-medium hover:border-check disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <p className="px-1 text-xs text-muted">Pick a topic from the list, or type anything as a free-text task.</p>
    </form>
  )
}

/** Track picker for checklist items like "PYQs (weakest subject)"; empty = the suggested weakest track. */
export function SubjectPicker({
  label,
  value,
  tracks,
  suggested,
  onChange,
}: {
  label: string
  value: string | null
  tracks: { id: string; name: string }[]
  suggested: string | null
  onChange: (trackId: string | null) => void
}) {
  const suggestedName = tracks.find((t) => t.id === suggested)?.name
  return (
    <select
      aria-label={`Subject for "${label}"`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="min-h-10 max-w-[12rem] min-w-0 rounded-lg border border-line bg-raised px-2 text-xs text-soft"
    >
      <option value="">{suggestedName ? `Weakest: ${shortTrackName(suggestedName)}` : 'Pick a subject'}</option>
      {tracks.map((t) => (
        <option key={t.id} value={t.id}>
          {shortTrackName(t.name)}
        </option>
      ))}
    </select>
  )
}
