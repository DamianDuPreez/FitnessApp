import { useSyncExternalStore } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth } from '../lib/firebase'
import { isStandalone } from '../lib/format'

const SKIP_KEY = 'auth-skipped'

export interface AuthState {
  /** false until Firebase has restored any saved sign-in */
  ready: boolean
  user: User | null
  /** the person chose "Continue without an account" on this device */
  skipped: boolean
  /** error from a Google redirect sign-in that came back failed */
  redirectError: string | null
}

let state: AuthState = { ready: false, user: null, skipped: readSkipped(), redirectError: null }
const listeners = new Set<() => void>()

function set(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  for (const fn of listeners) fn()
}

function readSkipped(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return false
  }
}

onAuthStateChanged(auth, (user) => set({ ready: true, user }))
// Never block the app for long if auth can't initialise (e.g. storage blocked).
setTimeout(() => {
  if (!state.ready) set({ ready: true })
}, 2500)
getRedirectResult(auth).catch((e) => set({ redirectError: authErrorMessage(e) }))

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => state,
  )
}

export function skipSignIn() {
  try {
    localStorage.setItem(SKIP_KEY, '1')
  } catch {
    /* ignore */
  }
  set({ skipped: true })
}

/** Show the sign-in screen again (from Settings). */
export function requestSignIn() {
  try {
    localStorage.removeItem(SKIP_KEY)
  } catch {
    /* ignore */
  }
  set({ skipped: false, redirectError: null })
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  // Installed apps (especially on iOS) can't open popups reliably, so redirect instead.
  if (isStandalone()) return signInWithRedirect(auth, provider)
  try {
    await signInWithPopup(auth, provider)
  } catch (e) {
    const code = e instanceof FirebaseError ? e.code : ''
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, provider)
    }
    throw e
  }
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

export async function createAccount(email: string, password: string) {
  await createUserWithEmailAndPassword(auth, email.trim(), password)
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim())
}

/** Friendly wording for the Firebase errors people actually hit. */
export function authErrorMessage(e: unknown): string {
  const code = e instanceof FirebaseError ? e.code : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'That email and password combination is not right.'
    case 'auth/invalid-email':
      return 'That email address does not look right.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.'
    case 'auth/weak-password':
      return 'Use a password of at least 6 characters.'
    case 'auth/missing-password':
      return 'Enter your password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'No internet connection. Connect and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return ''
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'This sign-in method is not switched on in Firebase yet.'
    case 'auth/unauthorized-domain':
      return 'This web address is not allowed to sign in yet. Add it under Authentication → Settings → Authorized domains.'
    default:
      return e instanceof Error ? e.message : 'Something went wrong. Try again.'
  }
}
