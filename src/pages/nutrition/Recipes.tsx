import { useLiveQuery } from 'dexie-react-hooks'
import { CopyPlus, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Card, Empty, Field, Modal, NumInput, confirmAction, fmtNum, useToast } from '../../components/ui'
import { db, uid } from '../../db/db'
import { MEALS, type MealType, type Recipe, type RecipeIngredient } from '../../db/types'
import { addRecipeEntry } from '../../lib/actions'
import { todayStr } from '../../lib/date'
import { useFoodMap } from '../../lib/hooks'
import { recipeTotals, scale, sum } from '../../lib/nutrition'
import { FoodPickerList, MacroLine, norm } from './AddEntryModal'

export function Recipes() {
  const toast = useToast()
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? []
  const { map } = useFoodMap()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<MealType | 'fav' | 'all'>('all')
  const [editing, setEditing] = useState<Recipe | null>(null)

  const shown = recipes
    .filter((r) => norm(r.name).includes(norm(q)))
    .filter((r) => cat === 'all' || (cat === 'fav' ? r.favorite : r.category === cat))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name))

  const newRecipe = (): Recipe => ({ id: uid(), name: '', category: 'comida', ingredients: [], servings: 1, favorite: false, builtin: false, updatedAt: Date.now() })

  const duplicate = async (r: Recipe) => {
    const copy: Recipe = { ...r, id: uid(), name: `${r.name} (personalizada)`, builtin: false, parentId: r.id, favorite: false, updatedAt: Date.now() }
    await db.recipes.add(copy)
    setEditing(copy)
    toast('Versión personalizada creada')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Buscar receta…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
          <option value="all">Todas</option>
          <option value="fav">Favoritas</option>
          {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setEditing(newRecipe())}><Plus size={16} />Nueva receta</button>
      </div>

      {shown.length === 0 && <Empty>No hay recetas con ese filtro.</Empty>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((r) => {
          const t = recipeTotals(r, map)
          const missing = r.ingredients.filter((i) => !map.has(i.foodId)).length
          return (
            <Card key={r.id} className="flex flex-col">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold leading-snug">{r.name}</div>
                  <div className="muted text-xs">{MEALS.find((m) => m.id === r.category)?.label}{r.servings !== 1 && ` · por ración (${r.servings} raciones)`}{r.parentId && ' · personalizada'}</div>
                </div>
                <button className="btn-ghost !p-1.5" onClick={() => db.recipes.update(r.id, { favorite: !r.favorite })} aria-label="Favorita">
                  <Star size={18} className={r.favorite ? 'fill-amber-400 text-amber-400' : 'muted'} />
                </button>
              </div>
              <div className="my-2 grid grid-cols-4 gap-1 text-center">
                {[['kcal', t.kcal, ''], ['Prot', t.protein, 'g'], ['Carb', t.carbs, 'g'], ['Grasa', t.fat, 'g']].map(([l, v, u]) => (
                  <div key={l as string} className="rounded-lg bg-zinc-100 py-1.5 dark:bg-zinc-800/60">
                    <div className="text-sm font-bold tabular-nums">{fmtNum(v as number, 0)}{u}</div>
                    <div className="muted text-[10px]">{l}</div>
                  </div>
                ))}
              </div>
              <ul className="muted mb-3 flex-1 text-xs">
                {r.ingredients.map((i, k) => <li key={k}>{map.get(i.foodId)?.name ?? <span className="text-red-500">alimento eliminado</span>} — {fmtNum(i.grams, 0)} {map.get(i.foodId)?.unit ?? 'g'}</li>)}
              </ul>
              {missing > 0 && <p className="mb-2 text-xs text-red-500">Faltan {missing} alimento(s): edita la receta.</p>}
              {r.notes && <p className="muted mb-3 text-xs italic">{r.notes}</p>}
              <div className="flex flex-wrap items-center gap-1">
                <select
                  className="input !w-auto !py-1.5 text-xs"
                  value=""
                  onChange={async (e) => {
                    const meal = e.target.value as MealType
                    if (!meal) return
                    try {
                      await addRecipeEntry(todayStr(), meal, r, 1)
                      toast(`Añadida a ${MEALS.find((m) => m.id === meal)?.label.toLowerCase()} de hoy`)
                    } catch (err) {
                      toast(err instanceof Error ? err.message : 'Error', 'error')
                    }
                  }}
                >
                  <option value="">+ Añadir hoy a…</option>
                  {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <button className="btn-ghost !p-1.5" title="Editar" onClick={() => setEditing(r)}><Pencil size={15} /></button>
                <button className="btn-ghost !p-1.5" title="Duplicar / versión personalizada" onClick={() => duplicate(r)}><CopyPlus size={15} /></button>
                <button className="btn-ghost !p-1.5 text-red-500" title="Eliminar" onClick={() => confirmAction(`¿Eliminar la receta "${r.name}"? Los registros ya hechos no cambian.`) && db.recipes.delete(r.id)}><Trash2 size={15} /></button>
              </div>
            </Card>
          )
        })}
      </div>
      {editing && <RecipeEditor recipe={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RecipeEditor({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const toast = useToast()
  const { map } = useFoodMap()
  const [r, setR] = useState<Recipe>({ ...recipe, ingredients: recipe.ingredients.map((i) => ({ ...i })) })
  const [picking, setPicking] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const servings = r.servings > 0 ? r.servings : 1
  const total = sum(r.ingredients.map((i) => (map.get(i.foodId) ? scale(map.get(i.foodId)!, i.grams) : scale({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, 0))))
  const setIng = (idx: number, patch: Partial<RecipeIngredient>) => setR((x) => ({ ...x, ingredients: x.ingredients.map((g, j) => (j === idx ? { ...g, ...patch } : g)) }))

  const save = async () => {
    const errs: string[] = []
    if (!r.name.trim()) errs.push('Pon un nombre a la receta.')
    if (!r.ingredients.length) errs.push('Añade al menos un ingrediente.')
    if (r.ingredients.some((i) => !(i.grams > 0))) errs.push('Todas las cantidades deben ser mayores que 0.')
    if (r.ingredients.some((i) => !map.has(i.foodId))) errs.push('Hay ingredientes que ya no existen.')
    if (!(r.servings > 0)) errs.push('Las raciones deben ser mayores que 0.')
    setErrors(errs)
    if (errs.length) return
    await db.recipes.put({ ...r, name: r.name.trim(), updatedAt: Date.now() })
    toast('Receta guardada')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={recipe.name ? 'Editar receta' : 'Nueva receta'} wide>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><Field label="Nombre"><input className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field></div>
          <Field label="Categoría">
            <select className="input" value={r.category} onChange={(e) => setR({ ...r, category: e.target.value as MealType })}>
              {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
        </div>
        <div>
          <span className="label">Ingredientes (cantidad total de la receta; en crudo/seco salvo que el alimento indique otro estado)</span>
          <div className="space-y-2">
            {r.ingredients.map((i, idx) => {
              const f = map.get(i.foodId)
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{f?.name ?? <span className="text-red-500">Alimento eliminado</span>}<span className="muted text-xs"> {f && `(${f.state})`}</span></span>
                  <NumInput className="input !w-24" value={i.grams} onChange={(n) => setIng(idx, { grams: n ?? 0 })} min={0} />
                  <span className="muted w-6 text-xs">{f?.unit ?? 'g'}</span>
                  <span className="muted hidden w-16 text-right text-xs tabular-nums sm:block">{f ? fmtNum(scale(f, i.grams).kcal, 0) : 0} kcal</span>
                  <button className="btn-ghost !p-1.5 text-red-500" onClick={() => setR({ ...r, ingredients: r.ingredients.filter((_, j) => j !== idx) })} aria-label="Quitar"><Trash2 size={14} /></button>
                </div>
              )
            })}
          </div>
          {picking ? (
            <div className="mt-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
              <FoodPickerList onPick={(f) => { setR({ ...r, ingredients: [...r.ingredients, { foodId: f.id, grams: f.unitWeight ?? 100 }] }); setPicking(false) }} />
              <button className="btn-ghost mt-1 text-xs" onClick={() => setPicking(false)}>Cancelar</button>
            </div>
          ) : (
            <button className="btn-secondary mt-2 text-sm" onClick={() => setPicking(true)}><Plus size={15} />Ingrediente</button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Raciones que salen" hint="Los macros se muestran por ración"><NumInput value={r.servings} onChange={(n) => setR({ ...r, servings: n ?? 0 })} min={0} /></Field>
          <div className="sm:col-span-2"><Field label="Notas"><input className="input" value={r.notes ?? ''} onChange={(e) => setR({ ...r, notes: e.target.value })} /></Field></div>
        </div>
        <div className="rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800/60">
          <div className="font-medium">Por ración</div>
          <MacroLine m={{ kcal: total.kcal / servings, protein: total.protein / servings, carbs: total.carbs / servings, fat: total.fat / servings }} />
          <span className="muted text-xs"> · fibra {fmtNum(total.fiber / servings, 0)} g</span>
          <p className="muted mt-1 text-xs">Calculado a partir de los ingredientes. Ajusta los valores de cada alimento en la pestaña Alimentos.</p>
        </div>
        {errors.length > 0 && <ul className="text-sm text-red-500">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </Modal>
  )
}
