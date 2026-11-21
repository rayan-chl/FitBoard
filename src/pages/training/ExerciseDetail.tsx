import { Trophy } from 'lucide-react'
import { useState } from 'react'
import { TimeLineChart } from '../../components/charts'
import { Field, Modal, NumInput, Segmented, fmtNum, useToast } from '../../components/ui'
import { db, uid } from '../../db/db'
import type { Exercise, ExerciseKind, Session } from '../../db/types'
import { fmtShort } from '../../lib/date'
import { performanceHistory, personalRecords } from '../../lib/training'
import { setLabel } from './Workout'

export const MUSCLES = ['Pecho', 'Espalda', 'Hombro anterior', 'Hombro lateral', 'Hombro posterior', 'Bíceps', 'Tríceps', 'Antebrazo', 'Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos', 'Core', 'Lumbar']

export function ExerciseDetail({ ex, sessions, onClose }: { ex: Exercise; sessions: Session[]; onClose: () => void }) {
  const history = performanceHistory(sessions.filter((s) => s.status === 'done'), ex.id)
  const pr = personalRecords(history)
  const [metric, setMetric] = useState<'e1rm' | 'top' | 'vol'>(ex.kind === 'weight' ? 'e1rm' : 'vol')
  const data = history.map((h) => ({ date: h.date, e1rm: h.bestE1rm, top: h.topWeight, vol: ex.kind === 'weight' ? h.volume : h.totalReps }))
  const last = history[history.length - 1]
  const prev = history[history.length - 2]
  return (
    <Modal open onClose={onClose} title={ex.name} wide>
      {history.length === 0 ? (
        <p className="muted text-sm">Aún no hay series completadas de este ejercicio.</p>
      ) : (
        <div className="space-y-4">
          {ex.kind === 'weight' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Peso máximo', pr.maxWeight && `${fmtNum(pr.maxWeight.value)} kg × ${pr.maxWeight.reps}`, pr.maxWeight?.date],
                ['Mejor 1RM est.', pr.bestE1rm && `${fmtNum(pr.bestE1rm.value)} kg`, pr.bestE1rm?.date],
                ['Mejor serie', pr.bestSetVolume && `${fmtNum(pr.bestSetVolume.value, 0)} kg`, pr.bestSetVolume?.date],
                ['Mejor sesión', pr.bestSessionVolume && `${fmtNum(pr.bestSessionVolume.value, 0)} kg`, pr.bestSessionVolume?.date],
              ].map(([l, v, d]) => (
                <div key={l} className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/60">
                  <div className="muted flex items-center gap-1 text-xs"><Trophy size={12} className="text-amber-500" />{l}</div>
                  <div className="font-bold tabular-nums">{v ?? '–'}</div>
                  <div className="muted text-[11px]">{d ? fmtShort(d) : ''}</div>
                </div>
              ))}
            </div>
          )}
          {last && prev && ex.kind === 'weight' && (
            <p className="text-sm">
              Última sesión frente a la anterior: carga máxima <b>{fmtNum(prev.topWeight)} → {fmtNum(last.topWeight)} kg</b>, volumen <b>{fmtNum(prev.volume, 0)} → {fmtNum(last.volume, 0)} kg</b>.
            </p>
          )}
          <div>
            {ex.kind === 'weight' && (
              <Segmented className="mb-2" value={metric} onChange={setMetric} options={[{ value: 'e1rm', label: '1RM estimado' }, { value: 'top', label: 'Peso máximo' }, { value: 'vol', label: 'Volumen' }]} />
            )}
            <TimeLineChart data={data} series={[{ key: metric, name: metric === 'e1rm' ? '1RM est.' : metric === 'top' ? 'Peso máx.' : ex.kind === 'weight' ? 'Volumen' : 'Reps/seg totales', color: '#10b981' }]} unit={metric === 'vol' && ex.kind !== 'weight' ? '' : 'kg'} />
            {ex.kind === 'weight' && <p className="muted mt-1 text-[11px]">1RM estimado con Epley, solo con series de 1-10 repeticiones (sin calentamientos). Es una estimación, no un máximo real.</p>}
          </div>
          {pr.repRecords.length > 0 && ex.kind === 'weight' && (
            <div>
              <div className="label">Récords por repeticiones</div>
              <div className="flex flex-wrap gap-1.5">
                {pr.repRecords.map((r) => <span key={r.reps} className="chip bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{r.reps} reps: {fmtNum(r.weight)} kg</span>)}
              </div>
            </div>
          )}
          <div>
            <div className="label">Historial</div>
            <div className="max-h-60 overflow-y-auto text-sm">
              {[...history].reverse().map((h) => (
                <div key={h.sessionId} className="flex justify-between gap-3 border-b border-zinc-100 py-1.5 last:border-0 dark:border-zinc-800">
                  <span className="muted shrink-0">{fmtShort(h.date)}</span>
                  <span className="text-right tabular-nums">{h.sets.map((s) => setLabel(s, ex) + (s.rir !== null && s.rir !== undefined ? ` @${s.rir}` : '')).join(' · ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function ExerciseEditor({ ex, onClose }: { ex: Exercise | null; onClose: () => void }) {
  const toast = useToast()
  const [e, setE] = useState<Exercise>(ex ?? { id: uid(), name: '', kind: 'weight', incrementKg: 2.5, defaultRestSec: 90, primary: [], secondary: [] })
  const [err, setErr] = useState<string | null>(null)
  const toggle = (list: 'primary' | 'secondary', m: string) => setE((x) => ({ ...x, [list]: x[list].includes(m) ? x[list].filter((y) => y !== m) : [...x[list], m] }))
  const save = async () => {
    if (!e.name.trim()) return setErr('Pon un nombre')
    if (!e.primary.length) return setErr('Elige al menos un músculo principal')
    await db.exercises.put({ ...e, name: e.name.trim() })
    toast('Ejercicio guardado')
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={ex ? 'Editar ejercicio' : 'Nuevo ejercicio'}>
      <div className="space-y-3">
        <Field label="Nombre"><input className="input" value={e.name} onChange={(v) => setE({ ...e, name: v.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Tipo">
            <select className="input" value={e.kind} onChange={(v) => setE({ ...e, kind: v.target.value as ExerciseKind })}>
              <option value="weight">Peso × reps</option><option value="reps">Solo reps</option><option value="time">Tiempo</option>
            </select>
          </Field>
          <Field label="Incremento (kg)"><NumInput value={e.incrementKg} onChange={(n) => setE({ ...e, incrementKg: n ?? 0 })} min={0} /></Field>
          <Field label="Descanso (s)"><NumInput value={e.defaultRestSec} onChange={(n) => setE({ ...e, defaultRestSec: n ?? 0 })} min={0} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-emerald-500" checked={!!e.main} onChange={(v) => setE({ ...e, main: v.target.checked })} />Ejercicio principal (aparece en el análisis de progreso)</label>
        {(['primary', 'secondary'] as const).map((list) => (
          <div key={list}>
            <span className="label">{list === 'primary' ? 'Músculos principales (cuentan 1 serie)' : 'Secundarios (cuentan 0,5)'}</span>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLES.map((m) => (
                <button key={m} type="button" onClick={() => toggle(list, m)} className={`rounded-full border px-2.5 py-1 text-xs ${e[list].includes(m) ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-200 dark:border-zinc-700'}`}>{m}</button>
              ))}
            </div>
          </div>
        ))}
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Guardar</button></div>
      </div>
    </Modal>
  )
}
