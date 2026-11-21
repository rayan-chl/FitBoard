import type { Measurement } from '../db/types'
import { addDaysStr, diffDays } from './date'

export const MIN_WEIGHINGS_WEEK = 4

export interface WeightPoint {
  date: string
  weight: number
  avg7: number | null
}

/** Media móvil de 7 días (sobre las pesadas existentes en la ventana). Requiere ≥3 pesadas. */
export function weightSeries(measurements: Measurement[]): WeightPoint[] {
  const w = measurements.filter((m) => typeof m.weight === 'number').sort((a, b) => a.date.localeCompare(b.date))
  return w.map((m) => {
    const from = addDaysStr(m.date, -6)
    const win = w.filter((x) => x.date >= from && x.date <= m.date)
    const avg = win.length >= 3 ? win.reduce((s, x) => s + (x.weight as number), 0) / win.length : null
    return { date: m.date, weight: m.weight as number, avg7: avg }
  })
}

export function avgWeightBetween(measurements: Measurement[], from: string, to: string): { avg: number; n: number } | null {
  const w = measurements.filter((m) => typeof m.weight === 'number' && m.date >= from && m.date <= to)
  if (!w.length) return null
  return { avg: w.reduce((s, x) => s + (x.weight as number), 0) / w.length, n: w.length }
}

export function latestWeight(measurements: Measurement[]): Measurement | undefined {
  return [...measurements].filter((m) => typeof m.weight === 'number').sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function latestOf(measurements: Measurement[], key: keyof Measurement): Measurement | undefined {
  return [...measurements].filter((m) => typeof m[key] === 'number').sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function firstOf(measurements: Measurement[], key: keyof Measurement): Measurement | undefined {
  return [...measurements].filter((m) => typeof m[key] === 'number').sort((a, b) => a.date.localeCompare(b.date))[0]
}

/**
 * Ritmo de cambio de peso (%/semana) por regresión lineal sobre los últimos 21 días.
 * Devuelve null si no hay ≥14 días de rango y ≥8 pesadas: no se sacan conclusiones con pocos datos.
 */
export function weightRate(measurements: Measurement[], today: string): { kgPerWeek: number; pctPerWeek: number; days: number; n: number } | null {
  const from = addDaysStr(today, -21)
  const pts = measurements.filter((m) => typeof m.weight === 'number' && m.date >= from && m.date <= today).sort((a, b) => a.date.localeCompare(b.date))
  if (pts.length < 8) return null
  const span = diffDays(pts[pts.length - 1].date, pts[0].date)
  if (span < 14) return null
  const xs = pts.map((p) => diffDays(p.date, pts[0].date))
  const ys = pts.map((p) => p.weight as number)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const slope = den ? num / den : 0
  const kgPerWeek = slope * 7
  return { kgPerWeek, pctPerWeek: (kgPerWeek / my) * 100, days: span, n: pts.length }
}

export function rateMessage(pct: number, losing: boolean): { tone: 'ok' | 'info' | 'warn'; text: string } {
  if (!losing) return { tone: 'info', text: `Cambio de ${pct.toFixed(2)} %/semana.` }
  if (pct > 0.25) return { tone: 'info', text: 'Tendencia al alza. Revisa que el registro de comidas sea completo antes de sacar conclusiones.' }
  if (pct > -0.25) return { tone: 'info', text: 'Ritmo lento o estable. Puede ser recomposición si la cintura baja y la fuerza sube.' }
  if (pct > -0.7) return { tone: 'ok', text: 'Ritmo adecuado para recomposición.' }
  if (pct >= -1) return { tone: 'ok', text: 'Ritmo rápido, dentro del rango habitual (0,5-1 %/semana).' }
  return { tone: 'warn', text: 'Ritmo superior al 1 %/semana: demasiado rápido para preservar músculo si se mantiene.' }
}

/** Racha de días consecutivos con algún registro, contando hacia atrás desde hoy (o ayer si hoy aún no hay). */
export function streak(activeDays: Set<string>, today: string): number {
  let d = activeDays.has(today) ? today : addDaysStr(today, -1)
  let n = 0
  while (activeDays.has(d)) {
    n++
    d = addDaysStr(d, -1)
  }
  return n
}

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
