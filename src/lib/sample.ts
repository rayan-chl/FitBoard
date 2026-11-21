import { db, uid } from '../db/db'
import type { DiaryEntry, Food, Measurement, Session } from '../db/types'
import { addDaysStr, isoDayOf, todayStr } from './date'
import { itemsFromRecipe } from './nutrition'
import { buildSession } from './training'

// Datos de ejemplo: TODOS llevan isSample=true, se muestran con la etiqueta "Ejemplo"
// y se eliminan de una vez desde Configuración. Nunca se generan automáticamente.

export async function loadSampleData(): Promise<void> {
  const today = todayStr()
  const foods = new Map<string, Food>((await db.foods.toArray()).map((f) => [f.id, f]))
  const recipes = await db.recipes.toArray()
  const routine = await db.routine.toArray()
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))

  const measurements: Measurement[] = []
  const diary: DiaryEntry[] = []
  const sessions: Session[] = []
  let weight = 89.4
  for (let i = 27; i >= 1; i--) {
    const date = addDaysStr(today, -i)
    weight += -0.07 + Math.sin(i * 1.7) * 0.25
    measurements.push({ id: uid(), date, weight: Math.round(weight * 10) / 10, waist: i % 7 === 0 ? Math.round((96 - (27 - i) * 0.08) * 10) / 10 : undefined, isSample: true })
    for (const [meal, rid] of [['desayuno', 'batido'], ['comida', i % 2 ? 'pollo-arroz' : 'pasta-pollo'], ['merienda', 'merienda'], ['cena', 'cena-habitual']] as const) {
      const rec = recipes.find((r) => r.id === rid)
      if (!rec) continue
      diary.push({ id: uid(), date, meal, kind: 'recipe', name: rec.name, recipeId: rec.id, factor: 1, items: itemsFromRecipe(rec, foods).items, createdAt: Date.now(), isSample: true })
    }
    const day = routine.find((r) => r.isoDay === isoDayOf(date))
    if (day && day.type === 'gym') {
      const s = buildSession(day, date, sessions, exercises)
      const week = Math.floor((27 - i) / 7)
      for (const se of s.exercises) {
        const ex = exercises.get(se.exerciseId)
        const base = se.exerciseId === 'press-banca' ? 40 : se.exerciseId === 'prensa' ? 100 : 20
        for (const st of se.sets) {
          st.weight = ex?.kind === 'weight' ? base + week * (ex.incrementKg || 2.5) : null
          st.reps = ex?.kind === 'time' ? null : se.target.repMax - (week % 2)
          st.seconds = ex?.kind === 'time' ? se.target.repMax : null
          st.rir = 2
          st.done = true
        }
        se.completed = true
      }
      s.status = 'done'
      s.finishedAt = Date.now()
      s.isSample = true
      sessions.push(s)
    }
  }
  await db.transaction('rw', db.measurements, db.diary, db.sessions, db.days, async () => {
    await db.measurements.bulkAdd(measurements)
    await db.diary.bulkAdd(diary)
    await db.sessions.bulkAdd(sessions)
  })
}

export async function countSampleData(): Promise<number> {
  const counts = await Promise.all([
    db.measurements.filter((x) => !!x.isSample).count(),
    db.diary.filter((x) => !!x.isSample).count(),
    db.sessions.filter((x) => !!x.isSample).count(),
    db.days.filter((x) => !!x.isSample).count(),
    db.digestive.filter((x) => !!x.isSample).count(),
    db.photos.filter((x) => !!x.isSample).count(),
  ])
  return counts.reduce((a, b) => a + b, 0)
}

export async function removeSampleData(): Promise<void> {
  await db.transaction('rw', [db.measurements, db.diary, db.sessions, db.days, db.digestive, db.photos], async () => {
    await db.measurements.filter((x) => !!x.isSample).delete()
    await db.diary.filter((x) => !!x.isSample).delete()
    await db.sessions.filter((x) => !!x.isSample).delete()
    await db.days.filter((x) => !!x.isSample).delete()
    await db.digestive.filter((x) => !!x.isSample).delete()
    await db.photos.filter((x) => !!x.isSample).delete()
  })
}
