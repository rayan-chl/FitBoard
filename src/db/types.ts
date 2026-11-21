// Tipos del modelo de datos. Todas las fechas de día se guardan como 'YYYY-MM-DD' (hora local).

export type Unit = 'g' | 'ml'
export type FoodState = 'crudo' | 'seco' | 'cocinado' | 'escurrido' | 'listo'
export type Tolerance = 'bien' | 'regular' | 'mal'
export type MealType = 'desayuno' | 'comida' | 'merienda' | 'cena' | 'snacks'

export const MEALS: { id: MealType; label: string }[] = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'comida', label: 'Comida' },
  { id: 'merienda', label: 'Merienda' },
  { id: 'cena', label: 'Cena' },
  { id: 'snacks', label: 'Snacks' },
]

/** Valores nutricionales por 100 g/ml. Carbohidratos SIN fibra (convención UE). */
export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface Food extends Macros {
  id: string
  name: string
  unit: Unit
  state: FoodState
  /** Peso en g/ml de una unidad (huevo, lata, plátano, cacito...). */
  unitWeight?: number
  unitName?: string
  source: string
  verified: boolean
  custom: boolean
  tolerance?: Tolerance
  toleranceNote?: string
  updatedAt: number
}

export interface RecipeIngredient {
  foodId: string
  grams: number
}

export interface Recipe {
  id: string
  name: string
  category: MealType
  ingredients: RecipeIngredient[]
  /** Número de raciones que salen con estas cantidades. */
  servings: number
  favorite: boolean
  notes?: string
  builtin: boolean
  /** Si es una versión personalizada de otra receta. */
  parentId?: string
  updatedAt: number
}

/** Ingrediente congelado en el momento del registro (el histórico no cambia si luego editas el alimento). */
export interface EntryItem extends Macros {
  foodId: string
  name: string
  grams: number
  unit: Unit
}

export interface DiaryEntry {
  id: string
  date: string
  meal: MealType
  kind: 'food' | 'recipe'
  name: string
  recipeId?: string
  /** Multiplicador de raciones (receta) — para alimentos siempre 1. */
  factor: number
  items: EntryItem[]
  createdAt: number
  isSample?: boolean
}

export interface DayLog {
  date: string
  waterMl: number
  notes?: string
  isSample?: boolean
}

export type ExerciseKind = 'weight' | 'reps' | 'time'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  incrementKg: number
  defaultRestSec: number
  primary: string[]
  secondary: string[]
  /** Ejercicio principal para análisis de progreso. */
  main?: boolean
}

export interface PlannedExercise {
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  /** 'por lado', 'segundos', etc. */
  note?: string
  restSec?: number
}

export interface RoutineDay {
  /** 1 = lunes ... 7 = domingo */
  isoDay: number
  name: string
  type: 'gym' | 'rest'
  description: string
  activities: string[]
  exercises: PlannedExercise[]
}

export interface WorkSet {
  id: string
  weight: number | null
  reps: number | null
  seconds?: number | null
  rir?: number | null
  restSec?: number | null
  warmup: boolean
  done: boolean
}

export interface SessionExercise {
  exerciseId: string
  target: { sets: number; repMin: number; repMax: number; note?: string }
  sets: WorkSet[]
  completed: boolean
  comment?: string
}

export interface Session {
  id: string
  date: string
  isoDay: number
  dayName: string
  status: 'in_progress' | 'done'
  startedAt: number
  finishedAt?: number
  notes?: string
  exercises: SessionExercise[]
  isSample?: boolean
}

export interface Measurement {
  id: string
  date: string
  weight?: number
  waist?: number
  abdomen?: number
  chest?: number
  arm?: number
  thigh?: number
  notes?: string
  isSample?: boolean
}

export interface Photo {
  id: string
  date: string
  blob: Blob
  note?: string
  isSample?: boolean
}

export interface DigestiveLog {
  id: string
  date: string
  /** 1 (muy mal) – 5 (muy bien) */
  bowelState: number
  symptoms: string[]
  foodsNote?: string
  notes?: string
  isSample?: boolean
}

export interface ShoppingItem {
  id: string
  name: string
  qty: string
  category: string
  price: number | null
  bought: boolean
  order: number
}

export interface ShoppingWeek {
  id: string
  weekStart: string
  closedAt: number
  total: number
  budget: number
  items: ShoppingItem[]
}

export interface Profile {
  id: 'profile'
  heightCm: number
  age: number
  sex: 'hombre' | 'mujer'
  startWeight: number
  goalWeight: number
  laterGoal: string
  goal: string
  activityFactor: number
  targets: { kcal: number; protein: number; carbs: number; fat: number; waterMl: number }
  weeklyBudget: number
  startDate: string
  waistSite: string
  progressTrigger: 'all_sets' | 'first_set'
  lastBackupAt?: number
}
