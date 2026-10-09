import { useRef, useState } from 'react'
import { parseTopicsCsv, type TopicCsvRow } from '../lib/csv'
import { importTopics, type Module, type Track } from '../lib/data'
import { showToast } from '../lib/toast'
import { ConfirmDialog } from './ui'

const MAX_BYTES = 1_000_000

/** "Import topics (CSV)": pick a file, preview what will be added, then import atomically. */
export default function CsvImport({
  track,
  modules,
  onImported,
  onError,
}: {
  track: Track
  modules: Module[]
  onImported: () => Promise<void>
  onError: (e: unknown) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ file: string; rows: TopicCsvRow[]; errors: string[] } | null>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_BYTES) {
      onError(new Error('That CSV is over 1 MB; split it into smaller files.'))
      return
    }
    setPreview({ file: file.name, ...parseTopicsCsv(await file.text()) })
  }

  async function confirm() {
    if (!preview) return
    setBusy(true)
    try {
      const added = await importTopics(track.id, preview.rows)
      await onImported()
      setPreview(null)
      const skipped = preview.rows.length - added
      showToast({ message: `Imported ${added} ${added === 1 ? 'topic' : 'topics'}${skipped ? ` · ${skipped} already there` : ''}`, actions: [] })
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }

  const existing = new Set(modules.map((m) => m.name.toLowerCase()))
  const newModules = preview ? [...new Set(preview.rows.map((r) => r.module))].filter((m) => !existing.has(m.toLowerCase())) : []

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="min-h-10 rounded-[10px] border border-line bg-raised px-3 text-left text-sm font-medium hover:border-check"
      >
        Import topics (CSV)
      </button>
      <ConfirmDialog
        open={preview !== null}
        title={`Import into ${track.name}?`}
        confirmLabel={preview?.rows.length ? `Import ${preview.rows.length}` : 'Import'}
        confirmDisabled={!preview?.rows.length}
        busy={busy}
        onConfirm={() => void confirm()}
        onCancel={() => setPreview(null)}
      >
        {preview && (
          <div className="flex flex-col gap-3 text-soft">
            <p>
              <span className="text-text">{preview.file}</span>: {preview.rows.length} {preview.rows.length === 1 ? 'topic' : 'topics'}
              {newModules.length > 0 && `, ${newModules.length} new ${newModules.length === 1 ? 'module' : 'modules'} (${newModules.join(', ')})`}.
              Topics already in a module are skipped. Nothing is deleted.
            </p>
            {preview.errors.length > 0 && (
              <div>
                <h3 className="text-xs text-warn">Warnings ({preview.errors.length})</h3>
                <ul className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto text-xs">
                  {preview.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.rows.length > 0 && (
              <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto text-xs">
                {preview.rows.slice(0, 50).map((r, i) => (
                  <li key={i} className="truncate">
                    <span className="text-muted">{r.module} ·</span> {r.title}
                    {r.bloom && <span className="text-muted"> · {r.bloom}</span>}
                  </li>
                ))}
                {preview.rows.length > 50 && <li className="text-muted">…and {preview.rows.length - 50} more</li>}
              </ul>
            )}
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}
