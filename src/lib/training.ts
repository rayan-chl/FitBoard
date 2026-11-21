import type { Exercise, Profile, RoutineDay, Session, SessionExercise, WorkSet } from '../db/types'
import { uid } from '../db/db'

/** Epley. Solo fiable entre 1 y 10 repeticiones. */
export function e1rm(weight: number, reps: number): number | null {
  if (!weight || !reps || reps < 1 || reps > 10) return null
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export const workingSets = (sets: WorkSet[]) => sets.filter((s) => s.done && !s.warmup && (s.reps ?? s.seconds ?? 0) > 0)

export interface ExercisePerformance {
  date: string
  sessionId: string
  sets: WorkSet[]
  topWeight: number
  bestE1rm: number | null
  volume: number
  totalReps: number
}

export function performanceHistory(sessions: Session[], exerciseId: string): ExercisePerformance[] {
  const out: ExercisePerformance[] = []
  const sorted = [...sessions].sort((a, b) => (a.date === b.date ? a.startedAt - b.startedAt : a.date.localeCompare(b.date)))
  for (const s of sorted) {
    for (const se of s.exercises) {
      if (se.exerciseId !== exerciseId) continue
      const ws = workingSets(se.sets)
      if (ws.length === 0) continue
      let top = 0
      let best: number | null = null
      let vol = 0
      let reps = 0
      for (const st of ws) {
        const w = st.weight ?? 0
        const r = st.reps ?? 0
        top = Math.max(top, w)
        const e = e1rm(w, r)
        if (e !== null) best = best === null ? e : Math.max(best, e)
        vol += w * r
        reps += r
      }
      out.push({ date: s.date, sessionId: s.id, sets: ws, topWeight: top, bestE1rm: best, volume: vol, totalReps: reps })
    }
  }
  return out
}

export interface PersonalRecords {
  maxWeight?: { value: number; reps: number; date: string }
  bestE1rm?: { value: number; date: string }
  bestSetVolume?: { value: number; date: string }
  bestSessionVolume?: { value: number; date: string }
  mostReps?: { value: number; weight: number; date: string }
  repRecords: { reps: number; weight: number; date: string }[]
}

export function personalRecords(history: ExercisePerformance[]): PersonalRecords {
  const pr: PersonalRecords = { repRecords: [] }
  const byReps = new Map<number, { weight: number; date: string }>()
  for (const h of history) {
    if (!pr.bestSessionVolume || h.volume > pr.bestSessionVolume.value) pr.bestSessionVolume = { value: h.volume, date: h.date }
    if (h.bestE1rm !== null && (!pr.bestE1rm || h.bestE1rm > pr.bestE1rm.value)) pr.bestE1rm = { value: h.bestE1rm, date: h.date }
    for (const s of h.sets) {
      const w = s.weight ?? 0
      const r = s.reps ?? 0
      if (!pr.maxWeight || w > pr.maxWeight.value || (w === pr.maxWeight.value && r > pr.maxWeight.reps)) pr.maxWeight = { value: w, reps: r, date: h.date }
      if (!pr.bestSetVolume || w * r > pr.bestSetVolume.value) pr.bestSetVolume = { value: w * r, date: h.date }
      if (!pr.mostReps || r > pr.mostReps.value) pr.mostReps = { value: r, weight: w, date: h.date }
      const prev = byReps.get(r)
      if (r > 0 && (!prev || w > prev.weight)) byReps.set(r, { weight: w, date: h.date })
    }
  }
  pr.repRecords = [...byReps.entries()].sort((a, b) => a[0] - b[0]).map(([reps, v]) => ({ reps, ...v }))
  return pr
}

export interface Suggestion {
  type: 'increase' | 'keep' | 'decrease' | 'stall' | 'none'
  weight?: number
  message: string
}

const fmtKg = (n: number) => `${Math.round(n * 100) / 100} kg`.replace('.', ',')

/** Doble progresión. Solo sugiere: nunca cambia pesos sin confirmación. */
export function suggestNext(
  exercise: Exercise,
  target: { sets: number; repMin: number; repMax: number },
  history: ExercisePerformance[],
  trigger: Profile['progressTrigger'],
): Suggestion {
  const last = history[history.length - 1]
  if (!last) return { type: 'none', message: 'Sin registros previos: elige un peso con el que llegues al rango con 1-3 repeticiones en reserva.' }
  const sets = last.sets
  const metric = (s: WorkSet) => (exercise.kind === 'time' ? s.seconds ?? 0 : s.reps ?? 0)
  const enoughSets = sets.length >= target.sets
  const topReached = trigger === 'first_set' ? metric(sets[0]) >= target.repMax : enoughSets && sets.every((s) => metric(s) >= target.repMax)

  // Estancamiento: 3 sesiones seguidas sin mejorar e1RM, peso ni repeticiones totales.
  if (exercise.kind === 'weight' && history.length >= 4) {
    const ref = history[history.length - 4]
    const recent = history.slice(-3)
    const improved = recent.some(
      (h) => h.topWeight > ref.topWeight || (h.bestE1rm ?? 0) > (ref.bestE1rm ?? 0) + 0.01 || (h.topWeight === ref.topWeight && h.totalReps > ref.totalReps),
    )
    if (!improved && !topReached) {
      const lower = Math.max(0, last.topWeight * 0.9)
      return { type: 'stall', weight: roundTo(lower, exercise.incrementKg || 0.5), message: `3 sesiones sin mejora. Opciones: bajar un 5-10 % (≈${fmtKg(roundTo(lower, exercise.incrementKg || 0.5))}) y volver a subir, o hacer una semana de descarga con un 30-50 % menos de series.` }
    }
  }

  if (exercise.kind !== 'weight') {
    const unit = exercise.kind === 'time' ? 's' : 'reps'
    if (topReached) return { type: 'increase', message: `Completaste el tope del rango. Prueba a añadir ${exercise.kind === 'time' ? '5 s' : '1-2 reps'} o más dificultad.` }
    return { type: 'keep', message: `Intenta sumar ${exercise.kind === 'time' ? '5 s' : '1 rep'} en alguna serie (objetivo ${target.repMax} ${unit}).` }
  }

  const weight = last.topWeight
  const inc = exercise.incrementKg || 2.5

  // Si con la última subida no se llegó al mínimo, volver a la carga anterior.
  const prev = history[history.length - 2]
  if (prev && weight > prev.topWeight && (sets[0].reps ?? 0) < target.repMin) {
    return { type: 'decrease', weight: prev.topWeight, message: `No llegaste al mínimo (${target.repMin}) con ${fmtKg(weight)}. Vuelve a ${fmtKg(prev.topWeight)} y sigue sumando repeticiones.` }
  }

  if (topReached) {
    if (weight > 0 && inc / weight > 0.1) {
      const strong = sets.every((s) => (s.reps ?? 0) >= target.repMax + 2)
      if (!strong)
        return { type: 'keep', weight, message: `Subir ${fmtKg(inc)} es más de un 10 % de la carga. Llega a ${target.repMax + 2} reps en todas las series antes de subir.` }
    }
    return { type: 'increase', weight: weight + inc, message: `Todas las series en el tope (${target.repMax}). Sugerencia: ${fmtKg(weight + inc)} la próxima sesión, solo si la técnica fue buena.` }
  }
  return { type: 'keep', weight, message: `Mantén ${fmtKg(weight)} e intenta sumar 1 rep hasta llegar a ${target.repMax} en todas las series.` }
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step
}

/** Crea una sesión a partir de la rutina, rellenando pesos con la última sesión (como referencia). */
export function buildSession(day: RoutineDay, date: string, sessions: Session[], exercises: Map<string, Exercise>): Session {
  const exs: SessionExercise[] = day.exercises.map((pe) => {
    const hist = performanceHistory(sessions, pe.exerciseId)
    const last = hist[hist.length - 1]
    const ex = exercises.get(pe.exerciseId)
    const sets: WorkSet[] = Array.from({ length: pe.sets }, (_, i) => ({
      id: uid(),
      weight: ex?.kind === 'weight' ? last?.sets[Math.min(i, last.sets.length - 1)]?.weight ?? null : null,
      reps: null,
      seconds: null,
      rir: null,
      restSec: pe.restSec ?? ex?.defaultRestSec ?? 90,
      warmup: false,
      done: false,
    }))
    return { exerciseId: pe.exerciseId, target: { sets: pe.sets, repMin: pe.repMin, repMax: pe.repMax, note: pe.note }, sets, completed: false }
  })
  return { id: uid(), date, isoDay: day.isoDay, dayName: day.name, status: 'in_progress', startedAt: Date.now(), exercises: exs }
}

/** Series efectivas por grupo muscular: principal = 1, secundario = 0,5. */
export function muscleVolume(sessions: Session[], exercises: Map<string, Exercise>): Map<string, number> {
  const vol = new Map<string, number>()
  for (const s of sessions) {
    for (const se of s.exercises) {
      const ex = exercises.get(se.exerciseId)
      if (!ex) continue
      const n = workingSets(se.sets).length
      if (!n) continue
      for (const m of ex.primary) vol.set(m, (vol.get(m) ?? 0) + n)
      for (const m of ex.secondary) vol.set(m, (vol.get(m) ?? 0) + n * 0.5)
    }
  }
  return vol
}

export const rirToRpe = (rir: number) => 10 - rir
