import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { SEED_EXERCISES, SEED_FOODS, SEED_RECIPES } from '../src/db/seed'
import type { Food, Session, WorkSet } from '../src/db/types'
import { addDaysStr, isoDayOf, weekStartStr } from '../src/lib/date'
import { entryTotals, intakeWarnings, itemsFromRecipe, recipeTotals, scale } from '../src/lib/nutrition'
import { rateMessage, streak, weightRate, weightSeries } from '../src/lib/stats'
import { e1rm, muscleVolume, performanceHistory, suggestNext } from '../src/lib/training'
import { defaultProfile } from '../src/db/seed'

const foods = new Map<string, Food>(SEED_FOODS.map((f) => [f.id, { ...f, custom: false, updatedAt: 0 }]))
const exMap = new Map(SEED_EXERCISES.map((e) => [e.id, e]))

describe('nutrición', () => {
  it('recalcula macros por cantidad (whey 30 g → 45 g)', () => {
    const whey = { kcal: 400, protein: 80, carbs: 5, fat: 5, fiber: 0 } // 30 g = 120 kcal, 24 g P
    expect(scale(whey, 30).kcal).toBeCloseTo(120)
    expect(scale(whey, 30).protein).toBeCloseTo(24)
    expect(scale(whey, 45).kcal).toBeCloseTo(180)
    expect(scale(whey, 45).protein).toBeCloseTo(36)
  })
  it('calcula las recetas desde sus ingredientes (sin valores fijos)', () => {
    const batido = SEED_RECIPES.find((r) => r.id === 'batido')!
    const t = recipeTotals({ ...batido, updatedAt: 0 }, foods)
    expect(t.kcal).toBeGreaterThan(500)
    expect(t.kcal).toBeLessThan(540)
    expect(t.protein).toBeGreaterThan(40)
    const merluza = recipeTotals({ ...SEED_RECIPES.find((r) => r.id === 'merluza-patatas')!, updatedAt: 0 }, foods)
    expect(Math.round(merluza.kcal)).toBeGreaterThan(550)
  })
  it('todas las recetas precargadas usan alimentos existentes', () => {
    for (const r of SEED_RECIPES) expect(itemsFromRecipe({ ...r, updatedAt: 0 }, foods).missing).toEqual([])
  })
  it('una receta se registra como una única entrada que escala con las raciones', () => {
    const r = { ...SEED_RECIPES.find((x) => x.id === 'pollo-arroz')!, updatedAt: 0 }
    const { items } = itemsFromRecipe(r, foods)
    const e = { id: 'x', date: '2026-11-21', meal: 'comida' as const, kind: 'recipe' as const, name: r.name, factor: 1.5, items, createdAt: 0 }
    expect(entryTotals(e).kcal).toBeCloseTo(recipeTotals(r, foods).kcal * 1.5)
  })
  it('respeta las raciones de la receta', () => {
    const r = { ...SEED_RECIPES[1], servings: 2, updatedAt: 0 }
    expect(recipeTotals(r, foods).kcal).toBeCloseTo(recipeTotals({ ...r, servings: 1 }, foods).kcal / 2)
  })
  it('avisa de ingesta muy baja solo con suficientes días', () => {
    const p = defaultProfile('2026-11-21')
    const low = { kcal: 1500, protein: 60, carbs: 150, fat: 40, fiber: 20 }
    expect(intakeWarnings(low, 3, p, 89)).toEqual([])
    const w = intakeWarnings(low, 5, p, 89)
    expect(w.some((x) => x.level === 'muy_bajo')).toBe(true)
    expect(intakeWarnings({ kcal: 2250, protein: 150, carbs: 250, fat: 70, fiber: 25 }, 7, p, 89)).toEqual([])
  })
})

describe('fechas', () => {
  it('semana empieza en lunes y getISODay', () => {
    expect(weekStartStr('2026-11-21')).toBe('2026-11-16')
    expect(isoDayOf('2026-11-16')).toBe(1)
    expect(isoDayOf('2026-11-22')).toBe(7)
    expect(addDaysStr('2026-03-28', 2)).toBe('2026-03-30') // cambio de hora
  })
})

