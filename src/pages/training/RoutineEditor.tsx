import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeftRight, ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, Field, NumInput, confirmAction, useToast } from '../../components/ui'
import { db } from '../../db/db'
import { SEED_ROUTINE } from '../../db/seed'
import type { PlannedExercise, RoutineDay } from '../../db/types'
import { DAY_NAMES } from '../../lib/date'
import { useExerciseMap } from '../../lib/hooks'

export function RoutineEditor() {
  const routine = useLiveQuery(() => db.routine.orderBy('isoDay').toArray(), []) ?? []
  const toast = useToast()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="muted text-sm">Edita días, ejercicios, series y rangos de repeticiones. Los cambios se aplican a los próximos entrenamientos; los ya registrados no cambian.</p>
        <button className="btn-ghost text-sm" onClick={async () => { if (confirmAction('¿Restaurar el programa original? Se perderán tus cambios en la rutina.')) { await db.routine.bulkPut(SEED_ROUTINE); toast('Programa restaurado') } }}><RotateCcw size={15} />Restaurar original</button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {routine.map((d) => <DayEditor key={d.isoDay} day={d} routine={routine} />)}
      </div>
    </div>
  )
}

function DayEditor({ day, routine }: { day: RoutineDay; routine: RoutineDay[] }) {
  const toast = useToast()
  const { exercises, map } = useExerciseMap()
  const [d, setD] = useState<RoutineDay>(day)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    setD(day)
    setDirty(false)
  }, [day])
  const upd = (p: Partial<RoutineDay>) => {
    setD((x) => ({ ...x, ...p }))
    setDirty(true)
  }
  const updEx = (i: number, p: Partial<PlannedExercise>) => upd({ exercises: d.exercises.map((e, j) => (j === i ? { ...e, ...p } : e)) })
  const move = (i: number, dir: -1 | 1) => {
    const arr = [...d.exercises]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    upd({ exercises: arr })
  }
  const save = async () => {
    if (!d.name.trim()) return toast('El día necesita un nombre', 'error')
    if (d.exercises.some((e) => !(e.sets > 0) || !(e.repMin > 0) || !(e.repMax >= e.repMin))) return toast('Revisa series y rangos (mín. ≤ máx., mayores que 0)', 'error')
    await db.routine.put({ ...d, name: d.name.trim() })
    setDirty(false)
    toast(`${DAY_NAMES[d.isoDay]} guardado`)
  }
  const swap = async (other: number) => {
    const o = routine.find((r) => r.isoDay === other)
    if (!o) return
    await db.routine.bulkPut([{ ...o, isoDay: day.isoDay }, { ...day, isoDay: other }])
    toast(`${DAY_NAMES[day.isoDay]} ↔ ${DAY_NAMES[other]}`)
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="w-24 text-sm font-semibold">{DAY_NAMES[d.isoDay]}</span>
        <input className="input !w-auto flex-1" value={d.name} onChange={(e) => upd({ name: e.target.value })} aria-label="Nombre del día" />
        <select className="input !w-auto" value={d.type} onChange={(e) => upd({ type: e.target.value as RoutineDay['type'] })}>
          <option value="gym">Gimnasio</option>
          <option value="rest">Descanso / recuperación</option>
        </select>
        <label className="muted flex items-center gap-1 text-xs" title="Intercambiar con otro día">
          <ArrowLeftRight size={14} />
          <select className="input !w-auto !py-1 text-xs" value="" onChange={(e) => e.target.value && swap(Number(e.target.value))}>
            <option value="">Intercambiar…</option>
            {[1, 2, 3, 4, 5, 6, 7].filter((n) => n !== d.isoDay).map((n) => <option key={n} value={n}>{DAY_NAMES[n]}</option>)}
          </select>
        </label>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <Field label="Descripción"><input className="input" value={d.description} onChange={(e) => upd({ description: e.target.value })} /></Field>
        <Field label="Actividades (separadas por comas)"><input className="input" value={d.activities.join(', ')} onChange={(e) => upd({ activities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
      </div>
      {d.type === 'gym' && (
        <div className="space-y-2">
          <div className="muted grid grid-cols-[1fr_3rem_3rem_3rem_auto] gap-1.5 text-[11px] font-medium"><span>Ejercicio</span><span className="text-center">Series</span><span className="text-center">Mín</span><span className="text-center">Máx</span><span className="w-20" /></div>
          {d.exercises.map((e, i) => (
            <div key={i} className="grid grid-cols-[1fr_3rem_3rem_3rem_auto] items-center gap-1.5">
              <div className="min-w-0">
                <select className="input !py-1.5 text-sm" value={e.exerciseId} onChange={(v) => updEx(i, { exerciseId: v.target.value })}>
                  {exercises.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                {map.get(e.exerciseId)?.kind !== 'weight' || e.note ? (
                  <input className="input mt-1 !py-1 text-xs" placeholder="Nota (por lado, segundos…)" value={e.note ?? ''} onChange={(v) => updEx(i, { note: v.target.value || undefined })} />
                ) : null}
              </div>
              <NumInput className="input-sm" value={e.sets} onChange={(n) => updEx(i, { sets: Math.round(n ?? 0) })} min={0} aria-label="Series" />
              <NumInput className="input-sm" value={e.repMin} onChange={(n) => updEx(i, { repMin: Math.round(n ?? 0) })} min={0} aria-label="Reps mínimas" />
              <NumInput className="input-sm" value={e.repMax} onChange={(n) => updEx(i, { repMax: Math.round(n ?? 0) })} min={0} aria-label="Reps máximas" />
              <div className="flex w-20 justify-end">
                <button className="btn-ghost !p-1" onClick={() => move(i, -1)} aria-label="Subir"><ChevronUp size={15} /></button>
                <button className="btn-ghost !p-1" onClick={() => move(i, 1)} aria-label="Bajar"><ChevronDown size={15} /></button>
                <button className="btn-ghost !p-1 text-red-500" onClick={() => upd({ exercises: d.exercises.filter((_, j) => j !== i) })} aria-label="Quitar"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          <button className="btn-secondary !py-1.5 text-xs" onClick={() => upd({ exercises: [...d.exercises, { exerciseId: exercises[0]?.id ?? '', sets: 3, repMin: 8, repMax: 12 }] })}><Plus size={14} />Ejercicio</button>
        </div>
      )}
      {dirty && (
        <div className="mt-3 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => { setD(day); setDirty(false) }}>Descartar</button>
          <button className="btn-primary" onClick={save}>Guardar cambios</button>
        </div>
      )}
    </Card>
  )
}
