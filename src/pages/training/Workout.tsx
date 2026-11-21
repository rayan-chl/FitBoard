import { useLiveQuery } from 'dexie-react-hooks'
import { Check, CheckCircle2, ChevronDown, ChevronUp, History, Lightbulb, Plus, RotateCcw, Timer, Trash2, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Card, Field, Modal, NumInput, SampleBadge, cn, confirmAction, fmtNum, useToast } from '../../components/ui'
import { db, uid } from '../../db/db'
import type { Exercise, Session, SessionExercise, WorkSet } from '../../db/types'
import { fmtLong } from '../../lib/date'
import { useExerciseMap, useProfile, useSessions } from '../../lib/hooks'
import { e1rm, performanceHistory, personalRecords, rirToRpe, suggestNext } from '../../lib/training'

const kg = (n: number | null | undefined) => (n === null || n === undefined ? '–' : fmtNum(n, 2))

export function setLabel(s: WorkSet, ex?: Exercise) {
  if (ex?.kind === 'time') return `${s.seconds ?? '–'} s`
  if (ex?.kind === 'reps') return `${s.reps ?? '–'} reps`
  return `${kg(s.weight)} kg × ${s.reps ?? '–'}`
}

function RestTimer({ endAt, total, onClose }: { endAt: number; total: number; onClose: () => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, Math.ceil((endAt - now) / 1000))
  useEffect(() => {
    if (left === 0) {
      try {
        navigator.vibrate?.([200, 100, 200])
      } catch {
        /* sin vibración */
      }
    }
  }, [left])
  const pct = total ? (1 - left / total) * 100 : 100
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-md overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-2xl lg:bottom-6">
      <div className="h-1 bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
      <div className="flex items-center gap-3 px-4 py-3">
        <Timer size={20} className={left === 0 ? 'text-emerald-400' : ''} />
        <div className="flex-1">
          <div className="text-xs text-zinc-400">{left === 0 ? '¡Descanso terminado!' : 'Descanso'}</div>
          <div className="text-xl font-bold tabular-nums">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
        </div>
        <button className="rounded-lg bg-white/10 px-2.5 py-1.5 text-sm" onClick={() => onClose()}>Saltar</button>
      </div>
    </div>
  )
}

