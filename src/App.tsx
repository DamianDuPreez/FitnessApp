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
import { ArrowRight, BookOpen, Dumbbell, House, Settings2, Sparkles, Trophy, type LucideIcon } from 'lucide-react'
import { Intro } from './components/Intro'
import { SignInScreen } from './components/SignIn'
import { useAuth } from './sync/auth'

const NAV: Array<{ to: string; label: string; Icon: LucideIcon }> = [
  { to: '/', label: 'Home', Icon: House },
  { to: '/history', label: 'History', Icon: BookOpen },
  { to: '/exercises', label: 'Lifts', Icon: Dumbbell },
  { to: '/awards', label: 'Awards', Icon: Trophy },
  { to: '/settings', label: 'Settings', Icon: Settings2 },
]

function navIndex(pathname: string): number {
  const i = NAV.findIndex((n) => n.to !== '/' && pathname.startsWith(n.to))
  return i === -1 ? 0 : i
}

function Dock({ pathname }: { pathname: string }) {
  const index = navIndex(pathname)
  return (
    <nav className="dock" aria-label="Main">
      <div className="dock-inner">
        <span className="dock-indicator" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden />
        {NAV.map(({ to, label, Icon }, i) => (
          <NavLink key={to} to={to} end={to === '/'} className={() => (i === index ? 'active' : '')}>
            <Icon size={20} strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function ResumeBar() {
  const active = useActiveWorkout()
  const now = useNow(1000)
  if (!active) return null
  return (
    <Link to="/workout" className="resume-bar">
      <span className="pulse" aria-hidden />
      <span className="grow">Session in progress</span>
      <span className="figure">{formatDuration((now - active.startedAt) / 1000)}</span>
      <ArrowRight size={18} strokeWidth={1.6} />
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
    <div className="toasts" style={{ top: 'auto', bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 64px)' }}>
      <div className="toast">
        <Sparkles size={18} className="brand" />
        <span className="t-title grow">New version available</span>
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
  const { ready, user, skipped } = useAuth()
  const fullScreen = pathname === '/workout' || pathname.startsWith('/summary')
  useEffect(() => {
    window.scrollTo(0, 0) // newer browsers return a Promise here, so don't return it from the effect
  }, [pathname])

  if (!ready) return null
  if (!user && !skipped) {
    return (
      <>
        <SignInScreen />
        <Intro />
      </>
    )
  }

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
          <Dock pathname={pathname} />
        </>
      )}
      <UpdatePrompt />
      <Intro />
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