const mkSession = (date: string, exerciseId: string, sets: [number, number][]): Session => ({
  id: date + exerciseId, date, isoDay: 1, dayName: 'PUSH', status: 'done', startedAt: 0,
  exercises: [{ exerciseId, target: { sets: 3, repMin: 8, repMax: 10 }, completed: true, sets: sets.map(([w, r], i): WorkSet => ({ id: String(i), weight: w, reps: r, warmup: false, done: true })) }],
})

describe('entrenamiento', () => {
  const bench = exMap.get('press-banca')!
  const target = { sets: 3, repMin: 8, repMax: 10 }
  it('e1RM solo con 1-10 reps', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(60, 10)).toBeCloseTo(80)
    expect(e1rm(60, 12)).toBeNull()
  })
  it('sugiere subir cuando todas las series llegan al tope', () => {
    const h = performanceHistory([mkSession('2026-11-02', 'press-banca', [[40, 10], [40, 10], [40, 10]])], 'press-banca')
    const s = suggestNext(bench, target, h, 'all_sets')
    expect(s.type).toBe('increase')
    expect(s.weight).toBe(42.5)
  })
  it('mantiene si alguna serie no llega al tope', () => {
    const h = performanceHistory([mkSession('2026-11-02', 'press-banca', [[40, 10], [40, 10], [42.5, 8]])], 'press-banca')
    expect(suggestNext(bench, target, h, 'all_sets').type).toBe('keep')
    expect(suggestNext(bench, target, h, 'first_set').type).toBe('increase')
  })
  it('vuelve a la carga anterior si no llega al mínimo tras subir', () => {
    const h = performanceHistory([
      mkSession('2026-11-02', 'press-banca', [[40, 10], [40, 10], [40, 10]]),
      mkSession('2026-11-09', 'press-banca', [[42.5, 6], [42.5, 6], [42.5, 5]]),
    ], 'press-banca')
    const s = suggestNext(bench, target, h, 'all_sets')
    expect(s.type).toBe('decrease')
    expect(s.weight).toBe(40)
  })
  it('incremento >10 % exige más reps antes de subir', () => {
    const lat = exMap.get('elev-laterales')!
    const h = performanceHistory([mkSession('2026-11-02', 'elev-laterales', [[8, 15], [8, 15], [8, 15]])], 'elev-laterales')
    // +1 kg sobre 8 kg = 12,5 % → primero pedir 17 reps
    expect(suggestNext(lat, { sets: 3, repMin: 15, repMax: 15 }, h, 'all_sets').type).toBe('keep')
    const h2 = performanceHistory([mkSession('2026-11-02', 'elev-laterales', [[8, 17], [8, 17], [8, 17]])], 'elev-laterales')
    expect(suggestNext(lat, { sets: 3, repMin: 15, repMax: 15 }, h2, 'all_sets').weight).toBe(9)
  })
  it('volumen fraccional por músculo', () => {
    const v = muscleVolume([mkSession('2026-11-02', 'press-banca', [[40, 10], [40, 10], [40, 10]])], exMap)
    expect(v.get('Pecho')).toBe(3)
    expect(v.get('Tríceps')).toBe(1.5)
  })
})

describe('estadísticas', () => {
  it('no calcula ritmo con pocos datos', () => {
    expect(weightRate([{ id: '1', date: '2026-11-20', weight: 89 }], '2026-11-21')).toBeNull()
  })
  it('ritmo por regresión con datos suficientes', () => {
    const ms = Array.from({ length: 21 }, (_, i) => ({ id: String(i), date: addDaysStr('2026-11-01', i), weight: 89 - i * 0.07 }))
    const r = weightRate(ms, '2026-11-21')!
    expect(r.kgPerWeek).toBeCloseTo(-0.49, 1)
    expect(rateMessage(r.pctPerWeek, true).tone).toBe('ok')
  })
  it('media móvil exige 3 pesadas', () => {
    const s = weightSeries([{ id: 'a', date: '2026-11-01', weight: 89 }, { id: 'b', date: '2026-11-02', weight: 88 }, { id: 'c', date: '2026-11-03', weight: 87 }])
    expect(s[1].avg7).toBeNull()
    expect(s[2].avg7).toBeCloseTo(88)
  })
  it('racha', () => {
    expect(streak(new Set(['2026-11-19', '2026-11-20']), '2026-11-21')).toBe(2)
    expect(streak(new Set(['2026-11-21', '2026-11-20', '2026-11-18']), '2026-11-21')).toBe(2)
  })
})
