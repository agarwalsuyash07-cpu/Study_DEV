import { useState, type FormEvent } from 'react'
import type { Topic } from '../lib/data'
import { fmtClock, fmtMin } from '../lib/format'
import { trackLink } from '../lib/links'
import { Pill } from './ui'

export type TopicActions = {
  onToggleDone: (topic: Topic, done: boolean) => Promise<void>
  onToggleStar: (topic: Topic) => Promise<void>
  onAddMinutes: (topic: Topic, minutes: number) => Promise<void>
  onError: (e: unknown) => void
}
type Timer = { running: boolean; elapsedSec: number; onStart: () => Promise<void>; onStop: () => Promise<void> }

/** Sheet-style 16px checkbox with a 44px tap target. */
export function Check({ checked, label, onClick, disabled }: { checked: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="-m-3.5 grid size-11 shrink-0 place-items-center rounded-lg disabled:opacity-50"
    >
      <span
        className={`grid size-4 place-items-center rounded-[4px] border transition-colors ${
          checked ? 'border-done bg-done text-bg' : 'border-check'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  )
}

const iconBtn = 'grid size-10 place-items-center rounded-lg disabled:opacity-50'

export default function TopicRow({
  topic,
  actions,
  showModule = true,
  alwaysAllowMinutes = false,
  timer,
}: {
  topic: Topic
  actions: TopicActions
  showModule?: boolean
  alwaysAllowMinutes?: boolean
  timer?: Timer
}) {
  const [busy, setBusy] = useState(false)
  const [askMinutes, setAskMinutes] = useState(false)
  const [minutes, setMinutes] = useState('')

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      actions.onError(e)
    } finally {
      setBusy(false)
    }
  }

  function toggleDone() {
    const next = !topic.done
    const wasRunning = timer?.running ?? false
    void run(async () => {
      // a running timer already captures the time, so no minutes prompt then
      if (next && wasRunning) await timer?.onStop()
      await actions.onToggleDone(topic, next)
      setAskMinutes(next && !wasRunning)
    })
  }

  function submitMinutes(e: FormEvent) {
    e.preventDefault()
    const n = Number(minutes)
    if (!Number.isInteger(n) || n < 1) return
    void run(async () => {
      await actions.onAddMinutes(topic, n)
      setMinutes('')
      setAskMinutes(false)
    })
  }

  const offTimerPrompt = topic.done && !alwaysAllowMinutes
  const link = trackLink(topic.trackId)

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="pt-0.5">
          <Check checked={topic.done} label={`Mark "${topic.title}" done`} onClick={toggleDone} disabled={busy} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`leading-snug ${topic.done ? 'text-muted line-through decoration-muted/70' : 'text-soft'}`}>
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="underline decoration-accent/60 underline-offset-2 hover:text-accent">
                {topic.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              topic.title
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted tabular-nums">
            {showModule && <span className="truncate">{topic.moduleName}</span>}
            {topic.bloom && <Pill>{topic.bloom}</Pill>}
            {topic.est === null ? <Pill tone="warn">No estimate</Pill> : <span>Est {fmtMin(topic.est)}</span>}
            {topic.spentMin > 0 && <span>Spent {fmtMin(topic.spentMin)}</span>}
          </div>
        </div>
        <div className="-my-1.5 -mr-1 flex shrink-0 items-center">
          {timer && !topic.done && (
            <button
              type="button"
              onClick={() => void run(timer.running ? timer.onStop : timer.onStart)}
              disabled={busy}
              aria-label={timer.running ? `Stop timer for "${topic.title}"` : `Start timer for "${topic.title}"`}
              className={`flex h-8 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs tabular-nums disabled:opacity-50 ${
                timer.running ? 'border border-accent/40 bg-accent/10 text-accent' : 'text-soft'
              }`}
            >
              {timer.running ? (
                <>
                  <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
                    <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" />
                  </svg>
                  {fmtClock(timer.elapsedSec)}
                </>
              ) : (
                <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                  <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
                </svg>
              )}
            </button>
          )}
          {alwaysAllowMinutes && !askMinutes && (
            <button
              type="button"
              onClick={() => setAskMinutes(true)}
              aria-label={`Add minutes to "${topic.title}"`}
              className={`${iconBtn} text-soft`}
            >
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 6.5v7M6.5 10h7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button
            type="button"
            aria-pressed={topic.revision}
            aria-label={topic.revision ? `Unstar "${topic.title}"` : `Star "${topic.title}" for revision`}
            disabled={busy}
            onClick={() => void run(() => actions.onToggleStar(topic))}
            className={`${iconBtn} ${topic.revision ? 'text-warn' : 'text-check'}`}
          >
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
              <path
                d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z"
                fill={topic.revision ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      {askMinutes && (
        <form onSubmit={submitMinutes} className="mt-2 ml-7 flex flex-wrap items-center gap-2 text-xs">
          <label htmlFor={`min-${topic.id}`} className="text-muted">
            {offTimerPrompt ? 'Studied off-timer? Add minutes' : 'Add minutes'}
          </label>
          <input
            id={`min-${topic.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            required
            autoFocus
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-16 rounded-lg border border-line bg-raised px-2 py-1.5 text-sm tabular-nums outline-none focus:border-accent"
          />
          <button disabled={busy} className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-50">
            Add
          </button>
          <button type="button" onClick={() => setAskMinutes(false)} className="px-2 py-1.5 text-muted">
            {offTimerPrompt ? 'Skip' : 'Cancel'}
          </button>
        </form>
      )}
    </li>
  )
}
