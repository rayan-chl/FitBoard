import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Card, Empty, Field, SampleBadge, cn, confirmAction, useToast } from '../../components/ui'
import { db, uid } from '../../db/db'
import type { DigestiveLog } from '../../db/types'
import { fmtLong, todayStr } from '../../lib/date'

const SYMPTOMS = ['Dolor abdominal', 'Hinchazón', 'Gases', 'Urgencia', 'Diarrea', 'Estreñimiento', 'Sangre', 'Cansancio', 'Náuseas']
const STATES = ['', 'Muy mal', 'Mal', 'Normal', 'Bien', 'Muy bien']

export function Digestive() {
  const toast = useToast()
  const logs = useLiveQuery(() => db.digestive.orderBy('date').reverse().toArray(), []) ?? []
  const foods = useLiveQuery(() => db.foods.filter((f) => !!f.tolerance).toArray(), []) ?? []
  const empty = (): DigestiveLog => ({ id: uid(), date: todayStr(), bowelState: 3, symptoms: [], foodsNote: '', notes: '' })
  const [form, setForm] = useState<DigestiveLog>(empty)
  const editing = logs.some((l) => l.id === form.id)

  const save = async () => {
    if (!form.date) return toast('Indica la fecha', 'error')
    await db.digestive.put(form)
    toast(editing ? 'Registro actualizado' : 'Registro guardado')
    setForm(empty())
  }
  const toggle = (s: string) => setForm((f) => ({ ...f, symptoms: f.symptoms.includes(s) ? f.symptoms.filter((x) => x !== s) : [...f.symptoms, s] }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card title={editing ? 'Editar registro digestivo' : 'Registro digestivo (opcional)'}>
          <p className="muted mb-3 text-xs">Solo es un diario personal: la app no interpreta estos datos ni hace recomendaciones. Para cualquier cambio en tu dieta o tratamiento, consúltalo con tu equipo médico.</p>
          <div className="space-y-3">
            <Field label="Fecha"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <div>
              <span className="label">Estado intestinal</span>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, bowelState: n })} className={cn('rounded-lg border px-1 py-2 text-xs font-medium', form.bowelState === n ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-200 dark:border-zinc-700')}>
                    {STATES[n]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Síntomas</span>
              <div className="flex flex-wrap gap-1.5">
                {SYMPTOMS.map((s) => (
                  <button key={s} type="button" onClick={() => toggle(s)} className={cn('rounded-full border px-3 py-1 text-xs', form.symptoms.includes(s) ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-200 dark:border-zinc-700')}>{s}</button>
                ))}
              </div>
            </div>
            <Field label="Alimentos / tolerancia del día"><input className="input" placeholder="p. ej. lentejas: mal; arroz: bien" value={form.foodsNote ?? ''} onChange={(e) => setForm({ ...form, foodsNote: e.target.value })} /></Field>
            <Field label="Comentarios"><textarea className="input min-h-20" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              {editing && <button className="btn-secondary" onClick={() => setForm(empty())}>Cancelar</button>}
              <button className="btn-primary" onClick={save}>Guardar</button>
            </div>
          </div>
        </Card>
        <Card title="Tolerancia por alimento">
          <p className="muted mb-2 text-xs">Se marca en Alimentos → editar alimento. La fibra de cada comida se muestra en el diario para que puedas ajustarla a tu tolerancia.</p>
          {foods.length === 0 ? <p className="muted text-sm">Aún no has valorado ningún alimento.</p> : (
            <ul className="space-y-1 text-sm">
              {(['bien', 'regular', 'mal'] as const).map((t) => {
                const list = foods.filter((f) => f.tolerance === t)
                if (!list.length) return null
                return <li key={t}><b>{t === 'bien' ? 'Tolero bien' : t === 'regular' ? 'Regular' : 'No tolero'}:</b> {list.map((f) => f.name + (f.toleranceNote ? ` (${f.toleranceNote})` : '')).join(', ')}</li>
              })}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Historial">
        {logs.length === 0 ? <Empty>Sin registros.</Empty> : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-2 py-2.5">
                <div className="min-w-0 text-sm">
                  <div className="flex items-center gap-2 font-medium first-letter:uppercase">{fmtLong(l.date)}<SampleBadge show={l.isSample} /></div>
                  <div className="muted text-xs">Estado: {STATES[l.bowelState]}{l.symptoms.length ? ` · ${l.symptoms.join(', ')}` : ''}</div>
                  {l.foodsNote && <div className="text-xs">{l.foodsNote}</div>}
                  {l.notes && <div className="muted text-xs italic">{l.notes}</div>}
                </div>
                <div className="flex shrink-0">
                  <button className="btn-ghost !p-1.5" onClick={() => setForm({ ...l })} aria-label="Editar"><Pencil size={15} /></button>
                  <button className="btn-ghost !p-1.5 text-red-500" onClick={() => confirmAction('¿Eliminar este registro?') && db.digestive.delete(l.id)} aria-label="Eliminar"><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