export function Workout({ session }: { session: Session }) {
  const toast = useToast()
  const profile = useProfile()
  const sessions = useSessions()
  const { map: exMap, exercises } = useExerciseMap()
  const [timer, setTimer] = useState<{ endAt: number; total: number } | null>(null)
  const [adding, setAdding] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const others = useMemo(() => sessions.filter((s) => s.id !== session.id && (s.date < session.date || (s.date === session.date && s.startedAt < session.startedAt))), [sessions, session])

  // Todas las escrituras parten del valor más reciente en la base de datos para no pisar cambios rápidos.
  const mutate = (fn: (s: Session) => Session) =>
    db.transaction('rw', db.sessions, async () => {
      const cur = await db.sessions.get(session.id)
      if (cur) await db.sessions.put(fn(cur))
    })
  const save = (next: Session) => mutate((cur) => ({ ...cur, ...next, exercises: next.exercises }))
  const patchEx = (idx: number, fn: (e: SessionExercise) => SessionExercise) => mutate((cur) => ({ ...cur, exercises: cur.exercises.map((e, i) => (i === idx ? fn(e) : e)) }))
  const patchSet = (idx: number, setId: string, p: Partial<WorkSet>) => patchEx(idx, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...p } : s)) }))

  const doneSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0)

  const finish = async () => {
    await mutate((cur) => ({ ...cur, status: 'done', finishedAt: Date.now() }))
    setFinishOpen(false)
    setTimer(null)
    toast('¡Entrenamiento finalizado! 💪')
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">{session.dayName}<SampleBadge show={session.isSample} />
              {session.status === 'done' ? <span className="chip bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Finalizado</span> : <span className="chip bg-sky-500/15 text-sky-700 dark:text-sky-300">En curso</span>}
            </div>
            <div className="muted text-sm first-letter:uppercase">{fmtLong(session.date)} · {doneSets}/{totalSets} series</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input !w-auto !py-1.5" value={session.date} onChange={(e) => { const v = e.target.value; if (v) mutate((cur) => ({ ...cur, date: v })) }} aria-label="Fecha de la sesión" />
            {session.status === 'done' ? (
              <button className="btn-secondary" onClick={() => mutate((cur) => ({ ...cur, status: 'in_progress' }))}><RotateCcw size={15} />Reabrir</button>
            ) : (
              <button className="btn-primary" onClick={() => setFinishOpen(true)}><CheckCircle2 size={16} />Finalizar</button>
            )}
            <button className="btn-danger" onClick={async () => { if (confirmAction('¿Eliminar este entrenamiento y todas sus series?')) { await db.sessions.delete(session.id); toast('Entrenamiento eliminado') } }}><Trash2 size={15} /></button>
          </div>
        </div>
      </Card>

      {session.exercises.map((se, idx) => (
        <ExerciseCard
          key={`${se.exerciseId}-${idx}`}
          se={se}
          idx={idx}
          count={session.exercises.length}
          ex={exMap.get(se.exerciseId)}
          history={performanceHistory(others, se.exerciseId)}
          trigger={profile?.progressTrigger ?? 'all_sets'}
          onPatch={(fn) => patchEx(idx, fn)}
          onPatchSet={(id, p) => patchSet(idx, id, p)}
          onSetDone={(st) => {
            const rest = st.restSec ?? exMap.get(se.exerciseId)?.defaultRestSec ?? 90
            if (rest > 0) setTimer({ endAt: Date.now() + rest * 1000, total: rest })
          }}
          onMove={(dir) => {
            const arr = [...session.exercises]
            const j = idx + dir
            if (j < 0 || j >= arr.length) return
            ;[arr[idx], arr[j]] = [arr[j], arr[idx]]
            save({ ...session, exercises: arr })
          }}
          onRemove={() => confirmAction('¿Quitar este ejercicio de la sesión?') && save({ ...session, exercises: session.exercises.filter((_, i) => i !== idx) })}
        />
      ))}

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => setAdding(true)}><Plus size={16} />Añadir ejercicio</button>
      </div>

      <Card title="Notas de la sesión">
        <textarea className="input min-h-16" placeholder="Sensaciones generales, energía, sueño…" value={session.notes ?? ''} onChange={(e) => { const v = e.target.value; mutate((cur) => ({ ...cur, notes: v })) }} />
      </Card>

      {adding && (
        <Modal open onClose={() => setAdding(false)} title="Añadir ejercicio">
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {exercises.map((e) => (
              <button key={e.id} className="btn-ghost w-full justify-start" onClick={() => {
                save({ ...session, exercises: [...session.exercises, { exerciseId: e.id, target: { sets: 3, repMin: 8, repMax: 12 }, completed: false, sets: Array.from({ length: 3 }, () => ({ id: uid(), weight: null, reps: null, rir: null, restSec: e.defaultRestSec, warmup: false, done: false })) }] })
                setAdding(false)
              }}>{e.name}<span className="muted ml-auto text-xs">{e.primary.join(', ')}</span></button>
            ))}
          </div>
        </Modal>
      )}
      {finishOpen && (
        <Modal open onClose={() => setFinishOpen(false)} title="Finalizar entrenamiento">
          <p className="text-sm">Has completado <b>{doneSets}</b> de <b>{totalSets}</b> series.</p>
          {doneSets < totalSets && <p className="muted mt-1 text-sm">Las series sin marcar como hechas no cuentan para estadísticas ni récords.</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setFinishOpen(false)}>Seguir</button>
            <button className="btn-primary" onClick={finish}>Finalizar</button>
          </div>
        </Modal>
      )}
      {timer && <RestTimer endAt={timer.endAt} total={timer.total} onClose={() => setTimer(null)} />}
    </div>
  )
}

