import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Droplets, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Card, Field, MacroBar, Modal, NumInput, PageHeader, ProgressBar, SampleBadge, Segmented, confirmAction, fmtNum, useToast } from '../components/ui'
import { db } from '../db/db'
import { MEALS, type DiaryEntry, type MealType } from '../db/types'
import { addWater, copyEntries, saveMealAsRecipe } from '../lib/actions'
import { addDaysStr, fmtLong, todayStr } from '../lib/date'
import { useMeasurements, useProfile } from '../lib/hooks'
import { dayTotals, entryTotals, intakeWarnings, scale, sum } from '../lib/nutrition'
import { navigate } from '../lib/router'
import { latestWeight } from '../lib/stats'
import { AddEntryModal, MacroLine } from './nutrition/AddEntryModal'
import { Digestive } from './nutrition/Digestive'
import { Foods } from './nutrition/Foods'
import { Recipes } from './nutrition/Recipes'

type Tab = 'diario' | 'recetas' | 'alimentos' | 'digestivo'

export default function Nutrition({ params }: { params: URLSearchParams }) {
  const tab = (params.get('tab') as Tab) || 'diario'
  const date = params.get('d') || todayStr()
  const setTab = (t: Tab) => navigate('nutricion', t === 'diario' ? { d: date } : { tab: t })
  return (
    <div>
      <PageHeader title="Nutrición" subtitle={tab === 'diario' ? fmtLong(date) : 'Recetas, alimentos y registro digestivo'} />
      <Segmented
        className="mb-4 max-w-full"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'diario', label: 'Diario' },
          { value: 'recetas', label: 'Recetas' },
          { value: 'alimentos', label: 'Alimentos' },
          { value: 'digestivo', label: 'Digestivo' },
        ]}
      />
      {tab === 'diario' && <Diary date={date} />}
      {tab === 'recetas' && <Recipes />}
      {tab === 'alimentos' && <Foods />}
      {tab === 'digestivo' && <Digestive />}
    </div>
  )
}

export function useNutritionWarnings(date: string) {
  const profile = useProfile()
  const measurements = useMeasurements()
  const from = addDaysStr(date, -6)
  const week = useLiveQuery(() => db.diary.where('date').between(from, date, true, true).toArray(), [from, date]) ?? []
  if (!profile) return []
  const byDay = new Map<string, DiaryEntry[]>()
  for (const e of week) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])
  // Solo días con al menos 2 comidas registradas, para no tratar días incompletos como ingesta real.
  const full = [...byDay.values()].filter((es) => new Set(es.map((e) => e.meal)).size >= 2)
  if (full.length < 4) return []
  const totals = full.map(dayTotals)
  const t = sum(totals)
  const n = full.length
  const avgM = { kcal: t.kcal / n, protein: t.protein / n, carbs: t.carbs / n, fat: t.fat / n, fiber: t.fiber / n }
  const w = latestWeight(measurements)?.weight ?? profile.startWeight
  return intakeWarnings(avgM, n, profile, w)
}

