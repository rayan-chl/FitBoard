import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { useLiveQuery } from 'dexie-react-hooks'
import { Apple, Check, ChevronLeft, ChevronRight, Dumbbell, Scale, Target } from 'lucide-react'
import { useState } from 'react'
import { Card, Modal, PageHeader, Segmented, cn, fmtNum } from '../components/ui'
import { db } from '../db/db'
import { MEALS, type DiaryEntry } from '../db/types'
import { DAY_NAMES, addDaysStr, daysRange, fmtLong, isoDayOf, parseDay, toDayStr, weekStartStr } from '../lib/date'
import { useExerciseMap, useMeasurements, useProfile, useSessions, useToday } from '../lib/hooks'
import { dayTotals } from '../lib/nutrition'
import { navigate } from '../lib/router'
import { MacroLine } from './nutrition/AddEntryModal'
import { setLabel } from './training/Workout'
import { workingSets } from '../lib/training'

export default function CalendarPage({ params }: { params: URLSearchParams }) {
  const today = useToday()
  const [view, setView] = useState<'mes' | 'semana'>('mes')
  const [anchor, setAnchor] = useState(params.get('d') || today)
  const [open, setOpen] = useState<string | null>(null)
  const profile = useProfile()
  const sessions = useSessions()
  const ms = useMeasurements()
  const routine = useLiveQuery(() => db.routine.toArray(), []) ?? []

  const a = parseDay(anchor)
  const from = view === 'mes' ? toDayStr(startOfWeek(startOfMonth(a), { weekStartsOn: 1 })) : weekStartStr(anchor)
  const to = view === 'mes' ? toDayStr(endOfWeek(endOfMonth(a), { weekStartsOn: 1 })) : addDaysStr(from, 6)
  const diary = useLiveQuery(() => db.diary.where('date').between(from, to, true, true).toArray(), [from, to]) ?? []
  const days = daysRange(from, to)
  const byDay = new Map<string, DiaryEntry[]>()
  for (const e of diary) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])

  const move = (dir: number) => setAnchor(view === 'mes' ? toDayStr(addMonths(a, dir)) : addDaysStr(anchor, 7 * dir))
  const title = view === 'mes' ? format(a, 'MMMM yyyy', { locale: es }) : `Semana del ${format(parseDay(from), "d 'de' MMMM", { locale: es })}`

  return (
    <div>
      <PageHeader title="Calendario" action={<Segmented value={view} onChange={setView} options={[{ value: 'mes', label: 'Mes' }, { value: 'semana', label: 'Semana' }]} />} />
      <div className="mb-3 flex items-center gap-2">
        <button className="btn-secondary !p-2" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
        <h2 className="min-w-40 text-center font-semibold first-letter:uppercase">{title}</h2>
        <button className="btn-secondary !p-2" onClick={() => move(1)} aria-label="Siguiente"><ChevronRight size={18} /></button>
        <button className="btn-ghost text-sm" onClick={() => setAnchor(today)}>Hoy</button>
      </div>
      <div className="muted mb-3 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1"><Dumbbell size={12} />Programado</span>
        <span className="flex items-center gap-1"><Check size={12} className="text-emerald-500" />Entreno hecho</span>
        <span className="flex items-center gap-1"><Apple size={12} />Comidas</span>
        <span className="flex items-center gap-1"><Scale size={12} />Peso</span>
        <span className="flex items-center gap-1"><Target size={12} className="text-emerald-500" />kcal y proteína en objetivo</span>
      </div>

      <div className={cn('grid gap-1.5', view === 'mes' ? 'grid-cols-7' : 'grid-cols-1 sm:grid-cols-7')}>
        {view === 'mes' && DAY_NAMES.slice(1).map((d) => <div key={d} className="muted pb-1 text-center text-[11px] font-medium">{d.slice(0, 3)}</div>)}
        {days.map((d) => {
          const plan = routine.find((r) => r.isoDay === isoDayOf(d))
          const done = sessions.filter((s) => s.date === d && s.status === 'done')
          const entries = byDay.get(d) ?? []
          const meals = new Set(entries.map((e) => e.meal)).size
          const t = dayTotals(entries)
          const w = ms.find((m) => m.date === d && m.weight !== undefined)
          const goal = profile && meals >= 2 && Math.abs(t.kcal - profile.targets.kcal) <= profile.targets.kcal * 0.1 && t.protein >= profile.targets.protein * 0.9
          const outside = view === 'mes' && d.slice(0, 7) !== anchor.slice(0, 7)
          return (
            <button
              key={d}
              onClick={() => setOpen(d)}
              className={cn('card flex flex-col items-stretch gap-0.5 !p-1.5 text-left text-[10px] transition hover:border-emerald-500/60 sm:!p-2 sm:text-xs', view === 'mes' ? 'min-h-16 sm:min-h-24' : 'min-h-28', outside && 'opacity-40', d === today && 'ring-2 ring-emerald-500')}
            >
              <span className="flex items-center justify-between font-semibold">
                <span>{view === 'semana' ? `${DAY_NAMES[isoDayOf(d)].slice(0, 3)} ` : ''}{Number(d.slice(8))}</span>
                {goal && <Target size={12} className="text-emerald-500" />}
              </span>
              {plan && <span className={cn('hidden truncate sm:block', plan.type === 'rest' && 'muted')}>{plan.name}</span>}
              <span className="mt-auto flex flex-wrap items-center gap-1">
                {done.length > 0 ? <Check size={12} className="text-emerald-500" /> : plan?.type === 'gym' ? <Dumbbell size={11} className="muted" /> : null}
                {meals > 0 && <span className="flex items-center"><Apple size={11} />{meals}</span>}
                {w && <span className="hidden items-center sm:flex"><Scale size={11} />{fmtNum(w.weight)}</span>}
              </span>
            </button>
          )
        })}
      </div>
      {open && <DayDetail date={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function DayDetail({ date, onClose }: { date: string; onClose: () => void }) {
  const profile = useProfile()
  const sessions = useSessions().filter((s) => s.date === date)
  const { map } = useExerciseMap()
  const entries = useLiveQuery(() => db.diary.where('date').equals(date).toArray(), [date]) ?? []
  const day = useLiveQuery(() => db.days.get(date), [date])
  const m = useLiveQuery(() => db.measurements.where('date').equals(date).first(), [date])
  const dig = useLiveQuery(() => db.digestive.where('date').equals(date).toArray(), [date]) ?? []
  const routine = useLiveQuery(() => db.routine.get(isoDayOf(date)), [date])
  const t = dayTotals(entries)
  return (
    <Modal open onClose={onClose} title={<span className="first-letter:uppercase">{fmtLong(date)}</span>} wide>
      <div className="space-y-4">
        <Card title="Entrenamiento" action={<button className="btn-ghost text-xs" onClick={() => navigate('entreno', { d: date })}>Abrir</button>}>
          <p className="muted mb-1 text-xs">Programado: {routine?.name ?? '—'}</p>
          {sessions.length === 0 ? <p className="text-sm">Sin entrenamiento registrado.</p> : sessions.map((s) => (
            <div key={s.id} className="mb-2 text-sm">
              <div className="font-medium">{s.dayName} {s.status === 'done' ? '✓' : '(en curso)'}</div>
              {s.exercises.map((e, i) => {
                const ws = workingSets(e.sets)
                if (!ws.length) return null
                return <div key={i} className="muted text-xs">{map.get(e.exerciseId)?.name}: {ws.map((x) => setLabel(x, map.get(e.exerciseId))).join(', ')}</div>
              })}
              {s.notes && <div className="text-xs italic">{s.notes}</div>}
            </div>
          ))}
        </Card>
        <Card title="Comidas" action={<button className="btn-ghost text-xs" onClick={() => navigate('nutricion', { d: date })}>Abrir</button>}>
          {entries.length === 0 ? <p className="text-sm">Sin comidas registradas.</p> : (
            <>
              {MEALS.map((ml) => {
                const es = entries.filter((e) => e.meal === ml.id)
                if (!es.length) return null
                return <div key={ml.id} className="mb-1.5 text-sm"><b>{ml.label}:</b> {es.map((e) => e.name).join(', ')} <MacroLine m={dayTotals(es)} /></div>
              })}
              <div className="mt-2 rounded-xl bg-zinc-100 p-2.5 text-sm dark:bg-zinc-800/60">
                Total: <MacroLine m={t} />
                {profile && <div className="muted text-xs">Objetivo {profile.targets.kcal} kcal · {profile.targets.protein} g proteína</div>}
              </div>
            </>
          )}
          <p className="muted mt-2 text-xs">Agua: {fmtNum((day?.waterMl ?? 0) / 1000, 2)} L</p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Medidas">{m ? <div className="text-sm">{m.weight !== undefined && <div>Peso: <b>{fmtNum(m.weight)} kg</b></div>}{m.waist !== undefined && <div>Cintura: {fmtNum(m.waist)} cm</div>}{m.abdomen !== undefined && <div>Abdominal: {fmtNum(m.abdomen)} cm</div>}</div> : <p className="text-sm">Sin medidas.</p>}</Card>
          <Card title="Digestivo">{dig.length ? dig.map((d) => <div key={d.id} className="text-sm">Estado {d.bowelState}/5{d.symptoms.length ? ` · ${d.symptoms.join(', ')}` : ''}{d.notes ? ` — ${d.notes}` : ''}</div>) : <p className="text-sm">Sin registro.</p>}</Card>
        </div>
      </div>
    </Modal>
  )
}
