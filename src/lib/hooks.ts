import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { Exercise, Food } from '../db/types'
import { todayStr } from './date'

export const useProfile = () => useLiveQuery(() => db.profile.get('profile'), [])

export function useFoodMap() {
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), [])
  const map = useMemo(() => new Map<string, Food>((foods ?? []).map((f) => [f.id, f])), [foods])
  return { foods: foods ?? [], map, loading: foods === undefined }
}

export function useExerciseMap() {
  const list = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])
  const map = useMemo(() => new Map<string, Exercise>((list ?? []).map((e) => [e.id, e])), [list])
  return { exercises: list ?? [], map }
}

export const useSessions = () => useLiveQuery(() => db.sessions.toArray(), []) ?? []
export const useMeasurements = () => useLiveQuery(() => db.measurements.orderBy('date').toArray(), []) ?? []

/** Fecha de hoy que se actualiza al pasar la medianoche o al volver a la app. */
export function useToday(): string {
  const [t, setT] = useState(todayStr())
  useEffect(() => {
    const tick = () => setT(todayStr())
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return t
}
