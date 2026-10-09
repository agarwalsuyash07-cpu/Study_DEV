import { useState, type LiHTMLAttributes, type ReactNode } from 'react'
import { PRACTICE_LEVELS } from '../lib/bloom'
import type { Topic, TopicPatch } from '../lib/data'
import type { Confidence } from '../lib/revision'
import { trackLink } from '../lib/links'
import { fmtMinutes, Pill } from './ui'

export type TopicActions = {
  onToggleDone: (topic: Topic, done: boolean) => Promise<void>
  /** Explicit completion time (backfill); null = not done. */
  onSetDoneAt: (topic: Topic, doneAt: string | null) => Promise<void>
  onSetConfidence: (topic: Topic, confidence: Confidence | null) => Promise<void>
  /** Spaced revision: "done" moves up the ladder, "again" resets it. */
  onReview: (topic: Topic, outcome: 'done' | 'again') => Promise<void>
  onToggleStar: (topic: Topic) => Promise<void>
  onError: (e: unknown) => void
  onOpen: (topic: Topic) => void
  onUpdate: (topic: Topic, patch: TopicPatch) => Promise<void>
}

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
  note,
  extra,
  rowProps,
}: {
  topic: Topic
  actions: TopicActions
  showModule?: boolean
  note?: ReactNode
  extra?: ReactNode
  rowProps?: LiHTMLAttributes<HTMLLIElement>
}) {
  const [busy, setBusy] = useState(false)

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
    void run(() => actions.onToggleDone(topic, !topic.done))
  }

  const link = trackLink(topic.trackId)

  return (
    <li className="px-3 py-2.5" {...rowProps}>
      <div className="flex items-start gap-3">
        <span className="pt-0.5">
          <Check checked={topic.done} label={`Mark "${topic.title}" done`} onClick={toggleDone} disabled={busy} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`leading-snug ${topic.done ? 'text-muted line-through decoration-muted/70' : 'text-soft'}`}>
            {/* title opens the topic drawer; tracks worked elsewhere keep their external link as an icon */}
            <button type="button" onClick={() => actions.onOpen(topic)} className="text-left hover:text-text hover:underline hover:underline-offset-2">
              {topic.title}
            </button>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open "${topic.title}" on the track's site (new tab)`}
                className="ml-1 inline-grid size-6 translate-y-1 place-items-center rounded text-accent hover:bg-raised"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                  <path d="M9 3h4v4M13 3L7 9M11 9.5V13H3V5h3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted tabular-nums">
            {showModule && <span className="truncate">{topic.moduleName}</span>}
            <span title={topic.estOverride ? 'Your estimate' : 'Estimated from the module'}>~{fmtMinutes(topic.estMinutes)}</span>
            {topic.bloom && <Pill>{topic.bloom}</Pill>}
            {topic.bloom && PRACTICE_LEVELS.includes(topic.bloom) && (
              <span className={topic.practiceDone ? 'text-done' : ''}>{topic.practiceDone ? 'Practice done' : 'Practice to do'}</span>
            )}
            {topic.notes && <span title="Has notes">Notes</span>}
            {note}
          </div>
        </div>
        <div className="-my-1.5 -mr-1 flex shrink-0 items-center">
          {extra}
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
    </li>
  )
}
