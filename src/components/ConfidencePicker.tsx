import { CONFIDENCE_NAMES, type Confidence } from '../lib/revision'

/** 1–3 confidence as a radiogroup; tapping the selected value clears it. */
export default function ConfidencePicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: Confidence | null
  onChange: (c: Confidence | null) => void
  label: string
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 overflow-hidden rounded-lg border border-line">
      {([1, 2, 3] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`${c} of 3, ${CONFIDENCE_NAMES[c]}`}
          title={`Confidence: ${CONFIDENCE_NAMES[c]}`}
          disabled={disabled}
          onClick={() => onChange(value === c ? null : c)}
          className={`grid size-10 place-items-center text-sm tabular-nums transition-colors disabled:opacity-50 ${
            value === c ? (c === 1 ? 'bg-warn/20 text-warn' : 'bg-accent/20 text-accent') : 'text-soft hover:bg-raised'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
