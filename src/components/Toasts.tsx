import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, Trophy, type LucideIcon } from 'lucide-react'

interface Toast {
  id: number
  title: string
  body?: string
  kind?: 'pr' | 'info' | 'success' | 'error'
}

type Show = (t: Omit<Toast, 'id'>, ms?: number) => void

const ToastContext = createContext<Show>(() => {})

export const useToast = () => useContext(ToastContext)

let seq = 0

const KIND_ICON: Record<NonNullable<Toast['kind']>, [LucideIcon, string]> = {
  pr: [Trophy, 'icon-chip gold'],
  success: [CircleCheck, 'icon-chip'],
  error: [CircleAlert, 'icon-chip'],
  info: [Info, 'icon-chip'],
}

function ToastIcon({ kind = 'info' }: { kind?: Toast['kind'] }) {
  const [Icon, cls] = KIND_ICON[kind]
  return (
    <span className={cls} style={kind === 'error' ? { background: 'rgba(255,93,115,.14)', color: 'var(--danger)' } : undefined}>
      <Icon size={18} strokeWidth={2} />
    </span>
  )
}

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
            <ToastIcon kind={t.kind} />
            <div className="grow">
              <div className="t-title">{t.title}</div>
              {t.body && <div className="small muted">{t.body}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
