import { useLiveQuery } from 'dexie-react-hooks'
import { BadgeCheck, Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Empty, Field, Modal, NumInput, Segmented, cn, fmtNum, useToast } from '../../components/ui'
import { db } from '../../db/db'
import { MEALS, type Food, type MealType, type Recipe } from '../../db/types'
import { addFoodEntry, addRecipeEntry } from '../../lib/actions'
import { useFoodMap } from '../../lib/hooks'
import { recipeTotals, scale } from '../../lib/nutrition'

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function MacroLine({ m, className }: { m: { kcal: number; protein: number; carbs: number; fat: number }; className?: string }) {
  return (
    <span className={cn('muted text-xs tabular-nums', className)}>
      <b className="text-zinc-700 dark:text-zinc-200">{fmtNum(m.kcal, 0)} kcal</b> · P {fmtNum(m.protein, 0)} · C {fmtNum(m.carbs, 0)} · G {fmtNum(m.fat, 0)}
    </span>
  )
}

export function FoodPickerList({ onPick, selectedId }: { onPick: (f: Food) => void; selectedId?: string }) {
  const { foods } = useFoodMap()
  const [q, setQ] = useState('')
  const list = useMemo(() => foods.filter((f) => norm(f.name).includes(norm(q))), [foods, q])
  return (
    <div>
      <div className="relative mb-2">
        <Search size={16} className="muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input className="input pl-9" placeholder="Buscar alimento…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        {list.length === 0 && <p className="muted p-3 text-sm">Sin resultados. Puedes crear el alimento en la pestaña Alimentos.</p>}
        {list.map((f) => (
          <button key={f.id} type="button" onClick={() => onPick(f)} className={cn('flex w-full items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60', selectedId === f.id && 'bg-emerald-500/10')}>
            <span className="flex items-center gap-1.5">
              {f.name}
              {f.verified && <BadgeCheck size={14} className="text-emerald-500" />}
              {f.tolerance === 'mal' && <span className="chip bg-red-500/10 text-red-600">no tolerado</span>}
            </span>
            <span className="muted shrink-0 text-xs tabular-nums">{fmtNum(f.kcal, 0)} kcal/100{f.unit}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function AddEntryModal({ open, onClose, date, meal: initialMeal }: { open: boolean; onClose: () => void; date: string; meal: MealType }) {
  const toast = useToast()
  const [tab, setTab] = useState<'recetas' | 'alimentos'>('recetas')
  const [meal, setMeal] = useState<MealType>(initialMeal)
  const [food, setFood] = useState<Food | null>(null)
  const [grams, setGrams] = useState<number | null>(100)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [factor, setFactor] = useState<number | null>(1)
  const [q, setQ] = useState('')
  const { map } = useFoodMap()
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? []
  const shown = recipes
    .filter((r) => norm(r.name).includes(norm(q)))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || Number(b.category === meal) - Number(a.category === meal) || a.name.localeCompare(b.name))

  const reset = () => {
    setFood(null)
    setRecipe(null)
    setGrams(100)
    setFactor(1)
    setQ('')
  }
  const close = () => {
    reset()
    onClose()
  }

  const submit = async () => {
    try {
      if (tab === 'alimentos') {
        if (!food) return
        if (!grams || grams <= 0) return toast('Introduce una cantidad válida', 'error')
        await addFoodEntry(date, meal, food, grams)
        toast(`${food.name} añadido`)
      } else {
        if (!recipe) return
        if (!factor || factor <= 0) return toast('Introduce las raciones', 'error')
        await addRecipeEntry(date, meal, recipe, factor)
        toast(`${recipe.name} añadida`)
      }
      close()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar', 'error')
    }
  }

  return (
    <Modal open={open} onClose={close} title="Añadir al registro">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={(v) => { setTab(v); reset() }} options={[{ value: 'recetas', label: 'Recetas' }, { value: 'alimentos', label: 'Alimentos' }]} />
        <select className="input !w-auto" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
          {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      {tab === 'alimentos' ? (
        <div className="space-y-3">
          <FoodPickerList onPick={(f) => { setFood(f); setGrams(f.unitWeight ?? 100) }} selectedId={food?.id} />
          {food && (
            <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/60">
              <div className="mb-2 text-sm font-medium">{food.name}</div>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={`Cantidad (${food.unit})`}>
                  <NumInput value={grams} onChange={setGrams} className="input !w-28" min={0} />
                </Field>
                {food.unitWeight ? (
                  <div className="flex gap-1">
                    {[1, 2, 3].map((n) => (
                      <button key={n} type="button" className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => setGrams(food.unitWeight! * n)}>
                        {n} {food.unitName ?? 'ud'}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {grams ? <MacroLine className="mt-2 block" m={scale(food, grams)} /> : null}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input className="input pl-9" placeholder="Buscar receta…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            {shown.length === 0 && <div className="p-3"><Empty>No hay recetas.</Empty></div>}
            {shown.map((r) => (
              <button key={r.id} type="button" onClick={() => setRecipe(r)} className={cn('flex w-full flex-col items-start gap-0.5 border-b border-zinc-100 px-3 py-2 text-left last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60', recipe?.id === r.id && 'bg-emerald-500/10')}>
                <span className="flex items-center gap-1.5 text-sm">{r.favorite && <Star size={13} className="fill-amber-400 text-amber-400" />}{r.name}</span>
                <MacroLine m={scale(recipeTotals(r, map), 100 / 1)} />
              </button>
            ))}
          </div>
          {recipe && (
            <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/60">
              <div className="mb-2 text-sm font-medium">{recipe.name}</div>
              <Field label="Raciones" hint="1 = la receta tal cual; 0,5 = media; 1,5 = una y media">
                <NumInput value={factor} onChange={setFactor} className="input !w-28" min={0} />
              </Field>
              {factor ? <MacroLine className="mt-2 block" m={scale(recipeTotals(recipe, map), factor * 100)} /> : null}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={close}>Cancelar</button>
        <button className="btn-primary" disabled={tab === 'alimentos' ? !food : !recipe} onClick={submit}>Añadir</button>
      </div>
    </Modal>
  )
}
