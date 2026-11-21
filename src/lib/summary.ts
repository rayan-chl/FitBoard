import type { DiaryEntry, Exercise, Measurement, RoutineDay, Session } from '../db/types'
import { addDaysStr, weekStartStr } from './date'
import { dayTotals } from './nutrition'
import { avgWeightBetween, MIN_WEIGHINGS_WEEK } from './stats'
import { performanceHistory } from './training'

const n1 = (x: number) => x.toLocaleString('es-ES', { maximumFractionDigits: 1 })

export interface WeekSummary {
  weekStart: string
  weekEnd: string
  lines: { text: string; tone: 'ok' | 'info' | 'warn' }[]
  insufficient: string[]
}

/** Resumen semanal: cada frase solo aparece si hay datos suficientes; nunca se inventan conclusiones. */
export function weeklySummary(
  anyDayInWeek: string,
  sessions: Session[],
  routine: RoutineDay[],
  measurements: Measurement[],
  diary: DiaryEntry[],
  exercises: Map<string, Exercise>,
): WeekSummary {
  const ws = weekStartStr(anyDayInWeek)
  const we = addDaysStr(ws, 6)
  const prevS = addDaysStr(ws, -7)
  const prevE = addDaysStr(ws, -1)
  const lines: WeekSummary['lines'] = []
  const insufficient: string[] = []

  // Entrenamientos
  const planned = routine.filter((r) => r.type === 'gym').length
  const done = sessions.filter((s) => s.status === 'done' && s.date >= ws && s.date <= we)
  lines.push({ text: `Has completado ${done.length} de ${planned} entrenamientos esta semana.`, tone: done.length >= planned ? 'ok' : 'info' })

  // Cargas: comparar la mejor carga de esta semana con la anterior registrada
  const doneAll = sessions.filter((s) => s.status === 'done')
  for (const ex of exercises.values()) {
    if (!ex.main || ex.kind !== 'weight') continue
    const hist = performanceHistory(doneAll, ex.id)
    const thisWeek = hist.filter((h) => h.date >= ws && h.date <= we)
    const before = hist.filter((h) => h.date < ws)
    if (!thisWeek.length || !before.length) continue
    const now = Math.max(...thisWeek.map((h) => h.topWeight))
    const prev = before[before.length - 1].topWeight
    if (now > prev) lines.push({ text: `Tu ${ex.name.toLowerCase()} ha aumentado de ${n1(prev)} a ${n1(now)} kg.`, tone: 'ok' })
  }

  // Peso medio semanal
  const a = avgWeightBetween(measurements, ws, we)
  const b = avgWeightBetween(measurements, prevS, prevE)
  if (a && b && a.n >= MIN_WEIGHINGS_WEEK && b.n >= MIN_WEIGHINGS_WEEK) {
    const d = a.avg - b.avg
    if (Math.abs(d) < 0.05) lines.push({ text: `Tu peso medio semanal se ha mantenido (${n1(a.avg)} kg).`, tone: 'info' })
    else lines.push({ text: `Tu peso medio semanal ha ${d < 0 ? 'disminuido' : 'aumentado'} ${n1(Math.abs(d))} kg (${n1(b.avg)} → ${n1(a.avg)} kg).`, tone: 'info' })
  } else {
    insufficient.push(`Peso medio: hacen falta al menos ${MIN_WEIGHINGS_WEEK} pesadas en esta semana y en la anterior.`)
  }

  // Nutrición
  const byDay = new Map<string, DiaryEntry[]>()
  for (const e of diary) if (e.date >= ws && e.date <= we) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])
  const days = [...byDay.values()].filter((es) => new Set(es.map((e) => e.meal)).size >= 2)
  if (days.length >= 3) {
    const tots = days.map(dayTotals)
    const p = tots.reduce((s, t) => s + t.protein, 0) / tots.length
    const k = tots.reduce((s, t) => s + t.kcal, 0) / tots.length
    lines.push({ text: `Tu ingesta media de proteína ha sido de ${Math.round(p)} g y la de energía de ${Math.round(k)} kcal (${days.length} días registrados).`, tone: 'info' })
  } else {
    insufficient.push('Nutrición: registra al menos 3 días completos para ver medias.')
  }
  return { weekStart: ws, weekEnd: we, lines, insufficient }
}
