import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/ui'
import { ensureSeed } from './db/db'
import { useHashRoute } from './lib/router'
import Today from './pages/Today'

// Las secciones se cargan bajo demanda para que la pantalla HOY abra rápido.
const Training = lazy(() => import('./pages/Training'))
const Nutrition = lazy(() => import('./pages/Nutrition'))
const Progress = lazy(() => import('./pages/Progress'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const Shopping = lazy(() => import('./pages/Shopping'))
const SettingsPage = lazy(() => import('./pages/Settings'))

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error)
      return (
        <div className="card mx-auto mt-10 max-w-md">
          <h2 className="mb-2 font-semibold">Algo ha fallado</h2>
          <p className="muted mb-3 text-sm">{this.state.error.message}</p>
          <p className="muted mb-4 text-sm">Tus datos siguen guardados en el navegador. Recarga la página; si el problema continúa, exporta una copia desde Configuración.</p>
          <button className="btn-primary" onClick={() => location.reload()}>Recargar</button>
        </div>
      )
    return this.props.children
  }
}

export default function App() {
  const { route, params } = useHashRoute()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureSeed()
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (error)
    return (
      <div className="card mx-auto mt-10 max-w-md">
        <h2 className="mb-2 font-semibold">No se pudo abrir la base de datos</h2>
        <p className="muted text-sm">{error}</p>
        <p className="muted mt-2 text-sm">Comprueba que el navegador no esté en modo incógnito restringido y que permite almacenamiento local.</p>
      </div>
    )
  if (!ready) return <div className="muted grid h-dvh place-items-center text-sm">Cargando…</div>

  return (
    <ToastProvider>
      <Layout route={route}>
        <ErrorBoundary key={route}>
          <Suspense fallback={<div className="muted p-6 text-sm">Cargando…</div>}>
          {route === 'hoy' && <Today />}
          {route === 'entreno' && <Training params={params} />}
          {route === 'nutricion' && <Nutrition params={params} />}
          {route === 'progreso' && <Progress />}
          {route === 'calendario' && <CalendarPage params={params} />}
          {route === 'compra' && <Shopping />}
          {route === 'ajustes' && <SettingsPage />}
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </ToastProvider>
  )
}
