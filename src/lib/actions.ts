import { db, requestPersistence, uid } from '../db/db'
import type { DiaryEntry, Food, MealType, Recipe } from '../db/types'
import { itemFromFood, itemsFromRecipe } from './nutrition'

export async function addFoodEntry(date: string, meal: MealType, food: Food, grams: number) {
  if (!(grams > 0)) throw new Error('La cantidad debe ser mayor que 0')
  const e: DiaryEntry = { id: uid(), date, meal, kind: 'food', name: food.name, factor: 1, items: [itemFromFood(food, grams)], createdAt: Date.now() }
  await db.diary.add(e)
  void requestPersistence()
  return e
}

/** Añade una receta como UNA entrada con instantánea de ingredientes (no duplica alimentos). */
export async function addRecipeEntry(date: string, meal: MealType, recipe: Recipe, factor = 1) {
  if (!(factor > 0)) throw new Error('Las raciones deben ser mayores que 0')
  const foods = new Map((await db.foods.toArray()).map((f) => [f.id, f]))
  const { items, missing } = itemsFromRecipe(recipe, foods)
  if (missing.length) throw new Error(`La receta usa alimentos que ya no existen: ${missing.join(', ')}`)
  if (!items.length) throw new Error('La receta no tiene ingredientes')
  const e: DiaryEntry = { id: uid(), date, meal, kind: 'recipe', name: recipe.name, recipeId: recipe.id, factor, items, createdAt: Date.now() }
  await db.diary.add(e)
  void requestPersistence()
  return e
}

/** Copia las entradas de una comida (o del día completo si meal es null) de un día a otro. */
export async function copyEntries(from: string, to: string, meal: MealType | null, targetMeal?: MealType) {
  const src = await db.diary.where('date').equals(from).toArray()
  const chosen = src.filter((e) => meal === null || e.meal === meal)
  const copies = chosen.map((e) => ({ ...e, id: uid(), date: to, meal: targetMeal ?? e.meal, createdAt: Date.now(), isSample: undefined }))
  await db.diary.bulkAdd(copies)
  return copies.length
}

export async function addWater(date: string, ml: number) {
  await db.transaction('rw', db.days, async () => {
    const d = await db.days.get(date)
    const waterMl = Math.max(0, (d?.waterMl ?? 0) + ml)
    await db.days.put({ ...(d ?? { date }), date, waterMl })
  })
}

export async function saveMealAsRecipe(date: string, meal: MealType, name: string) {
  const entries = (await db.diary.where('date').equals(date).toArray()).filter((e) => e.meal === meal)
  const grams = new Map<string, number>()
  for (const e of entries) for (const i of e.items) grams.set(i.foodId, (grams.get(i.foodId) ?? 0) + i.grams * e.factor)
  if (!grams.size) throw new Error('Esa comida está vacía')
  const recipe: Recipe = {
    id: uid(),
    name,
    category: meal,
    ingredients: [...grams.entries()].map(([foodId, g]) => ({ foodId, grams: Math.round(g * 10) / 10 })),
    servings: 1,
    favorite: true,
    builtin: false,
    updatedAt: Date.now(),
  }
  await db.recipes.add(recipe)
  return recipe
}
