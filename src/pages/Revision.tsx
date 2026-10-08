import { Link } from 'react-router'
import ErrorBanner from '../components/ErrorBanner'
import TopicRow from '../components/TopicRow'
import { trackColor } from '../components/trackColor'
import { PageHeader } from '../components/ui'
import { useCatalog } from '../lib/useCatalog'

export default function Revision() {
  const { cat, error, setError, actions } = useCatalog()

  const groups = cat
    ? cat.tracks
        .map((track) => ({ track, topics: cat.topics.filter((t) => t.trackId === track.id && t.revision) }))
        .filter((g) => g.topics.length > 0)
    : []
  const starred = groups.reduce((n, g) => n + g.topics.length, 0)

  return (
    <main>
      <PageHeader title="Revision" />
      <header className="px-4 pb-4 md:px-8">
        <h2 className="pt-1 text-xl font-medium">Starred for revision</h2>
        {cat && groups.length > 0 && (
          <p className="text-soft tabular-nums">
            {starred} starred {starred === 1 ? 'topic' : 'topics'}
          </p>
        )}
      </header>
      <div className="px-4 md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      </div>
      {!cat && !error && <p className="px-4 text-muted md:px-8">Loading starred topics…</p>}
      {cat && groups.length === 0 && (
        <p className="px-4 text-soft md:px-8">
          Nothing starred yet. Tap the star on any topic in{' '}
          <Link to="/today" className="text-accent underline">
            Today
          </Link>{' '}
          or a{' '}
          <Link to="/tracks" className="text-accent underline">
            track
          </Link>{' '}
          to collect it here.
        </p>
      )}
      <div className="grid items-start gap-6 px-4 pb-8 md:px-8 lg:grid-cols-2 2xl:grid-cols-3">
        {groups.map(({ track, topics }) => (
          <section key={track.id} aria-label={track.name}>
            <h3 className="flex items-center gap-2 px-1 pb-2 text-[13px] font-medium">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: trackColor(track.sort_order) }} />
              {track.name}
              <span className="ml-auto text-[11px] font-normal text-muted tabular-nums">{topics.length}</span>
            </h3>
            <ul className="divide-y divide-line overflow-hidden rounded-[14px] bg-card">
              {topics.map((t) => (
                <TopicRow key={t.id} topic={t} actions={actions} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
