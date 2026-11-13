import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  title: string
  body?: string
  kind?: 'pr' | 'info'
}

type Show = (t: Omit<Toast, 'id'>, ms?: number) => void

const ToastContext = createContext<Show>(() => {})

export const useToast = () => useContext(ToastContext)

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback<Show>((t, ms = 3500) => {
    const id = ++seq
    setToasts((list) => [...list.slice(-2), { ...t, id }])
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), ms)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.kind ?? ''}`}
            onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
          >
            <div style={{ fontWeight: 800 }}>{t.title}</div>
            {t.body && <div className="small muted">{t.body}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
