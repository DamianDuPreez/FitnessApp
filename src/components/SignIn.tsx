import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { AppMark } from './Icons'
import {
  authErrorMessage,
  createAccount,
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  skipSignIn,
  useAuth,
} from '../sync/auth'

type Mode = 'signin' | 'create'

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function SignInScreen() {
  const { redirectError } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(redirectError)
  const [notice, setNotice] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (e) {
      setError(authErrorMessage(e) || null)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(() => (mode === 'signin' ? signInWithEmail(email, password) : createAccount(email, password)))
  }

  const forgot = () => {
    if (!email.trim()) {
      setError('Enter your email address first, then tap "Forgot password?" again.')
      return
    }
    void run(async () => {
      await resetPassword(email)
      setNotice(`We sent a password reset link to ${email.trim()}.`)
    })
  }

  return (
    <div className="intro signin" role="main" aria-label="Sign in">
      <div className="intro-inner">
        <div className="wordmark">
          <AppMark size={28} />
          <div className="wordmark-text">Fitness<span>App</span></div>
        </div>

        <div className="step-body">
          <div className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</div>
          <h1>Keep your training safe.</h1>
          <p>Sign in to back up your workouts, records and badges, and pick up right where you left off on a new phone.</p>
        </div>

        <div className="stack" style={{ marginTop: 28 }}>
          <button className="btn primary big block" disabled={busy} onClick={() => void run(signInWithGoogle)}>
            <span className="row" style={{ gap: 12 }}><GoogleMark /> Continue with Google</span>
            <ArrowRight size={20} strokeWidth={1.6} />
          </button>

          <div className="or-rule"><span>or use email</span></div>

          <form className="stack" onSubmit={submit} noValidate>
            <label className="field">
              Email
              <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              Password
              <input
                className="input"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <p className="small" role="alert" style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>}
            {notice && <p className="small" role="status" style={{ margin: 0, color: 'var(--success)' }}>{notice}</p>}
            <button className="btn block" type="submit" disabled={busy}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="row between small">
            <button className="text-btn" onClick={() => { setMode(mode === 'signin' ? 'create' : 'signin'); setError(null); setNotice(null) }}>
              {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
            </button>
            {mode === 'signin' && <button className="text-btn muted" onClick={forgot}>Forgot password?</button>}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 28 }} className="center">
          <button className="text-btn muted" onClick={skipSignIn}>Continue without an account</button>
          <p className="tiny muted" style={{ margin: '6px 0 0' }}>Your data will only be stored on this phone. You can sign in later in Settings.</p>
        </div>
      </div>
    </div>
  )
}
