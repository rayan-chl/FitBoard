import Dexie, { type EntityTable } from 'dexie'
import type {
  DayLog, DiaryEntry, DigestiveLog, Exercise, Food, Measurement, Photo, Profile, Recipe,
  RoutineDay, Session, ShoppingItem, ShoppingWeek,
} from './types'
import { SEED_EXERCISES, SEED_FOODS, SEED_RECIPES, SEED_ROUTINE, SEED_SHOPPING, defaultProfile } from './seed'
import { todayStr } from '../lib/date'

export const SCHEMA_VERSION = 1

export class FitDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>
  foods!: EntityTable<Food, 'id'>
  recipes!: EntityTable<Recipe, 'id'>
  diary!: EntityTable<DiaryEntry, 'id'>
  days!: EntityTable<DayLog, 'date'>
  exercises!: EntityTable<Exercise, 'id'>
  routine!: EntityTable<RoutineDay, 'isoDay'>
  sessions!: EntityTable<Session, 'id'>
  measurements!: EntityTable<Measurement, 'id'>
  photos!: EntityTable<Photo, 'id'>
  digestive!: EntityTable<DigestiveLog, 'id'>
  shopping!: EntityTable<ShoppingItem, 'id'>
  shoppingWeeks!: EntityTable<ShoppingWeek, 'id'>

  constructor(name = 'fitdash') {
    super(name)
    this.version(SCHEMA_VERSION).stores({
      profile: 'id',
      foods: 'id, name, custom',
      recipes: 'id, name, category, favorite',
      diary: 'id, date, meal, recipeId',
      days: 'date',
      exercises: 'id, name',
      routine: 'isoDay',
      sessions: 'id, date, status',
      measurements: 'id, date',
      photos: 'id, date',
      digestive: 'id, date',
      shopping: 'id, order',
      shoppingWeeks: 'id, weekStart',
    })
  }
}

export const db = new FitDB()

export const TABLES = [
  'profile', 'foods', 'recipes', 'diary', 'days', 'exercises', 'routine', 'sessions',
  'measurements', 'photos', 'digestive', 'shopping', 'shoppingWeeks',
] as const
export type TableName = (typeof TABLES)[number]

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Carga la configuración inicial la primera vez. Nunca crea registros históricos. */
export async function ensureSeed(database: FitDB = db): Promise<void> {
  await database.transaction('rw', [database.profile, database.foods, database.recipes, database.exercises, database.routine, database.shopping], async () => {
    if (!(await database.profile.get('profile'))) await database.profile.put(defaultProfile(todayStr()))
    const now = Date.now()
    if ((await database.foods.count()) === 0)
      await database.foods.bulkPut(SEED_FOODS.map((x) => ({ ...x, custom: false, updatedAt: now })))
    if ((await database.recipes.count()) === 0)
      await database.recipes.bulkPut(SEED_RECIPES.map((x) => ({ ...x, updatedAt: now })))
    if ((await database.exercises.count()) === 0) await database.exercises.bulkPut(SEED_EXERCISES)
    if ((await database.routine.count()) === 0) await database.routine.bulkPut(SEED_ROUTINE)
    if ((await database.shopping.count()) === 0) await database.shopping.bulkPut(SEED_SHOPPING)
  })
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true
      return await navigator.storage.persist()
    }
  } catch {
    /* sin soporte */
  }
  return false
}
