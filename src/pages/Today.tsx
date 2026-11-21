import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CalendarCheck, CheckCircle2, DatabaseBackup, Droplets, Dumbbell, Flame, Footprints, Play, Plus, Scale, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { TimeLineChart } from '../components/charts'
import { Card, MacroBar, NumInput, PageHeader, ProgressBar, Stat, fmtNum, useToast } from '../components/ui'
import { db, requestPersistence, uid } from '../db/db'
import { MEALS, type MealType } from '../db/types'
import { addRecipeEntry, addWater } from '../lib/actions'
import { DAY_NAMES, addDaysStr, fmtLong, isoDayOf, weekDays } from '../lib/date'
import { useExerciseMap, useMeasurements, useProfile, useSessions, useToday } from '../lib/hooks'
import { dayTotals } from '../lib/nutrition'
import { navigate } from '../lib/router'
import { avgWeightBetween, latestWeight, streak, weightSeries } from '../lib/stats'
import { performanceHistory } from '../lib/training'
import { useNutritionWarnings } from './Nutrition'

// Comidas habituales para registrar con un toque.
const QUICK: { meal: MealType; recipeId: string }[] = [
  { meal: 'desayuno', recipeId: 'batido' },
  { meal: 'comida', recipeId: 'pollo-arroz' },
  { meal: 'merienda', recipeId: 'merienda' },
  { meal: 'cena', recipeId: 'cena-habitual' },
]

