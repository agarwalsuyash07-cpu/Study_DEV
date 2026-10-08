export default function ErrorBanner({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  if (!error) return null
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[10px] border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-red-300">
      <p className="flex-1">{error}</p>
      <button type="button" onClick={onDismiss} className="text-red-200 underline">
        Dismiss
      </button>
    </div>
  )
}
