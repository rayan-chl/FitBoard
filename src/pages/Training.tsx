import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Dumbbell, Footprints, Pencil, Play, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, Empty, PageHeader, SampleBadge, Segmented, fmtNum, useToast } from '../components/ui'
import { db } from '../db/db'
import type { Exercise, RoutineDay } from '../db/types'
import { DAY_NAMES, addDaysStr, fmtLong, fmtShort, isoDayOf, todayStr } from '../lib/date'
import { useExerciseMap, useProfile, useSessions } from '../lib/hooks'
import { navigate } from '../lib/router'
import { buildSession, performanceHistory, personalRecords, suggestNext, workingSets } from '../lib/training'
import { ExerciseDetail, ExerciseEditor } from './training/ExerciseDetail'
import { RoutineEditor } from './training/RoutineEditor'
import { Workout, setLabel } from './training/Workout'

type Tab = 'sesion' | 'historial' | 'ejercicios' | 'rutina'

export default function Training({ params }: { params: URLSearchParams }) {
  const tab = (params.get('tab') as Tab) || 'sesion'
  const date = params.get('d') || todayStr()
  return (
    <div>
      <PageHeader title="Entrenamiento" subtitle={tab === 'sesion' ? fmtLong(date) : undefined} />
      <Segmented
        className="mb-4 max-w-full"
        value={tab}
        onChange={(t) => navigate('entreno', t === 'sesion' ? { d: date } : { tab: t })}
        options={[
          { value: 'sesion', label: 'Sesión' },
          { value: 'historial', label: 'Historial' },
          { value: 'ejercicios', label: 'Ejercicios y récords' },
          { value: 'rutina', label: 'Programa' },
        ]}
      />
      {tab === 'sesion' && <SessionTab date={date} sessionId={params.get('s')} />}
      {tab === 'historial' && <HistoryTab />}
      {tab === 'ejercicios' && <ExercisesTab />}
      {tab === 'rutina' && <RoutineEditor />}
    </div>
  )
}

