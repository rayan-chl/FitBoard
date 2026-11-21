import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

/** Convierte texto con coma o punto decimal a número. Devuelve null si está vacío o no es válido. */
export function parseNum(v: string): number | null {
  const t = v.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export const fmtNum = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? '–' : n.toLocaleString('es-ES', { maximumFractionDigits: d })

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn('card animate-in', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="muted mt-0.5 text-sm first-letter:uppercase">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function ProgressBar({ value, max, color = 'var(--color-accent)', className }: { value: number; max: number; color?: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const over = max > 0 && value > max * 1.05
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={max}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: over ? '#f97316' : color }} />
    </div>
  )
}

export function MacroBar({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const left = target - value
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">
          <b>{fmtNum(value, 0)}</b>
          <span className="muted"> / {fmtNum(target, 0)} {unit}</span>
        </span>
      </div>
      <ProgressBar value={value} max={target} color={color} />
      <p className="muted mt-1 text-xs">{left >= 0 ? `Faltan ${fmtNum(left, 0)} ${unit}` : `Te pasas ${fmtNum(-left, 0)} ${unit}`}</p>
    </div>
  )
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card animate-in !p-3.5">
      <div className="muted flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="muted mt-0.5 text-xs">{sub}</div>}
    </div>
  )
}

export function SampleBadge({ show }: { show?: boolean }) {
  if (!show) return null
  return <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300">Ejemplo</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="muted rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm dark:border-zinc-700">{children}</div>
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex overflow-x-auto rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800/70', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition', value === o.value ? 'bg-white shadow-sm dark:bg-zinc-950' : 'muted hover:text-zinc-900 dark:hover:text-zinc-100')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cn('animate-in flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl dark:bg-zinc-900 sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <h2 className="font-semibold">{title}</h2>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 safe-bottom">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, error, hint }: { label: string; children: ReactNode; error?: string | null; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-500">{error}</span> : hint ? <span className="muted mt-1 block text-xs">{hint}</span> : null}
    </label>
  )
}

/** Input numérico que acepta coma decimal. */
export function NumInput({ value, onChange, placeholder, className = 'input', min, step, ...rest }: { value: number | null | undefined; onChange: (n: number | null) => void; placeholder?: string; className?: string; min?: number; step?: number; 'aria-label'?: string; disabled?: boolean }) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value).replace('.', ','))
  useEffect(() => {
    const cur = parseNum(text)
    if (cur !== (value ?? null)) setText(value === null || value === undefined ? '' : String(value).replace('.', ','))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      value={text}
      data-step={step}
      onChange={(e) => {
        const t = e.target.value
        if (!/^-?[0-9]*[.,]?[0-9]*$/.test(t)) return
        setText(t)
        const n = parseNum(t)
        if (n === null || min === undefined || n >= min) onChange(n)
      }}
    />
  )
}

// --- Avisos (toasts) ---
type Toast = { id: number; text: string; tone: 'ok' | 'error' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} className={cn('animate-in pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg', t.tone === 'ok' ? 'bg-zinc-900 dark:bg-zinc-700' : 'bg-red-600')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function confirmAction(msg: string) {
  return window.confirm(msg)
}