function ExerciseCard({ se, idx, count, ex, history, trigger, onPatch, onPatchSet, onSetDone, onMove, onRemove }: {
  se: SessionExercise
  idx: number
  count: number
  ex?: Exercise
  history: ReturnType<typeof performanceHistory>
  trigger: 'all_sets' | 'first_set'
  onPatch: (fn: (e: SessionExercise) => SessionExercise) => void
  onPatchSet: (id: string, p: Partial<WorkSet>) => void
  onSetDone: (s: WorkSet) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const [showPrev, setShowPrev] = useState(false)
  const last = history[history.length - 1]
  const prevSessions = history.slice(-3).reverse()
  const suggestion = ex ? suggestNext(ex, se.target, history, trigger) : null
  const prs = personalRecords(history)
  const kind = ex?.kind ?? 'weight'
  const allDone = se.sets.length > 0 && se.sets.every((s) => s.done)
  const repLabel = se.target.repMin === se.target.repMax ? `${se.target.repMax}` : `${se.target.repMin}-${se.target.repMax}`

  const applySuggestion = () => {
    if (!suggestion?.weight) return
    onPatch((e) => ({ ...e, sets: e.sets.map((s) => (s.done || s.warmup ? s : { ...s, weight: suggestion.weight! })) }))
  }
  const copyPrevious = () => {
    if (!last) return
    onPatch((e) => ({
      ...e,
      sets: last.sets.map((p, i) => ({ id: e.sets[i]?.id ?? uid(), weight: p.weight, reps: p.reps, seconds: p.seconds ?? null, rir: p.rir ?? null, restSec: p.restSec ?? e.sets[i]?.restSec ?? ex?.defaultRestSec ?? 90, warmup: false, done: false })),
    }))
  }

  return (
    <Card className={cn(se.completed && 'ring-2 ring-emerald-500/40')}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            {se.completed && <CheckCircle2 size={18} className="text-emerald-500" />}
            {ex?.name ?? 'Ejercicio eliminado'}
          </div>
          <div className="muted text-xs">
            Objetivo {se.target.sets} × {repLabel}{kind === 'time' ? ' s' : ''}{se.target.note ? ` ${se.target.note}` : ''}
            {last && ` · Último (${last.date.slice(5).split('-').reverse().join('/')}): ${last.sets.map((s) => setLabel(s, ex)).join(', ')}`}
          </div>
        </div>
        <div className="flex shrink-0">
          <button className="btn-ghost !p-1" disabled={idx === 0} onClick={() => onMove(-1)} aria-label="Subir"><ChevronUp size={16} /></button>
          <button className="btn-ghost !p-1" disabled={idx === count - 1} onClick={() => onMove(1)} aria-label="Bajar"><ChevronDown size={16} /></button>
          <button className="btn-ghost !p-1 text-red-500" onClick={onRemove} aria-label="Quitar"><X size={16} /></button>
        </div>
      </div>

      {suggestion && suggestion.type !== 'none' && (
        <div className={cn('mb-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs', suggestion.type === 'increase' ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : suggestion.type === 'stall' || suggestion.type === 'decrease' ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'bg-zinc-100 dark:bg-zinc-800/60')}>
          <Lightbulb size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{suggestion.message}</span>
          {suggestion.weight !== undefined && suggestion.type !== 'keep' && kind === 'weight' && (
            <button className="shrink-0 rounded-lg bg-white/70 px-2 py-1 font-semibold dark:bg-black/30" onClick={applySuggestion}>Aplicar {kg(suggestion.weight)} kg</button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="muted text-[11px]">
            <tr>
              <th className="w-7 py-1 text-left font-medium">#</th>
              {kind === 'weight' && <th className="px-1 py-1 font-medium">kg</th>}
              <th className="px-1 py-1 font-medium">{kind === 'time' ? 'seg' : 'reps'}</th>
              <th className="px-1 py-1 font-medium" title="Repeticiones en reserva (RPE = 10 − RIR)">RIR</th>
              <th className="px-1 py-1 font-medium" title="Descanso tras la serie (segundos)">desc.</th>
              <th className="w-20 py-1 font-medium" />
            </tr>
          </thead>
          <tbody>
            {se.sets.map((s, i) => {
              const isPr = s.done && !s.warmup && kind === 'weight' && s.weight !== null && s.reps !== null && prs.bestE1rm !== undefined && (e1rm(s.weight, s.reps) ?? 0) > prs.bestE1rm.value
              return (
                <tr key={s.id} className={cn(s.done && 'bg-emerald-500/5')}>
                  <td className="py-1">
                    <button className={cn('w-6 rounded text-xs font-semibold', s.warmup ? 'text-amber-500' : 'muted')} title="Marcar como calentamiento" onClick={() => onPatchSet(s.id, { warmup: !s.warmup })}>{s.warmup ? 'C' : i + 1}</button>
                  </td>
                  {kind === 'weight' && <td className="px-1 py-1"><NumInput className="input-sm min-w-14" value={s.weight} onChange={(n) => onPatchSet(s.id, { weight: n })} min={0} aria-label="Peso" placeholder={last?.sets[i]?.weight?.toString() ?? ''} /></td>}
                  <td className="px-1 py-1">
                    {kind === 'time'
                      ? <NumInput className="input-sm min-w-12" value={s.seconds ?? null} onChange={(n) => onPatchSet(s.id, { seconds: n })} min={0} aria-label="Segundos" placeholder={last?.sets[i]?.seconds?.toString() ?? ''} />
                      : <NumInput className="input-sm min-w-12" value={s.reps} onChange={(n) => onPatchSet(s.id, { reps: n === null ? null : Math.round(n) })} min={0} aria-label="Repeticiones" placeholder={last?.sets[i]?.reps?.toString() ?? ''} />}
                  </td>
                  <td className="px-1 py-1"><NumInput className="input-sm min-w-10" value={s.rir ?? null} onChange={(n) => onPatchSet(s.id, { rir: n === null ? null : Math.min(10, n) })} min={0} aria-label="RIR" /></td>
                  <td className="px-1 py-1"><NumInput className="input-sm min-w-12" value={s.restSec ?? null} onChange={(n) => onPatchSet(s.id, { restSec: n })} min={0} aria-label="Descanso" /></td>
                  <td className="py-1">
                    <div className="flex items-center justify-end gap-1">
                      {isPr && <Trophy size={15} className="text-amber-500" aria-label="Récord" />}
                      <button
                        className={cn('grid h-8 w-8 place-items-center rounded-lg border transition', s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-700')}
                        aria-label="Serie hecha"
                        onClick={() => {
                          const val = kind === 'time' ? s.seconds : s.reps
                          if (!s.done && (val === null || val === undefined || val <= 0)) {
                            // Si está vacío, se rellena con el valor de referencia de la sesión anterior.
                            const ref = last?.sets[i] ?? last?.sets[last.sets.length - 1]
                            if (!ref) return
                            onPatchSet(s.id, { done: true, reps: s.reps ?? ref.reps, seconds: s.seconds ?? ref.seconds ?? null, weight: s.weight ?? ref.weight })
                          } else onPatchSet(s.id, { done: !s.done })
                          if (!s.done) onSetDone(s)
                        }}
                      >
                        <Check size={16} />
                      </button>
                      <button className="btn-ghost !p-1 text-red-500" onClick={() => onPatch((e) => ({ ...e, sets: e.sets.filter((x) => x.id !== s.id) }))} aria-label="Eliminar serie"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {se.sets.some((s) => s.rir !== null && s.rir !== undefined) && (
        <p className="muted mt-1 text-[11px]">RPE: {se.sets.map((s) => (s.rir === null || s.rir === undefined ? '–' : rirToRpe(s.rir))).join(' · ')}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="btn-secondary !py-1.5 text-xs" onClick={() => onPatch((e) => { const p = e.sets[e.sets.length - 1]; return { ...e, sets: [...e.sets, { id: uid(), weight: p?.weight ?? null, reps: null, seconds: null, rir: null, restSec: p?.restSec ?? ex?.defaultRestSec ?? 90, warmup: false, done: false }] } })}><Plus size={14} />Serie</button>
        {last && <button className="btn-ghost !py-1.5 text-xs" onClick={copyPrevious}><RotateCcw size={14} />Repetir anterior</button>}
        {history.length > 0 && <button className="btn-ghost !py-1.5 text-xs" onClick={() => setShowPrev((v) => !v)}><History size={14} />Sesiones previas</button>}
        <label className="ml-auto flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={se.completed} onChange={(e) => onPatch((x) => ({ ...x, completed: e.target.checked }))} />
          {allDone && !se.completed ? 'Marcar completado' : 'Completado'}
        </label>
      </div>
      {showPrev && (
        <div className="mt-2 rounded-xl bg-zinc-100 p-2.5 text-xs dark:bg-zinc-800/60">
          {prevSessions.map((h) => (
            <div key={h.sessionId} className="flex justify-between gap-2 py-0.5">
              <span className="muted">{h.date}</span>
              <span className="tabular-nums">{h.sets.map((s) => setLabel(s, ex)).join(' · ')}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2">
        <Field label="Comentario">
          <input className="input !py-1.5" placeholder="Técnica, molestias, máquina usada…" value={se.comment ?? ''} onChange={(e) => onPatch((x) => ({ ...x, comment: e.target.value }))} />
        </Field>
      </div>
    </Card>
  )
}

export function useSessionsForDate(date: string) {
  return useLiveQuery(() => db.sessions.where('date').equals(date).toArray(), [date]) ?? []
}