function Diary({ date }: { date: string }) {
  const toast = useToast()
  const profile = useProfile()
  const entries = useLiveQuery(() => db.diary.where('date').equals(date).toArray(), [date]) ?? []
  const day = useLiveQuery(() => db.days.get(date), [date])
  const warnings = useNutritionWarnings(date)
  const [adding, setAdding] = useState<MealType | null>(null)
  const [editing, setEditing] = useState<DiaryEntry | null>(null)
  const [copying, setCopying] = useState<MealType | 'all' | null>(null)
  const totals = dayTotals(entries)
  const t = profile?.targets
  const go = (d: string) => navigate('nutricion', { d })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="btn-secondary !p-2" onClick={() => go(addDaysStr(date, -1))} aria-label="Día anterior"><ChevronLeft size={18} /></button>
        <input type="date" className="input !w-auto" value={date} onChange={(e) => e.target.value && go(e.target.value)} />
        <button className="btn-secondary !p-2" onClick={() => go(addDaysStr(date, 1))} aria-label="Día siguiente"><ChevronRight size={18} /></button>
        {date !== todayStr() && <button className="btn-ghost text-sm" onClick={() => go(todayStr())}>Hoy</button>}
        <button className="btn-ghost ml-auto text-sm" onClick={() => setCopying('all')}><Copy size={15} />Copiar día</button>
      </div>

      {t && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Objetivos del día">
            <div className="grid gap-4 sm:grid-cols-2">
              <MacroBar label="Calorías" value={totals.kcal} target={t.kcal} unit="kcal" color="var(--color-kcal)" />
              <MacroBar label="Proteína" value={totals.protein} target={t.protein} unit="g" color="var(--color-protein)" />
              <MacroBar label="Carbohidratos" value={totals.carbs} target={t.carbs} unit="g" color="var(--color-carbs)" />
              <MacroBar label="Grasas" value={totals.fat} target={t.fat} unit="g" color="var(--color-fat)" />
            </div>
            <p className="muted mt-3 text-xs">Fibra: {fmtNum(totals.fiber, 0)} g · Carbohidratos sin fibra. Los valores son estimaciones a partir de los ingredientes.</p>
          </Card>
          <Card title={<span className="flex items-center gap-1.5"><Droplets size={16} className="text-sky-500" />Agua</span>}>
            <div className="text-2xl font-bold tabular-nums">{fmtNum((day?.waterMl ?? 0) / 1000, 2)} L</div>
            <p className="muted mb-2 text-xs">Objetivo {fmtNum(t.waterMl / 1000, 1)} L</p>
            <ProgressBar value={day?.waterMl ?? 0} max={t.waterMl} color="var(--color-water)" />
            <div className="mt-3 flex flex-wrap gap-2">
              {[250, 500].map((ml) => <button key={ml} className="btn-secondary !py-1.5 text-xs" onClick={() => addWater(date, ml)}>+{ml} ml</button>)}
              <button className="btn-ghost !py-1.5 text-xs" onClick={() => addWater(date, -250)} disabled={!day?.waterMl}>−250</button>
            </div>
          </Card>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={16} className="text-amber-500" />Media de los últimos 7 días</div>
          <ul className="list-disc space-y-1 pl-5">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
          <p className="muted mt-2 text-xs">Aviso orientativo basado en estimaciones; no es una recomendación médica.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m.id).sort((a, b) => a.createdAt - b.createdAt)
          const mt = dayTotals(list)
          return (
            <Card
              key={m.id}
              title={<span>{m.label} {list.length > 0 && <MacroLine m={mt} className="ml-1 font-normal" />}</span>}
              action={
                <div className="flex gap-1">
                  <button className="btn-ghost !p-1.5" title="Copiar de otro día" onClick={() => setCopying(m.id)}><Copy size={16} /></button>
                  {list.length > 0 && (
                    <button className="btn-ghost !p-1.5" title="Guardar como comida habitual (receta)" onClick={async () => {
                      const name = window.prompt('Nombre de la comida habitual:', `${m.label} habitual`)
                      if (!name) return
                      try { await saveMealAsRecipe(date, m.id, name.trim()); toast('Guardada en Recetas (favorita)') } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'error') }
                    }}><Save size={16} /></button>
                  )}
                  <button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={() => setAdding(m.id)}><Plus size={15} />Añadir</button>
                </div>
              }
            >
              {list.length === 0 ? (
                <p className="muted text-sm">Sin registros.</p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {list.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-sm font-medium">{e.name}<SampleBadge show={e.isSample} /></div>
                        <div className="muted text-xs">
                          {e.kind === 'recipe' ? `${fmtNum(e.factor, 2)} ración${e.factor === 1 ? '' : 'es'} · ${e.items.length} ingredientes` : `${fmtNum(e.items[0]?.grams * e.factor, 0)} ${e.items[0]?.unit}`}
                        </div>
                        <MacroLine m={entryTotals(e)} />
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button className="btn-ghost !p-1.5" onClick={() => setEditing(e)} aria-label="Editar"><Pencil size={15} /></button>
                        <button className="btn-ghost !p-1.5 text-red-500" onClick={() => confirmAction(`¿Eliminar "${e.name}"?`) && db.diary.delete(e.id)} aria-label="Eliminar"><Trash2 size={15} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      {adding && <AddEntryModal open onClose={() => setAdding(null)} date={date} meal={adding} />}
      {editing && <EditEntryModal entry={editing} onClose={() => setEditing(null)} />}
      {copying && <CopyModal date={date} meal={copying} onClose={() => setCopying(null)} />}
    </div>
  )
}

function EditEntryModal({ entry, onClose }: { entry: DiaryEntry; onClose: () => void }) {
  const toast = useToast()
  const [factor, setFactor] = useState<number | null>(entry.factor)
  const [items, setItems] = useState(entry.items.map((i) => ({ ...i })))
  const [meal, setMeal] = useState<MealType>(entry.meal)
  const preview = sum(items.map((i) => scale(i, i.grams * (entry.kind === 'recipe' ? factor ?? 0 : 1))))
  const save = async () => {
    if (entry.kind === 'recipe' && (!factor || factor <= 0)) return toast('Raciones no válidas', 'error')
    if (items.some((i) => !(i.grams > 0))) return toast('Todas las cantidades deben ser mayores que 0', 'error')
    await db.diary.update(entry.id, { factor: entry.kind === 'recipe' ? factor! : 1, items, meal })
    toast('Registro actualizado')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={`Editar: ${entry.name}`}>
      <div className="space-y-3">
        <Field label="Comida">
          <select className="input" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
            {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        {entry.kind === 'recipe' && (
          <Field label="Raciones"><NumInput value={factor} onChange={setFactor} min={0} /></Field>
        )}
        <div>
          <span className="label">{entry.kind === 'recipe' ? 'Ingredientes (por ración)' : 'Cantidad'}</span>
          <div className="space-y-2">
            {items.map((i, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{i.name}</span>
                <NumInput className="input !w-24" value={i.grams} onChange={(n) => setItems((arr) => arr.map((x, j) => (j === idx ? { ...x, grams: n ?? 0 } : x)))} min={0} />
                <span className="muted w-6 text-xs">{i.unit}</span>
                {entry.kind === 'recipe' && items.length > 1 && (
                  <button className="btn-ghost !p-1.5 text-red-500" onClick={() => setItems((arr) => arr.filter((_, j) => j !== idx))} aria-label="Quitar"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/60"><MacroLine m={preview} /></div>
        <p className="muted text-xs">Los cambios solo afectan a este registro; la receta original no cambia.</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save}>Guardar</button>
        </div>
      </div>
    </Modal>
  )
}

function CopyModal({ date, meal, onClose }: { date: string; meal: MealType | 'all'; onClose: () => void }) {
  const toast = useToast()
  const [from, setFrom] = useState(addDaysStr(date, -1))
  const src = useLiveQuery(() => db.diary.where('date').equals(from).toArray(), [from]) ?? []
  const chosen = src.filter((e) => meal === 'all' || e.meal === meal)
  const label = meal === 'all' ? 'el día completo' : MEALS.find((m) => m.id === meal)?.label.toLowerCase()
  return (
    <Modal open onClose={onClose} title={`Copiar ${label}`}>
      <Field label="Copiar desde el día">
        <input type="date" className="input" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
      </Field>
      <div className="mt-3 rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800/60">
        {chosen.length === 0 ? <span className="muted">No hay registros ese día.</span> : (
          <ul className="space-y-1">{chosen.map((e) => <li key={e.id} className="flex justify-between gap-2"><span className="truncate">{e.name}</span><MacroLine m={entryTotals(e)} /></li>)}</ul>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={!chosen.length} onClick={async () => {
          const n = await copyEntries(from, date, meal === 'all' ? null : meal)
          toast(`${n} registro${n === 1 ? '' : 's'} copiado${n === 1 ? '' : 's'}`)
          onClose()
        }}>Copiar {chosen.length || ''}</button>
      </div>
    </Modal>
  )
}
