import { HashRouter, NavLink, Route, Routes, useLocation, Link } from 'react-router'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ExerciseMapContext, useActiveWorkout, useLoadExerciseMap, useNow } from './hooks'
import { ToastProvider } from './components/Toasts'
import { HomePage } from './pages/HomePage'
import { WorkoutPage } from './pages/WorkoutPage'
import { SummaryPage } from './pages/SummaryPage'
import { HistoryPage, WorkoutDetailPage } from './pages/HistoryPage'
import { ExerciseDetailPage, ExercisesPage } from './pages/ExercisesPage'
import { AwardsPage } from './pages/AwardsPage'
import { SettingsPage } from './pages/SettingsPage'
import { formatDuration } from './lib/units'
import { useEffect } from 'react'

const NAV = [
  { to: '/', label: 'Home', ico: '🏠' },
  { to: '/history', label: 'History', ico: '📖' },
  { to: '/exercises', label: 'Exercises', ico: '🏋️' },
  { to: '/awards', label: 'Awards', ico: '🏅' },
  { to: '/settings', label: 'Settings', ico: '⚙️' },
]

function ResumeBar() {
  const active = useActiveWorkout()
  const now = useNow(1000)
  if (!active) return null
  return (
    <Link to="/workout" className="resume-bar">
      <span>▶ Workout in progress</span>
      <span className="num">{formatDuration((now - active.startedAt) / 1000)}</span>
    </Link>
  )
}

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  if (!needRefresh) return null
  return (
    <div className="toasts" style={{ top: 'auto', bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 72px)' }}>
      <div className="toast row between">
        <span style={{ fontWeight: 700 }}>✨ New version available</span>
        <div className="row">
          <button className="btn sm ghost" onClick={() => setNeedRefresh(false)}>Later</button>
          <button className="btn sm primary" onClick={() => updateServiceWorker(true)}>Update</button>
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const fullScreen = pathname === '/workout' || pathname.startsWith('/summary')
  useEffect(() => {
    window.scrollTo(0, 0) // newer browsers return a Promise here, so don't return it from the effect
  }, [pathname])

  return (
    <>
      <main className={`app ${fullScreen ? 'no-nav' : ''}`}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/summary/:id" element={<SummaryPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<WorkoutDetailPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
          <Route path="/awards" element={<AwardsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      {!fullScreen && (
        <>
          <ResumeBar />
          <nav className="bottom-nav">
            <div className="inner">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                  <span className="ico" aria-hidden>{n.ico}</span>
                  {n.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </>
      )}
      <UpdatePrompt />
    </>
  )
}

export default function App() {
  const exMap = useLoadExerciseMap()
  return (
    <ExerciseMapContext.Provider value={exMap}>
      <ToastProvider>
        {/* Hash routing works on GitHub Pages without server rewrites */}
        <HashRouter>
          <Shell />
        </HashRouter>
      </ToastProvider>
    </ExerciseMapContext.Provider>
  )
}
