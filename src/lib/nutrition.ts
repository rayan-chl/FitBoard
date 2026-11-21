import type { DiaryEntry, EntryItem, Food, Macros, Profile, Recipe } from '../db/types'

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

export function scale(per100: Macros, grams: number): Macros {
  const k = (Number.isFinite(grams) ? grams : 0) / 100
  return {
    kcal: per100.kcal * k,
    protein: per100.protein * k,
    carbs: per100.carbs * k,
    fat: per100.fat * k,
    fiber: per100.fiber * k,
  }
}

export function add(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  }
}

export const sum = (list: Macros[]): Macros => list.reduce(add, ZERO)

export function itemFromFood(food: Food, grams: number): EntryItem {
  return {
    foodId: food.id,
    name: food.name,
    grams,
    unit: food.unit,
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
  }
}

/** Ingredientes de una receta como items (por 1 ración × factor). Falla si falta un alimento. */
export function itemsFromRecipe(recipe: Recipe, foods: Map<string, Food>): { items: EntryItem[]; missing: string[] } {
  const items: EntryItem[] = []
  const missing: string[] = []
  const servings = recipe.servings > 0 ? recipe.servings : 1
  for (const ing of recipe.ingredients) {
    const food = foods.get(ing.foodId)
    if (!food) {
      missing.push(ing.foodId)
      continue
    }
    items.push(itemFromFood(food, ing.grams / servings))
  }
  return { items, missing }
}

export function recipeTotals(recipe: Recipe, foods: Map<string, Food>): Macros {
  const { items } = itemsFromRecipe(recipe, foods)
  return sum(items.map((i) => scale(i, i.grams)))
}

export function entryTotals(e: DiaryEntry): Macros {
  return sum(e.items.map((i) => scale(i, i.grams * e.factor)))
}

export const dayTotals = (entries: DiaryEntry[]): Macros => sum(entries.map(entryTotals))

/** kcal calculadas a partir de macros (4/4/9, fibra 2) para detectar errores de etiqueta. */
export function kcalFromMacros(m: Macros): number {
  return m.protein * 4 + m.carbs * 4 + m.fat * 9 + m.fiber * 2
}

export function kcalMismatch(m: Macros): boolean {
  const calc = kcalFromMacros(m)
  const diff = Math.abs(calc - m.kcal)
  return m.kcal > 0 && diff / m.kcal > 0.1 && diff > 50
}

/** Mifflin-St Jeor. */
export function bmr(p: Pick<Profile, 'heightCm' | 'age' | 'sex'>, weightKg: number): number {
  return 10 * weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'hombre' ? 5 : -161)
}

export function maintenance(p: Profile, weightKg: number): number {
  return bmr(p, weightKg) * p.activityFactor
}

export interface IntakeWarning {
  level: 'muy_bajo' | 'bajo'
  message: string
}

/**
 * Avisos de ingesta baja, calculados sobre la media de los días registrados (mínimo 4).
 * Son heurísticas de producto, no criterios clínicos. Nunca recomiendan restringir.
 */
export function intakeWarnings(
  avg: Macros,
  daysLogged: number,
  profile: Profile,
  weightKg: number,
): IntakeWarning[] {
  if (daysLogged < 4) return []
  const out: IntakeWarning[] = []
  const b = bmr(profile, weightKg)
  const m = maintenance(profile, weightKg)
  const proteinPerKg = avg.protein / weightKg
  if (avg.kcal < b) {
    out.push({ level: 'muy_bajo', message: `Tu media de ${Math.round(avg.kcal)} kcal está por debajo de tu metabolismo en reposo estimado (~${Math.round(b)} kcal). Comer tan poco no ayuda a mantener músculo: plantéate subir la ingesta.` })
  } else if (avg.kcal < m * 0.75 && avg.kcal < profile.targets.kcal * 0.85) {
    // Solo si además queda claramente por debajo de TU objetivo: el mantenimiento es una estimación imprecisa.
    out.push({ level: 'bajo', message: `Tu media de ${Math.round(avg.kcal)} kcal supone un déficit de más del 25 % frente a tu mantenimiento estimado (~${Math.round(m)} kcal).` })
  }
  if (proteinPerKg < 0.8) {
    out.push({ level: 'muy_bajo', message: `Proteína media de ${Math.round(avg.protein)} g (${proteinPerKg.toFixed(2)} g/kg), muy por debajo de lo necesario para conservar masa muscular.` })
  } else if (proteinPerKg < 1.2) {
    out.push({ level: 'bajo', message: `Proteína media de ${Math.round(avg.protein)} g (${proteinPerKg.toFixed(2)} g/kg), por debajo de lo recomendado al entrenar fuerza.` })
  }
  if (avg.kcal > 0 && (avg.fat * 9) / avg.kcal < 0.2) {
    out.push({ level: 'bajo', message: `La grasa aporta menos del 20 % de tus kcal (${Math.round(avg.fat)} g de media).` })
  }
  return out
}

export const r0 = (n: number) => Math.round(n)
export const r1 = (n: number) => Math.round(n * 10) / 10
