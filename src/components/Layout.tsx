import { Activity, Apple, CalendarDays, Dumbbell, Home, Moon, MoreHorizontal, Settings, ShoppingCart, Sun, TrendingUp } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { navigate, type Route } from '../lib/router'
import { cn } from './ui'

const NAV: { route: Route; label: string; icon: typeof Home }[] = [
  { route: 'hoy', label: 'Hoy', icon: Home },
  { route: 'entreno', label: 'Entreno', icon: Dumbbell },
  { route: 'nutricion', label: 'Nutrición', icon: Apple },
  { route: 'progreso', label: 'Progreso', icon: TrendingUp },
  { route: 'calendario', label: 'Calendario', icon: CalendarDays },
  { route: 'compra', label: 'Compra', icon: ShoppingCart },
  { route: 'ajustes', label: 'Configuración', icon: Settings },
]

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('fitdash-theme', next ? 'dark' : 'light')
    } catch {
      /* almacenamiento no disponible */
    }
  }
  return { dark, toggle }
}

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const { dark, toggle } = useTheme()
  const [more, setMore] = useState(false)
  const mobileMain = NAV.slice(0, 4)
  const mobileMore = NAV.slice(4)
  const moreActive = mobileMore.some((n) => n.route === route)

  return (
    <div className="lg:flex">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-zinc-200 bg-white/70 px-3 py-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 text-white">
            <Activity size={20} />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">FitDash</div>
            <div className="muted text-[11px]">Recomposición</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <a
              key={r}
              href={`#/${r}`}
              className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', route === r ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'muted hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100')}
            >
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
        <button className="btn-ghost justify-start" onClick={toggle}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {dark ? 'Tema claro' : 'Tema oscuro'}
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Cabecera móvil */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-zinc-50/85 px-4 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-[#0b0f17]/85 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500 text-white">
              <Activity size={16} />
            </div>
            <span className="text-sm font-bold">FitDash</span>
          </div>
          <button className="btn-ghost !p-2" onClick={toggle} aria-label="Cambiar tema">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
      </div>

      {/* Navegación inferior (móvil) */}
      {more && <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setMore(false)} />}
      {more && (
        <div className="animate-in fixed bottom-20 right-3 z-40 w-52 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 lg:hidden">
          {mobileMore.map(({ route: r, label, icon: Icon }) => (
            <button
              key={r}
              onClick={() => {
                setMore(false)
                navigate(r)
              }}
              className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', route === r ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800')}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      )}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 lg:hidden">
        <div className="grid grid-cols-5">
          {mobileMain.map(({ route: r, label, icon: Icon }) => (
            <a key={r} href={`#/${r}`} onClick={() => setMore(false)} className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', route === r ? 'text-emerald-600 dark:text-emerald-400' : 'muted')}>
              <Icon size={21} />
              {label}
            </a>
          ))}
          <button onClick={() => setMore((m) => !m)} className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', moreActive || more ? 'text-emerald-600 dark:text-emerald-400' : 'muted')}>
            <MoreHorizontal size={21} />
            Más
          </button>
        </div>
      </nav>
    </div>
  )
}
