import { useEffect, useState } from 'react'

export type Route = 'hoy' | 'entreno' | 'nutricion' | 'progreso' | 'calendario' | 'compra' | 'ajustes'
export const ROUTES: Route[] = ['hoy', 'entreno', 'nutricion', 'progreso', 'calendario', 'compra', 'ajustes']

export interface Loc {
  route: Route
  params: URLSearchParams
}

function parse(): Loc {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, query = ''] = raw.split('?')
  const route = (ROUTES as string[]).includes(path) ? (path as Route) : 'hoy'
  return { route, params: new URLSearchParams(query) }
}

export function useHashRoute(): Loc {
  const [loc, setLoc] = useState(parse)
  useEffect(() => {
    const on = () => {
      setLoc(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return loc
}

export function navigate(route: Route, params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params).toString() : ''
  window.location.hash = `/${route}${q}`
}
