import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, BadgeCheck, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Empty, Field, Modal, NumInput, confirmAction, fmtNum, useToast } from '../../components/ui'
import { db, uid } from '../../db/db'
import type { Food, FoodState, Tolerance } from '../../db/types'
import { useFoodMap } from '../../lib/hooks'
import { kcalFromMacros, kcalMismatch } from '../../lib/nutrition'
import { norm } from './AddEntryModal'

const TOL: Record<Tolerance, { label: string; cls: string }> = {
  bien: { label: 'Tolero bien', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  regular: { label: 'Regular', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  mal: { label: 'No tolero', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
}

export function Foods() {
  const { foods } = useFoodMap()
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? []
  const toast = useToast()
  const [q, setQ] = useState('')
  const [tol, setTol] = useState<Tolerance | 'all' | 'none'>('all')
  const [editing, setEditing] = useState<Food | null>(null)
  const shown = foods
    .filter((f) => norm(f.name).includes(norm(q)))
    .filter((f) => tol === 'all' || (tol === 'none' ? !f.tolerance : f.tolerance === tol))

  const remove = async (f: Food) => {
    const used = recipes.filter((r) => r.ingredients.some((i) => i.foodId === f.id))
    if (used.length) return toast(`No se puede eliminar: lo usan ${used.length} receta(s) (${used.map((r) => r.name).slice(0, 2).join(', ')}…)`, 'error')
    if (confirmAction(`¿Eliminar "${f.name}"? Los registros pasados conservan sus valores.`)) await db.foods.delete(f.id)
  }

  const blank: Food = { id: uid(), name: '', unit: 'g', state: 'crudo', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, source: 'Personalizado', verified: false, custom: true, updatedAt: Date.now() }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Buscar en la base de datos local…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={tol} onChange={(e) => setTol(e.target.value as typeof tol)}>
          <option value="all">Toda tolerancia</option>
          <option value="bien">Tolero bien</option>
          <option value="regular">Regular</option>
          <option value="mal">No tolero</option>
          <option value="none">Sin valorar</option>
        </select>
        <button className="btn-primary" onClick={() => setEditing(blank)}><Plus size={16} />Nuevo alimento</button>
      </div>
      <p className="muted text-xs">Valores por 100 g o 100 ml. Carbohidratos sin fibra. <BadgeCheck size={12} className="inline text-emerald-500" /> = contrastado con fuente; el resto son estimaciones de referencia: revisa la etiqueta de tu producto.</p>

      {shown.length === 0 && <Empty>Sin alimentos.</Empty>}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="muted bg-zinc-50 text-left text-xs dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">Alimento</th>
                <th className="px-2 py-2 text-right font-medium">kcal</th>
                <th className="px-2 py-2 text-right font-medium">P</th>
                <th className="px-2 py-2 text-right font-medium">C</th>
                <th className="px-2 py-2 text-right font-medium">G</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Fibra</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {shown.map((f) => (
                <tr key={f.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{f.name}</span>
                      {f.verified && <BadgeCheck size={14} className="text-emerald-500" />}
                      {f.custom && <span className="chip bg-sky-500/15 text-sky-700 dark:text-sky-300">propio</span>}
                      {f.tolerance && <span className={`chip ${TOL[f.tolerance].cls}`}>{TOL[f.tolerance].label}</span>}
                    </div>
                    <div className="muted text-xs">{f.state} · /100 {f.unit}{f.unitWeight ? ` · 1 ${f.unitName ?? 'ud'} = ${fmtNum(f.unitWeight, 0)} ${f.unit}` : ''}</div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtNum(f.kcal, 0)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtNum(f.protein)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtNum(f.carbs)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtNum(f.fat)}</td>
                  <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{fmtNum(f.fiber)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <button className="btn-ghost !p-1.5" onClick={() => setEditing(f)} aria-label="Editar"><Pencil size={15} /></button>
                    <button className="btn-ghost !p-1.5 text-red-500" onClick={() => remove(f)} aria-label="Eliminar"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && <FoodEditor food={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function FoodEditor({ food, onClose }: { food: Food; onClose: () => void }) {
  const toast = useToast()
  const [f, setF] = useState<Food>({ ...food })
  const [err, setErr] = useState<string | null>(null)
  const set = <K extends keyof Food>(k: K, v: Food[K]) => setF((x) => ({ ...x, [k]: v }))
  const isNew = !food.name

  const save = async () => {
    if (!f.name.trim()) return setErr('El nombre es obligatorio.')
    for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const) if (!(f[k] >= 0)) return setErr('Los valores nutricionales no pueden ser negativos.')
    if (f.protein + f.carbs + f.fat + f.fiber > 100.5 && f.unit === 'g') return setErr('Proteína + carbohidratos + grasa + fibra no pueden superar 100 g por cada 100 g.')
    if (f.unitWeight !== undefined && f.unitWeight !== null && !(f.unitWeight > 0)) return setErr('El peso por unidad debe ser mayor que 0.')
    // Al editar un alimento de la base, deja de considerarse "verificado" si cambian sus valores.
    const changed = (['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const).some((k) => f[k] !== food[k])
    await db.foods.put({ ...f, name: f.name.trim(), verified: changed ? false : f.verified, source: changed && !f.custom ? `${food.source} (editado)` : f.source, updatedAt: Date.now() })
    toast(isNew ? 'Alimento creado' : 'Alimento actualizado')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Nuevo alimento' : `Editar: ${food.name}`}>
      <div className="space-y-3">
        <Field label="Nombre"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={isNew} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unidad">
            <select className="input" value={f.unit} onChange={(e) => set('unit', e.target.value as Food['unit'])}><option value="g">gramos (g)</option><option value="ml">mililitros (ml)</option></select>
          </Field>
          <Field label="Estado al pesar">
            <select className="input" value={f.state} onChange={(e) => set('state', e.target.value as FoodState)}>
              {(['crudo', 'seco', 'cocinado', 'escurrido', 'listo'] as FoodState[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <span className="label">Valores por 100 {f.unit}</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {([['kcal', 'kcal'], ['protein', 'Proteína'], ['carbs', 'Carbs (sin fibra)'], ['fat', 'Grasa'], ['fiber', 'Fibra']] as const).map(([k, l]) => (
            <Field key={k} label={l}><NumInput value={f[k]} onChange={(n) => set(k, n ?? 0)} min={0} /></Field>
          ))}
        </div>
        {kcalMismatch(f) && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600"><AlertTriangle size={14} />Las kcal no cuadran con los macros (≈{fmtNum(kcalFromMacros(f), 0)} kcal). Revisa la etiqueta.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Peso por unidad (${f.unit}, opcional)`}><NumInput value={f.unitWeight ?? null} onChange={(n) => set('unitWeight', n ?? undefined)} min={0} /></Field>
          <Field label="Nombre de la unidad"><input className="input" placeholder="lata, huevo, cacito…" value={f.unitName ?? ''} onChange={(e) => set('unitName', e.target.value || undefined)} /></Field>
        </div>
        <Field label="Fuente"><input className="input" value={f.source} onChange={(e) => set('source', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tolerancia digestiva (opcional)">
            <select className="input" value={f.tolerance ?? ''} onChange={(e) => set('tolerance', (e.target.value || undefined) as Tolerance | undefined)}>
              <option value="">Sin valorar</option>
              <option value="bien">Tolero bien</option>
              <option value="regular">Regular</option>
              <option value="mal">No tolero</option>
            </select>
          </Field>
          <Field label="Nota de tolerancia"><input className="input" value={f.toleranceNote ?? ''} onChange={(e) => set('toleranceNote', e.target.value || undefined)} /></Field>
        </div>
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </Modal>
  )
}
