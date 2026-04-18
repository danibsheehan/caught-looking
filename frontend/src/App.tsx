import { lazy, Suspense } from 'react'
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import PageRouteSkeleton from './components/skeletons/PageRouteSkeleton'

const Standings = lazy(() => import('./pages/Standings'))
const TeamOverview = lazy(() => import('./pages/TeamOverview'))
const PlayerComparison = lazy(() => import('./pages/PlayerComparison'))
const GamesSlate = lazy(() => import('./pages/GamesSlate'))
const GameDetail = lazy(() => import('./pages/GameDetail'))
const Leaders = lazy(() => import('./pages/Leaders'))

const nav = [
  { to: '/standings', label: 'Standings' },
  { to: '/teams', label: 'Teams' },
  { to: '/players', label: 'Players' },
  { to: '/games', label: 'Games' },
  { to: '/leaders', label: 'Leaders' },
]

export default function App() {
  const location = useLocation()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <span className="brand-title">Caught looking</span>
            <span className="brand-sub">MLB stats & charts</span>
          </div>
        </div>
        <nav className="app-nav" aria-label="Primary">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => {
                const active =
                  to === '/games'
                    ? isActive || location.pathname.startsWith('/games/')
                    : isActive
                return active ? 'nav-link is-active' : 'nav-link'
              }}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <RouteErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageRouteSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/standings" replace />} />
              <Route path="/standings" element={<Standings />} />
              <Route path="/teams" element={<TeamOverview />} />
              <Route path="/players" element={<PlayerComparison />} />
              <Route path="/games/:gamePk" element={<GameDetail />} />
              <Route path="/games" element={<GamesSlate />} />
              <Route path="/leaders" element={<Leaders />} />
              <Route path="*" element={<Navigate to="/standings" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
    </div>
  )
}
