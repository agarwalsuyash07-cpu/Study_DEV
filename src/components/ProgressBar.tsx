export default function ProgressBar({ value, color = 'var(--color-accent)', label }: { value: number; color?: string; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1 w-full overflow-hidden rounded-full bg-track"
    >
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
