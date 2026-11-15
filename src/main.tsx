import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { requestPersistentStorage, seedExercises } from './db/db'
import { initSync } from './sync/sync'

void seedExercises()
void requestPersistentStorage()
initSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
