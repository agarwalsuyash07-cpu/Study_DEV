import { useSyncExternalStore } from 'react'
import { dismissToast, getToasts, holdToast, releaseToast, showToast, subscribeToasts, type ToastAction } from '../lib/toast'

function runAction(id: number, a: ToastAction) {
  dismissToast(id)
  Promise.resolve()
    .then(a.run)
    .catch((e: unknown) => showToast({ message: `${a.label} failed: ${e instanceof Error ? e.message : String(e)}`, actions: [], tone: 'error' }))
}

/** Bottom-centre toast stack; sits above the mobile tab bar. */
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onMouseEnter={() => holdToast(t.id)}
          onMouseLeave={() => releaseToast(t.id)}
          onFocus={() => holdToast(t.id)}
          onBlur={() => releaseToast(t.id)}
          className={`pointer-events-auto flex w-full max-w-md flex-wrap items-center gap-x-1 rounded-[12px] border bg-raised py-1.5 pr-1.5 pl-4 shadow-xl shadow-black/50 ${
            t.tone === 'error' ? 'border-red-400/40' : 'border-line'
          }`}
        >
          <p className={`min-w-[12rem] flex-1 truncate py-2 ${t.tone === 'error' ? 'text-red-300' : ''}`}>{t.message}</p>
          {t.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              aria-label={a.ariaLabel}
              onClick={() => runAction(t.id, a)}
              className="min-h-10 min-w-10 shrink-0 rounded-md px-2.5 font-medium text-accent hover:bg-card"
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
            className="grid size-10 shrink-0 place-items-center rounded-md text-muted hover:text-text"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
