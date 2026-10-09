import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import ProgressBar from './ProgressBar'

/** Sticky top bar, takeUforward style: optional back arrow + 16px title. */
export function PageHeader({ title, back, action }: { title: string; back?: { to: string; label: string }; action?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-bg/95 px-4 backdrop-blur md:h-16 md:px-8">
      {back && (
        <Link to={back.to} aria-label={back.label} className="-ml-2 grid size-10 place-items-center rounded-lg text-text">
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
            <path d="M16 10H4m0 0l5-5m-5 5l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-base font-medium md:text-lg">{title}</h1>
      {action}
    </div>
  )
}

/** Big percent + fraction + thin bar, like the A2Z sheet progress card. */
export function ProgressCard({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="rounded-[14px] border border-line bg-card px-3 py-3">
      <div className="mb-2 flex items-end justify-between">
        <span className="text-xl font-semibold tabular-nums">{pct} %</span>
        <span className="text-xs text-soft tabular-nums">
          {done} / {total}
        </span>
      </div>
      <ProgressBar value={total ? done / total : 0} label={label} />
    </div>
  )
}

const ICONS = {
  book: 'M4 4.5A1.5 1.5 0 015.5 3H16v12H5.5A1.5 1.5 0 004 16.5v-12zM4 16.5A1.5 1.5 0 005.5 18H16',
  list: 'M7 5h9M7 10h9M7 15h9M3.5 5h.01M3.5 10h.01M3.5 15h.01',
  check: 'M10 18a8 8 0 100-16 8 8 0 000 16zM6.5 10.5l2.5 2.5 4.5-5',
  flag: 'M4 18V3m0 1h10l-2 3.5 2 3.5H4',
}

export type StatItem = { icon: keyof typeof ICONS; value: ReactNode; label: string; tone?: 'warn' }

/** Icon + bold value + muted label, two per row. */
export function StatGrid({ items, cols = 'grid-cols-2' }: { items: StatItem[]; cols?: string }) {
  return (
    <dl className={`grid gap-x-4 gap-y-3 ${cols}`}>
      {items.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-soft" aria-hidden="true">
            <path d={ICONS[s.icon]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* dt first for valid markup; flex order shows the value first */}
          <dt className="order-2 min-w-0 truncate text-muted">{s.label}</dt>
          <dd className={`order-1 whitespace-nowrap font-semibold tabular-nums ${s.tone === 'warn' ? 'text-warn' : ''}`}>{s.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Short inline bar + "done/total", used on section rows. */
export function MiniProgress({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-3">
      <span className="w-16">
        <ProgressBar value={total ? done / total : 0} label={label} />
      </span>
      <span className="w-9 text-right text-[11px] text-muted tabular-nums">
        {done}/{total}
      </span>
    </span>
  )
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-4 shrink-0 text-soft transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'warn' | 'accent' }) {
  const cls =
    tone === 'warn'
      ? 'border-warn/30 bg-warn/10 text-warn'
      : tone === 'accent'
        ? 'border-accent/40 bg-accent/10 text-accent'
        : 'border-line bg-raised text-soft'
  return <span className={`rounded-md border px-1.5 py-px text-[11px] ${cls}`}>{children}</span>
}

/** Native modal dialog: focus trap, Esc and backdrop come from the browser. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  confirmDisabled,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  confirmDisabled?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[14px] border border-line bg-card p-0 text-text backdrop:bg-black/60"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="text-base font-medium">
          {title}
        </h2>
        <div className="mt-3 max-h-[60vh] overflow-y-auto">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-[10px] border border-line px-4 py-2.5 text-soft hover:text-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className="rounded-[10px] bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

/** Date input + clear button for a track's exam date; the caller saves. */
export function ExamDateField({ id, value, onSave }: { id: string; value: string | null; onSave: (v: string | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  async function save(v: string | null) {
    setBusy(true)
    try {
      await onSave(v)
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="flex items-center gap-1">
      <input
        id={id}
        type="date"
        value={value ?? ''}
        disabled={busy}
        onChange={(e) => void save(e.target.value || null)}
        className="rounded-lg border border-line bg-raised px-2 py-1.5 tabular-nums [color-scheme:dark] disabled:opacity-50"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear exam date"
          disabled={busy}
          onClick={() => void save(null)}
          className="grid size-10 place-items-center rounded-lg text-muted hover:text-text"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  )
}

/** "Revision due: N" link chip for Today and the Dashboard. */
export function RevisionDueChip({ count }: { count: number }) {
  return (
    <Link
      to="/revision"
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium ${
        count > 0 ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line text-soft'
      }`}
    >
      <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden="true">
        <path d="M4 10a6 6 0 1 0 1.8-4.3M4 3.5v2.7h2.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Revision due: <span className="tabular-nums">{count}</span>
    </Link>
  )
}