export default function Today() {
  const today = useToday()
  const toast = useToast()
  const profile = useProfile()
  const ms = useMeasurements()
  const sessions = useSessions()
  const { map: exMap, exercises } = useExerciseMap()
  const routine = useLiveQuery(() => db.routine.orderBy('isoDay').toArray(), []) ?? []
  const entries = useLiveQuery(() => db.diary.where('date').equals(today).toArray(), [today]) ?? []
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? []
  const day = useLiveQuery(() => db.days.get(today), [today])
  const activity = useLiveQuery(async () => {
    const from = addDaysStr(today, -400)
    const [d, s, m, w] = await Promise.all([
      db.diary.where('date').between(from, today, true, true).toArray(),
      db.sessions.where('date').between(from, today, true, true).toArray(),
      db.measurements.where('date').between(from, today, true, true).toArray(),
      db.days.where('date').between(from, today, true, true).toArray(),
    ])
    return new Set([...d.map((x) => x.date), ...s.map((x) => x.date), ...m.map((x) => x.date), ...w.filter((x) => x.waterMl > 0).map((x) => x.date)])
  }, [today])
  const warnings = useNutritionWarnings(today)
  const [weightIn, setWeightIn] = useState<number | null>(null)

  const iso = isoDayOf(today)
  const plan = routine.find((r) => r.isoDay === iso)
  const todaySessions = sessions.filter((s) => s.date === today)
  const doneToday = todaySessions.some((s) => s.status === 'done')
  const inProgress = todaySessions.find((s) => s.status === 'in_progress')
  const week = weekDays(today)
  const doneWeek = sessions.filter((s) => s.status === 'done' && s.date >= week[0] && s.date <= week[6]).length
  const plannedWeek = routine.filter((r) => r.type === 'gym').length
  const next = useMemo(() => {
    for (let i = 1; i <= 7; i++) {
      const d = addDaysStr(today, i)
      const r = routine.find((x) => x.isoDay === isoDayOf(d))
      if (r?.type === 'gym') return { date: d, r }
    }
    return null
  }, [routine, today])

  const totals = dayTotals(entries)
  const last = latestWeight(ms)
  const avg7 = avgWeightBetween(ms, addDaysStr(today, -6), today)
  const current = avg7 && avg7.n >= 3 ? avg7.avg : last?.weight
  const todayWeight = ms.find((m) => m.date === today)?.weight

  const series = useMemo(() => weightSeries(ms).filter((p) => p.date >= addDaysStr(today, -60)).map((p) => ({ date: p.date, peso: p.weight, media: p.avg7 })), [ms, today])
  const waist = ms.filter((m) => m.waist !== undefined).map((m) => ({ date: m.date, cintura: m.waist }))
  const mainLift = exercises.find((e) => e.id === 'press-banca') ?? exercises.find((e) => e.main)
  const liftData = mainLift ? performanceHistory(sessions.filter((s) => s.status === 'done'), mainLift.id).map((h) => ({ date: h.date, e1rm: h.bestE1rm, top: h.topWeight })) : []

  if (!profile) return null
  const t = profile.targets
  const span = profile.startWeight - profile.goalWeight
  const progress = current !== undefined && span !== 0 ? Math.max(0, Math.min(100, ((profile.startWeight - current) / span) * 100)) : 0
  const backupDays = profile.lastBackupAt ? Math.floor((Date.now() - profile.lastBackupAt) / 86400000) : null
  const hasData = (activity?.size ?? 0) > 0

  const saveWeight = async () => {
    if (weightIn === null || weightIn < 30 || weightIn > 300) return toast('Introduce un peso válido', 'error')
    const ex = await db.measurements.where('date').equals(today).first()
    if (ex) await db.measurements.update(ex.id, { weight: weightIn })
    else await db.measurements.add({ id: uid(), date: today, weight: weightIn })
    setWeightIn(null)
    void requestPersistence()
    toast('Peso registrado')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="HOY" subtitle={`${fmtLong(today)} · ${plan?.name ?? ''}`} />

      {hasData && (backupDays === null || backupDays > 7) && (
        <button onClick={() => navigate('ajustes')} className="flex w-full items-center gap-3 rounded-2xl border border-sky-300 bg-sky-50 p-3 text-left text-sm dark:border-sky-500/30 dark:bg-sky-500/10">
          <DatabaseBackup size={18} className="shrink-0 text-sky-500" />
          <span>{backupDays === null ? 'Aún no has hecho ninguna copia de seguridad.' : `Tu última copia es de hace ${backupDays} días.`} Exporta tus datos para no perderlos.</span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Scale size={13} />} label="Peso actual" value={current !== undefined ? `${fmtNum(current)} kg` : '–'} sub={avg7 && avg7.n >= 3 ? `Media 7 días (${avg7.n} pesadas)` : last ? `Último: ${last.date.slice(8)}/${last.date.slice(5, 7)}` : 'Registra tu peso'} />
        <Stat icon={<Target size={13} />} label="Objetivo" value={`${fmtNum(profile.goalWeight)} kg`} sub={current !== undefined ? `${current > profile.goalWeight ? 'Faltan' : 'Por debajo'} ${fmtNum(Math.abs(current - profile.goalWeight))} kg · inicio ${fmtNum(profile.startWeight)}` : `Inicio ${fmtNum(profile.startWeight)} kg`} />
        <div className="card !p-3.5">
          <div className="muted text-xs font-medium">Progreso hacia el objetivo</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{fmtNum(progress, 0)} %</div>
          <ProgressBar value={progress} max={100} className="mt-1.5" />
        </div>
        <Stat icon={<Flame size={13} className="text-orange-500" />} label="Racha" value={`${activity ? streak(activity, today) : 0} días`} sub="Días seguidos registrando" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Entrenamiento */}
        <Card className="lg:col-span-1" title={<span className="flex items-center gap-2"><Dumbbell size={16} className="text-emerald-500" />Entrenamiento de hoy</span>}>
          {plan ? (
            <>
              <div className="text-lg font-bold">{plan.name}</div>
              <p className="muted mb-2 text-sm">{plan.description}</p>
              {plan.type === 'gym' ? (
                <>
                  <ul className="mb-3 space-y-0.5 text-sm">
                    {plan.exercises.map((e, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{exMap.get(e.exerciseId)?.name}</span><span className="muted shrink-0 tabular-nums">{e.sets}×{e.repMin === e.repMax ? e.repMax : `${e.repMin}-${e.repMax}`}</span></li>)}
                  </ul>
                  {doneToday ? (
                    <button className="btn-secondary w-full" onClick={() => navigate('entreno')}><CheckCircle2 size={16} className="text-emerald-500" />Completado · ver sesión</button>
                  ) : (
                    <button className="btn-primary w-full" onClick={() => navigate('entreno', inProgress ? { s: inProgress.id } : {})}><Play size={16} />{inProgress ? 'Continuar entrenamiento' : 'Ir al entrenamiento'}</button>
                  )}
                </>
              ) : (
                <ul className="space-y-1 text-sm">{plan.activities.map((a) => <li key={a} className="flex items-center gap-2"><Footprints size={14} className="text-emerald-500" />{a}</li>)}</ul>
              )}
            </>
          ) : <p className="muted text-sm">Sin programa para hoy.</p>}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
            <div><div className="muted text-xs">Esta semana</div><div className="font-semibold"><CalendarCheck size={14} className="mr-1 inline text-emerald-500" />{doneWeek}/{plannedWeek} sesiones</div></div>
            <div><div className="muted text-xs">Próximo</div><div className="truncate font-semibold">{next ? `${DAY_NAMES[isoDayOf(next.date)].slice(0, 3)} · ${next.r.name}` : '—'}</div></div>
          </div>
        </Card>

        {/* Nutrición */}
        <Card className="lg:col-span-2" title="Nutrición de hoy" action={<button className="btn-primary !py-1.5 text-xs" onClick={() => navigate('nutricion')}><Plus size={14} />Registrar</button>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <MacroBar label="Calorías" value={totals.kcal} target={t.kcal} unit="kcal" color="var(--color-kcal)" />
            <MacroBar label="Proteína" value={totals.protein} target={t.protein} unit="g" color="var(--color-protein)" />
            <MacroBar label="Carbohidratos" value={totals.carbs} target={t.carbs} unit="g" color="var(--color-carbs)" />
            <MacroBar label="Grasas" value={totals.fat} target={t.fat} unit="g" color="var(--color-fat)" />
          </div>
          <div className="mt-4">
            <div className="label">Registro rápido de comidas habituales</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK.map((q) => {
                const r = recipes.find((x) => x.id === q.recipeId)
                if (!r) return null
                const logged = entries.some((e) => e.recipeId === r.id && e.meal === q.meal)
                return (
                  <button key={q.meal} disabled={logged} className="btn-secondary !justify-start !px-2.5 text-left text-xs" onClick={async () => {
                    try { await addRecipeEntry(today, q.meal, r, 1); toast(`${r.name} registrado`) } catch (e) { toast(e instanceof Error ? e.message : 'Error', 'error') }
                  }}>
                    {logged ? <CheckCircle2 size={14} className="shrink-0 text-emerald-500" /> : <Plus size={14} className="shrink-0" />}
                    <span className="truncate"><b>{MEALS.find((m) => m.id === q.meal)?.label}</b><br /><span className="muted">{r.name}</span></span>
                  </button>
                )
              })}
            </div>
          </div>
          {warnings.length > 0 && (
            <div className="mt-3 flex gap-2 rounded-xl bg-amber-500/10 p-3 text-xs">
              <AlertTriangle size={15} className="shrink-0 text-amber-500" />
              <div>{warnings.map((w, i) => <p key={i}>{w.message}</p>)}</div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={<span className="flex items-center gap-2"><Droplets size={16} className="text-sky-500" />Agua</span>}>
          <div className="text-2xl font-bold tabular-nums">{fmtNum((day?.waterMl ?? 0) / 1000, 2)} <span className="muted text-sm font-normal">/ {fmtNum(t.waterMl / 1000, 1)} L</span></div>
          <ProgressBar value={day?.waterMl ?? 0} max={t.waterMl} color="var(--color-water)" className="my-2" />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1 text-xs" onClick={() => addWater(today, 250)}>+250 ml</button>
            <button className="btn-secondary flex-1 text-xs" onClick={() => addWater(today, 500)}>+500 ml</button>
            <button className="btn-ghost text-xs" disabled={!day?.waterMl} onClick={() => addWater(today, -250)}>−250</button>
          </div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Scale size={16} />Peso de hoy</span>}>
          {todayWeight !== undefined && <p className="mb-2 text-sm">Registrado: <b>{fmtNum(todayWeight)} kg</b></p>}
          <div className="flex gap-2">
            <NumInput value={weightIn} onChange={setWeightIn} placeholder={todayWeight !== undefined ? 'Corregir…' : 'kg en ayunas'} className="input" />
            <button className="btn-primary" onClick={saveWeight}>Guardar</button>
          </div>
          <p className="muted mt-2 text-xs">Por la mañana, tras ir al baño y antes de comer. Más medidas en Progreso.</p>
        </Card>
        <Card title="Evolución del peso">
          <TimeLineChart data={series} height={150} unit="kg" refY={profile.goalWeight} series={[{ key: 'peso', name: 'Diario', color: '#94a3b8', dashed: true }, { key: 'media', name: 'Media 7 d', color: '#10b981', dot: false }]} emptyText="Registra tu peso unos días para ver la tendencia." />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cintura">
          <TimeLineChart data={waist} height={170} unit="cm" series={[{ key: 'cintura', name: 'Cintura', color: '#6366f1' }]} emptyText="Registra tu cintura en Progreso cada 1-2 semanas." />
        </Card>
        <Card title={`Rendimiento: ${mainLift?.name ?? ''}`}>
          <TimeLineChart data={liftData} height={170} unit="kg" series={[{ key: 'e1rm', name: '1RM est.', color: '#10b981' }, { key: 'top', name: 'Peso máx.', color: '#6366f1' }]} emptyText="Completa sesiones para ver tu evolución." />
        </Card>
      </div>
    </div>
  )
}
