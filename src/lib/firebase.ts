import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore/lite'

// Firebase web config. These values are public by design (they identify the project);
// access to data is protected by Firebase Auth and the Firestore security rules.
const PROJECT_AUTH_DOMAIN = 'fitnessapp-b7602.firebaseapp.com'

// When served from Firebase Hosting, sign in through the app's own domain so the
// Google redirect flow keeps working with Safari's third-party cookie blocking.
const host = typeof location === 'undefined' ? '' : location.hostname
const authDomain = host.endsWith('.web.app') || host.endsWith('.firebaseapp.com') ? host : PROJECT_AUTH_DOMAIN

export const firebaseApp = initializeApp({
  apiKey: 'AIzaSyDv8eg-IELFE8fNhF2b9D2VHlPOIsnDKiY',
  authDomain,
  projectId: 'fitnessapp-b7602',
  storageBucket: 'fitnessapp-b7602.firebasestorage.app',
  messagingSenderId: '23884564256',
  appId: '1:23884564256:web:c20b92ad2a25a609d27945',
})

export const auth = getAuth(firebaseApp)
export const firestore = getFirestore(firebaseApp)
