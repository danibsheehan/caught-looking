import { lazy, Suspense } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import PageRouteSkeleton from './components/skeletons/PageRouteSkeleton';

const Standings = lazy(() => import('./pages/Standings'));
const TeamOverview = lazy(() => import('./pages/TeamOverview'));
const PlayerComparison = lazy(() => import('./pages/PlayerComparison'));
const GamesSlate = lazy(() => import('./pages/GamesSlate'));
const GameDetail = lazy(() => import('./pages/GameDetail'));
const Leaders = lazy(() => import('./pages/Leaders'));

const nav = [
  { to: '/standings', label: 'Standings' },
  { to: '/leaders', label: 'Leaders' },
  { to: '/teams', label: 'Teams' },
  { to: '/players', label: 'Players' },
  { to: '/games', label: 'Games' },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <span className="app-shell__brand-mark" aria-hidden="true" />
          <div>
            <span className="app-shell__brand-title">Caught looking</span>
            <span className="app-shell__brand-sub">MLB stats & charts</span>
          </div>
        </div>
        <div className="app-shell__header-tools">
          <nav className="app-shell__nav" aria-label="Primary">
            {nav.map(({ to, label }) => {
              const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={
                    active
                      ? 'app-shell__nav-link app-shell__nav-link--active'
                      : 'app-shell__nav-link'
                  }
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                </NavLink>
              );
            })}
          </nav>
          <div className="app-shell__status">
            <span className="app-shell__status-pulse" aria-hidden="true" />
            <span>live · statcast</span>
          </div>
        </div>
      </header>
      <main className="app-shell__main">
        <RouteErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageRouteSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/standings" replace />} />
              <Route path="/standings" element={<Standings />} />
              <Route path="/leaders" element={<Leaders />} />
              <Route path="/teams" element={<TeamOverview />} />
              <Route path="/players" element={<PlayerComparison />} />
              <Route path="/games/:gamePk" element={<GameDetail />} />
              <Route path="/games" element={<GamesSlate />} />
              <Route path="*" element={<Navigate to="/standings" replace />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
    </div>
  );
}