function SessionTab({ date, sessionId }: { date: string; sessionId: string | null }) {
  const toast = useToast()
  const sessions = useSessions()
  const routine = useLiveQuery(() => db.routine.orderBy('isoDay').toArray(), []) ?? []
  const { map: exMap } = useExerciseMap()
  const profile = useProfile()
  const dayIso = isoDayOf(date)
  const [chosenIso, setChosenIso] = useState<number | null>(null)
  const plan = routine.find((r) => r.isoDay === (chosenIso ?? dayIso))
  const todays = sessions.filter((s) => s.date === date).sort((a, b) => a.startedAt - b.startedAt)
  const current = todays.find((s) => s.id === sessionId) ?? todays.find((s) => s.status === 'in_progress') ?? (sessionId ? undefined : todays[todays.length - 1])
  const go = (d: string) => navigate('entreno', { d })

  const start = async (day: RoutineDay) => {
    const s = buildSession(day, date, sessions.filter((x) => x.status === 'done'), exMap)
    await db.sessions.add(s)
    navigate('entreno', { d: date, s: s.id })
    toast('Entrenamiento iniciado')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary !p-2" onClick={() => go(addDaysStr(date, -1))} aria-label="Día anterior"><ChevronLeft size={18} /></button>
        <input type="date" className="input !w-auto" value={date} onChange={(e) => e.target.value && go(e.target.value)} />
        <button className="btn-secondary !p-2" onClick={() => go(addDaysStr(date, 1))} aria-label="Día siguiente"><ChevronRight size={18} /></button>
        {date !== todayStr() && <button className="btn-ghost text-sm" onClick={() => go(todayStr())}>Hoy</button>}
        {todays.length > 1 && (
          <select className="input ml-auto !w-auto" value={current?.id ?? ''} onChange={(e) => navigate('entreno', { d: date, s: e.target.value })}>
            {todays.map((s, i) => <option key={s.id} value={s.id}>Sesión {i + 1}: {s.dayName}</option>)}
          </select>
        )}
      </div>

      {current ? (
        <>
          <Workout key={current.id} session={current} />
          <button className="btn-ghost text-sm" onClick={() => navigate('entreno', { d: date, s: 'nueva' })}><Plus size={15} />Registrar otra sesión este día</button>
        </>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="muted text-xs">{DAY_NAMES[dayIso]} · programado</div>
                <div className="text-lg font-bold">{routine.find((r) => r.isoDay === dayIso)?.name ?? '—'}</div>
              </div>
              <label className="text-sm">
                <span className="muted mr-2 text-xs">Entrenar otro día del programa:</span>
                <select className="input !inline-block !w-auto" value={chosenIso ?? dayIso} onChange={(e) => setChosenIso(Number(e.target.value))}>
                  {routine.map((r) => <option key={r.isoDay} value={r.isoDay}>{DAY_NAMES[r.isoDay]} — {r.name}</option>)}
                </select>
              </label>
            </div>
          </Card>
          {plan && (plan.type === 'rest' ? (
            <Card title={<span className="flex items-center gap-2"><Footprints size={16} className="text-emerald-500" />{plan.name}</span>}>
              <p className="muted mb-2 text-sm">{plan.description}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">{plan.activities.map((a) => <li key={a}>{a}</li>)}</ul>
            </Card>
          ) : (
            <Card
              title={<span className="flex items-center gap-2"><Dumbbell size={16} className="text-emerald-500" />{plan.name} <span className="muted font-normal">· {plan.description}</span></span>}
              action={<button className="btn-primary" onClick={() => start(plan)}><Play size={16} />Empezar</button>}
            >
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {plan.exercises.map((pe, i) => {
                  const ex = exMap.get(pe.exerciseId)
                  const hist = performanceHistory(sessions.filter((s) => s.status === 'done'), pe.exerciseId)
                  const last = hist[hist.length - 1]
                  const sug = ex ? suggestNext(ex, pe, hist, profile?.progressTrigger ?? 'all_sets') : null
                  return (
                    <li key={i} className="py-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{ex?.name ?? '?'}</span>
                        <span className="muted shrink-0 text-sm tabular-nums">{pe.sets} × {pe.repMin === pe.repMax ? pe.repMax : `${pe.repMin}-${pe.repMax}`}{pe.note ? ` ${pe.note}` : ''}</span>
                      </div>
                      {last && <div className="muted text-xs">Último: {last.sets.map((s) => setLabel(s, ex)).join(', ')}</div>}
                      {sug && sug.type === 'increase' && <div className="text-xs text-emerald-600 dark:text-emerald-400">↑ {sug.message}</div>}
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}
          {plan?.type === 'rest' && (
            <button className="btn-secondary" onClick={() => start({ ...plan, exercises: [] })}><Plus size={16} />Registrar entrenamiento libre</button>
          )}
        </>
      )}
    </div>
  )
}

function HistoryTab() {
  const sessions = useSessions()
  const { map } = useExerciseMap()
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)
  if (!sorted.length) return <Empty>Aún no has registrado entrenamientos.</Empty>
  return (
    <div className="space-y-2">
      {sorted.map((s) => {
        let sets = 0
        let vol = 0
        for (const e of s.exercises) for (const st of workingSets(e.sets)) { sets++; vol += (st.weight ?? 0) * (st.reps ?? 0) }
        return (
          <button key={s.id} className="card flex w-full items-center justify-between gap-3 text-left hover:border-emerald-500/50" onClick={() => navigate('entreno', { d: s.date, s: s.id })}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold">{s.dayName}<SampleBadge show={s.isSample} />{s.status === 'in_progress' && <span className="chip bg-sky-500/15 text-sky-700 dark:text-sky-300">En curso</span>}</div>
              <div className="muted text-xs first-letter:uppercase">{fmtLong(s.date)}</div>
              <div className="muted truncate text-xs">{s.exercises.map((e) => map.get(e.exerciseId)?.name).filter(Boolean).join(' · ')}</div>
            </div>
            <div className="shrink-0 text-right text-sm tabular-nums">
              <div><b>{sets}</b> series</div>
              <div className="muted text-xs">{fmtNum(vol, 0)} kg vol.</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ExercisesTab() {
  const sessions = useSessions()
  const { exercises } = useExerciseMap()
  const [detail, setDetail] = useState<Exercise | null>(null)
  const [editing, setEditing] = useState<Exercise | null | 'new'>(null)
  const done = useMemo(() => sessions.filter((s) => s.status === 'done'), [sessions])
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button className="btn-primary" onClick={() => setEditing('new')}><Plus size={16} />Nuevo ejercicio</button></div>
      <div className="grid gap-2 md:grid-cols-2">
        {exercises.map((ex) => {
          const hist = performanceHistory(done, ex.id)
          const last = hist[hist.length - 1]
          const pr = personalRecords(hist)
          return (
            <div key={ex.id} className="card flex items-center justify-between gap-2 !p-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(ex)}>
                <div className="font-medium">{ex.name}</div>
                <div className="muted text-xs">{ex.primary.join(', ')}{ex.secondary.length ? ` (+${ex.secondary.join(', ')})` : ''}</div>
                <div className="text-xs">
                  {last ? <>Último: <b>{ex.kind === 'weight' ? `${fmtNum(last.topWeight)} kg` : setLabel(last.sets[0], ex)}</b> · {fmtShort(last.date)}</> : <span className="muted">Sin registros</span>}
                  {pr.bestE1rm && <span className="muted"> · 1RM est. {fmtNum(pr.bestE1rm.value)} kg</span>}
                </div>
              </button>
              <button className="btn-ghost !p-1.5" onClick={() => setEditing(ex)} aria-label="Editar"><Pencil size={15} /></button>
            </div>
          )
        })}
      </div>
      {detail && <ExerciseDetail ex={detail} sessions={sessions} onClose={() => setDetail(null)} />}
      {editing && <ExerciseEditor ex={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
