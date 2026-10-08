import { NavLink, Outlet } from 'react-router'

const TABS = [
  { to: '/', label: 'Dashboard', icon: 'M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z' },
  { to: '/today', label: 'Today', icon: 'M4 5h12v12H4zM4 9h12M8 3v4M12 3v4' },
  { to: '/tracks', label: 'Tracks', icon: 'M4 4.5A1.5 1.5 0 015.5 3H16v12H5.5A1.5 1.5 0 004 16.5v-12zM4 16.5A1.5 1.5 0 005.5 18H16' },
  { to: '/week', label: 'Week', icon: 'M3 5h14M3 10h14M3 15h14M7 3v14M13 3v14' },
  { to: '/revision', label: 'Revision', icon: 'M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z' },
  { to: '/settings', label: 'Settings', icon: 'M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8' },
]

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px] shrink-0" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Layout() {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-3 py-5 md:flex">
        <p className="px-3 pb-6 text-base font-semibold">Study Tracker</p>
        <nav aria-label="Main">
          <ul className="flex flex-col gap-1">
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors ${
                      isActive ? 'bg-raised font-medium text-text [&>svg]:text-accent' : 'text-soft hover:bg-raised/60 hover:text-text'
                    }`
                  }
                >
                  <Icon d={t.icon} />
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </div>

      {/* narrow windows fall back to a bottom bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="flex">
          {TABS.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) => `flex h-14 items-center justify-center text-xs ${isActive ? 'font-medium text-accent' : 'text-soft'}`}
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
