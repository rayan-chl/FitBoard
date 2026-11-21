import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ChevronLeft, ChevronRight, Info, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SimpleBarChart, TimeLineChart } from '../components/charts'
import { Card, Empty, Field, Modal, NumInput, PageHeader, SampleBadge, Segmented, Stat, cn, confirmAction, fmtNum, useToast } from '../components/ui'
import { db, uid } from '../db/db'
import type { Measurement, Photo } from '../db/types'
import { addDaysStr, daysRange, fmtShort, todayStr, weekStartStr } from '../lib/date'
import { useExerciseMap, useMeasurements, useProfile, useSessions, useToday } from '../lib/hooks'
import { dayTotals } from '../lib/nutrition'
import { avgWeightBetween, firstOf, latestOf, latestWeight, rateMessage, weightRate, weightSeries } from '../lib/stats'
import { weeklySummary } from '../lib/summary'
import { muscleVolume, performanceHistory } from '../lib/training'

export default function Progress() {
  const [tab, setTab] = useState<'cuerpo' | 'analisis' | 'fotos'>('cuerpo')
  return (
    <div>
      <PageHeader title="Progreso" subtitle="Evolución física, cargas y adherencia" />
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[{ value: 'cuerpo', label: 'Medidas' }, { value: 'analisis', label: 'Análisis' }, { value: 'fotos', label: 'Fotos' }]} />
      {tab === 'cuerpo' && <Body />}
      {tab === 'analisis' && <Analysis />}
      {tab === 'fotos' && <Photos />}
    </div>
  )
}

const FIELDS: { key: keyof Measurement; label: string; unit: string }[] = [
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'waist', label: 'Cintura', unit: 'cm' },
  { key: 'abdomen', label: 'Perímetro abdominal', unit: 'cm' },
  { key: 'chest', label: 'Pecho', unit: 'cm' },
  { key: 'arm', label: 'Brazo', unit: 'cm' },
  { key: 'thigh', label: 'Muslo', unit: 'cm' },
]

export function MeasurementForm({ initial, onDone }: { initial?: Measurement; onDone?: () => void }) {
  const toast = useToast()
  const [m, setM] = useState<Measurement>(initial ?? { id: uid(), date: todayStr() })
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    const vals = FIELDS.map((f) => m[f.key] as number | undefined).filter((v) => v !== undefined)
    if (!m.date) return setErr('Indica la fecha')
    if (!vals.length) return setErr('Introduce al menos una medida')
    if (m.weight !== undefined && (m.weight < 30 || m.weight > 300)) return setErr('El peso debe estar entre 30 y 300 kg')
    if (FIELDS.slice(1).some((f) => m[f.key] !== undefined && ((m[f.key] as number) < 10 || (m[f.key] as number) > 250))) return setErr('Revisa los perímetros (10-250 cm)')
    // Un registro por día: si ya existe otro para esa fecha, se combinan.
    const existing = (await db.measurements.where('date').equals(m.date).toArray()).filter((x) => x.id !== m.id)
    const merged: Measurement = existing.length ? { ...existing[0], ...Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)), id: existing[0].id, isSample: existing[0].isSample && initial?.isSample ? true : undefined } : { ...m, isSample: initial?.isSample }
    await db.transaction('rw', db.measurements, async () => {
      if (existing.length && initial) await db.measurements.delete(m.id)
      await db.measurements.put(merged)
    })
    toast('Medidas guardadas')
    setErr(null)
    if (!initial) setM({ id: uid(), date: m.date })
    onDone?.()
  }
  return (
    <div className="space-y-3">
      <Field label="Fecha"><input type="date" className="input" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <Field key={f.key} label={`${f.label} (${f.unit})`}>
            <NumInput value={(m[f.key] as number | undefined) ?? null} onChange={(n) => setM({ ...m, [f.key]: n ?? undefined })} min={0} />
          </Field>
        ))}
      </div>
      <Field label="Notas"><input className="input" value={m.notes ?? ''} onChange={(e) => setM({ ...m, notes: e.target.value || undefined })} /></Field>
      {err && <p className="text-sm text-red-500">{err}</p>}
      <button className="btn-primary w-full" onClick={save}>Guardar</button>
    </div>
  )
}

function Body() {
  const profile = useProfile()
  const ms = useMeasurements()
  const today = useToday()
  const [editing, setEditing] = useState<Measurement | null>(null)
  const series = useMemo(() => weightSeries(ms), [ms])
  if (!profile) return null
  const last = latestWeight(ms)
  const cur7 = avgWeightBetween(ms, addDaysStr(today, -6), today)
  const prev7 = avgWeightBetween(ms, addDaysStr(today, -13), addDaysStr(today, -7))
  const rate = weightRate(ms, today)
  const losing = profile.goalWeight < profile.startWeight
  const w0 = firstOf(ms, 'waist')
  const w1 = latestOf(ms, 'waist')
  const current = cur7 && cur7.n >= 3 ? cur7.avg : last?.weight

  const chartWeight = series.map((p) => ({ date: p.date, peso: p.weight, media: p.avg7 }))
  const chartWaist = ms.filter((m) => m.waist !== undefined || m.abdomen !== undefined).map((m) => ({ date: m.date, cintura: m.waist ?? null, abdomen: m.abdomen ?? null }))
  const chartOther = ms.filter((m) => m.chest !== undefined || m.arm !== undefined || m.thigh !== undefined).map((m) => ({ date: m.date, pecho: m.chest ?? null, brazo: m.arm ?? null, muslo: m.thigh ?? null }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Último peso" value={last ? `${fmtNum(last.weight)} kg` : '–'} sub={last ? fmtShort(last.date) : 'Sin registros'} />
        <Stat label="Media 7 días" value={cur7 && cur7.n >= 3 ? `${fmtNum(cur7.avg, 2)} kg` : '–'} sub={cur7 ? `${cur7.n} pesadas` : 'Mín. 3 pesadas'} />
        <Stat label="Cambio semanal (medias)" value={cur7 && prev7 && cur7.n >= 3 && prev7.n >= 3 ? `${cur7.avg - prev7.avg > 0 ? '+' : ''}${fmtNum(cur7.avg - prev7.avg, 2)} kg` : '–'} sub="Últimos 7 días vs. 7 anteriores" />
        <Stat label="Desde el inicio" value={current !== undefined ? `${current - profile.startWeight > 0 ? '+' : ''}${fmtNum(current - profile.startWeight)} kg` : '–'} sub={`Inicio ${fmtNum(profile.startWeight)} kg`} />
        <Stat label="Distancia al objetivo" value={current !== undefined ? `${fmtNum(Math.abs(current - profile.goalWeight))} kg` : '–'} sub={`Objetivo ${fmtNum(profile.goalWeight)} kg`} />
        <Stat label="Cintura" value={w1 ? `${fmtNum(w1.waist)} cm` : '–'} sub={w0 && w1 && w0.id !== w1.id ? `${(w1.waist! - w0.waist!) > 0 ? '+' : ''}${fmtNum(w1.waist! - w0.waist!)} cm desde ${fmtShort(w0.date)}` : 'Sin comparación aún'} />
        <div className="card col-span-2 !p-3.5">
          <div className="muted text-xs font-medium">Ritmo (tendencia 2-3 semanas)</div>
          {rate ? (
            <>
              <div className="text-xl font-bold tabular-nums">{rate.kgPerWeek > 0 ? '+' : ''}{fmtNum(rate.kgPerWeek, 2)} kg/sem <span className="muted text-sm font-normal">({fmtNum(rate.pctPerWeek, 2)} %)</span></div>
              <div className={cn('text-xs', rateMessage(rate.pctPerWeek, losing).tone === 'warn' ? 'text-amber-600' : 'muted')}>{rateMessage(rate.pctPerWeek, losing).text}</div>
            </>
          ) : (
            <div className="muted mt-1 text-sm">Necesita ≥ 8 pesadas repartidas en al menos 14 días.</div>
          )}
        </div>
      </div>
      <p className="muted flex items-start gap-1.5 text-xs"><Info size={14} className="mt-0.5 shrink-0" />El peso diario varía por agua, glucógeno y sodio. Una subida puntual no significa ganancia de grasa: fíjate en la media de 7 días y la cintura.</p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Peso corporal">
          <TimeLineChart data={chartWeight} unit="kg" refY={profile.goalWeight} refLabel="Objetivo" series={[{ key: 'peso', name: 'Peso diario', color: '#94a3b8', dashed: true }, { key: 'media', name: 'Media 7 días', color: '#10b981', dot: false }]} />
        </Card>
        <Card title="Nuevo registro"><MeasurementForm /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cintura y perímetro abdominal">
          <TimeLineChart data={chartWaist} unit="cm" series={[{ key: 'cintura', name: 'Cintura', color: '#6366f1' }, { key: 'abdomen', name: 'Abdominal', color: '#ec4899' }]} />
          <p className="muted mt-2 text-[11px]">Mide siempre igual: {profile.waistSite}. Cambios menores de ~1 cm suelen ser ruido.</p>
        </Card>
        <Card title="Pecho, brazo y muslo">
          <TimeLineChart data={chartOther} unit="cm" series={[{ key: 'pecho', name: 'Pecho', color: '#0ea5e9' }, { key: 'brazo', name: 'Brazo', color: '#f59e0b' }, { key: 'muslo', name: 'Muslo', color: '#10b981' }]} />
        </Card>
      </div>
      <Card title="Historial de medidas">
        {ms.length === 0 ? <Empty>Sin registros.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="muted text-left text-xs"><tr><th className="py-1.5 font-medium">Fecha</th>{FIELDS.map((f) => <th key={f.key} className="px-2 py-1.5 text-right font-medium">{f.label.split(' ')[0]}</th>)}<th /></tr></thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[...ms].reverse().map((m) => (
                  <tr key={m.id}>
                    <td className="py-1.5"><span className="flex items-center gap-1.5">{fmtShort(m.date)}<SampleBadge show={m.isSample} /></span></td>
                    {FIELDS.map((f) => <td key={f.key} className="px-2 py-1.5 text-right tabular-nums">{fmtNum(m[f.key] as number | undefined)}</td>)}
                    <td className="whitespace-nowrap py-1.5 text-right">
                      <button className="btn-ghost !p-1.5" onClick={() => setEditing(m)} aria-label="Editar"><Pencil size={14} /></button>
                      <button className="btn-ghost !p-1.5 text-red-500" onClick={() => confirmAction('¿Eliminar este registro?') && db.measurements.delete(m.id)} aria-label="Eliminar"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && <Modal open onClose={() => setEditing(null)} title="Editar medidas"><MeasurementForm initial={editing} onDone={() => setEditing(null)} /></Modal>}
    </div>
  )
}

function Analysis() {
  const today = useToday()
  const [week, setWeek] = useState(weekStartStr(today))
  const sessions = useSessions()
  const ms = useMeasurements()
  const profile = useProfile()
  const { map: exMap, exercises } = useExerciseMap()
  const routine = useLiveQuery(() => db.routine.toArray(), []) ?? []
  const from28 = addDaysStr(today, -27)
  const diary = useLiveQuery(() => db.diary.where('date').between(addDaysStr(today, -90), addDaysStr(today, 7), true, true).toArray(), [today]) ?? []
  const summary = weeklySummary(week, sessions, routine, ms, diary, exMap)
  const done = sessions.filter((s) => s.status === 'done')
  const mains = exercises.filter((e) => e.main && e.kind === 'weight')
  const [lift, setLift] = useState<string>('')
  useEffect(() => { if (!lift && mains[0]) setLift(mains[0].id) }, [lift, mains])

  const liftData = lift ? performanceHistory(done, lift).map((h) => ({ date: h.date, e1rm: h.bestE1rm, top: h.topWeight })) : []
  const weekEnd = addDaysStr(week, 6)
  const vol = muscleVolume(done.filter((s) => s.date >= week && s.date <= weekEnd), exMap)
  const volData = [...vol.entries()].sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ musculo: m, series: Math.round(v * 10) / 10 }))

  const weeks = Array.from({ length: 8 }, (_, i) => addDaysStr(weekStartStr(today), -7 * (7 - i)))
  const sessionsPerWeek = weeks.map((w) => ({ semana: fmtShort(w), sesiones: done.filter((s) => s.date >= w && s.date <= addDaysStr(w, 6)).length }))

  // Nutrición (28 días): solo días con ≥2 comidas registradas.
  const byDay = new Map<string, typeof diary>()
  for (const e of diary) if (e.date >= from28 && e.date <= today) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e])
  const nutDays = daysRange(from28, today).map((d) => {
    const es = byDay.get(d) ?? []
    const full = new Set(es.map((e) => e.meal)).size >= 2
    const t = dayTotals(es)
    return { date: d, full, kcal: full ? Math.round(t.kcal) : null, proteina: full ? Math.round(t.protein) : null }
  })
  const fullDays = nutDays.filter((d) => d.full)
  const t = profile?.targets
  const avgK = fullDays.length ? fullDays.reduce((s, d) => s + (d.kcal ?? 0), 0) / fullDays.length : 0
  const avgP = fullDays.length ? fullDays.reduce((s, d) => s + (d.proteina ?? 0), 0) / fullDays.length : 0
  const adherent = t ? fullDays.filter((d) => Math.abs((d.kcal ?? 0) - t.kcal) <= t.kcal * 0.1 && (d.proteina ?? 0) >= t.protein * 0.9).length : 0

  return (
    <div className="space-y-4">
      <Card
        title="Resumen semanal"
        action={
          <div className="flex items-center gap-1">
            <button className="btn-ghost !p-1.5" onClick={() => setWeek(addDaysStr(week, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
            <span className="text-xs tabular-nums">{fmtShort(summary.weekStart)} – {fmtShort(summary.weekEnd)}</span>
            <button className="btn-ghost !p-1.5" disabled={week >= weekStartStr(today)} onClick={() => setWeek(addDaysStr(week, 7))} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
          </div>
        }
      >
        <ul className="space-y-1.5 text-sm">
          {summary.lines.map((l, i) => <li key={i} className={cn('rounded-lg px-3 py-2', l.tone === 'ok' ? 'bg-emerald-500/10' : 'bg-zinc-100 dark:bg-zinc-800/60')}>{l.text}</li>)}
        </ul>
        {summary.insufficient.length > 0 && <ul className="muted mt-2 space-y-0.5 text-xs">{summary.insufficient.map((s) => <li key={s}>· {s}</li>)}</ul>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cargas en ejercicios principales" action={
          <select className="input !w-auto !py-1 text-xs" value={lift} onChange={(e) => setLift(e.target.value)}>
            {mains.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        }>
          <TimeLineChart data={liftData} unit="kg" series={[{ key: 'e1rm', name: '1RM estimado', color: '#10b981' }, { key: 'top', name: 'Peso máximo', color: '#6366f1' }]} />
        </Card>
        <Card title={`Volumen por grupo muscular (${fmtShort(week)} – ${fmtShort(weekEnd)})`}>
          <SimpleBarChart data={volData} xKey="musculo" horizontal height={Math.max(160, volData.length * 26)} refY={10} bars={[{ key: 'series', name: 'Series', color: '#10b981' }]} />
          <p className="muted mt-1 text-[11px]">Series efectivas: músculo principal = 1, secundario = 0,5. Línea de referencia: 10 series (dato descriptivo, no una pauta).</p>
        </Card>
        <Card title="Sesiones completadas por semana">
          <SimpleBarChart data={sessionsPerWeek} xKey="semana" refY={routine.filter((r) => r.type === 'gym').length} bars={[{ key: 'sesiones', name: 'Sesiones', color: '#6366f1' }]} />
        </Card>
        <Card title="Nutrición (últimos 28 días)">
          {fullDays.length < 3 ? <Empty>Registra al menos 3 días completos (≥ 2 comidas) para ver medias.</Empty> : (
            <>
              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800/60"><div className="font-bold tabular-nums">{Math.round(avgK)}</div><div className="muted text-[11px]">kcal media</div></div>
                <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800/60"><div className="font-bold tabular-nums">{Math.round(avgP)} g</div><div className="muted text-[11px]">proteína media</div></div>
                <div className="rounded-xl bg-zinc-100 p-2 dark:bg-zinc-800/60"><div className="font-bold tabular-nums">{Math.round((adherent / fullDays.length) * 100)} %</div><div className="muted text-[11px]">adherencia ({adherent}/{fullDays.length})</div></div>
              </div>
              <TimeLineChart data={nutDays.filter((d) => d.full)} series={[{ key: 'kcal', name: 'kcal', color: '#10b981' }]} refY={t?.kcal} refLabel="Objetivo" height={160} />
              <p className="muted mt-1 text-[11px]">Adherencia: días con kcal a ±10 % del objetivo y ≥ 90 % de la proteína.</p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const max = 1280
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * k)
  canvas.height = Math.round(bmp.height * k)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo procesar la imagen'))), 'image/webp', 0.8))
}

function PhotoThumb({ p }: { p: Photo }) {
  const [url, setUrl] = useState<string>('')
  useEffect(() => {
    const u = URL.createObjectURL(p.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [p.blob])
  return (
    <div className="card !p-2">
      {url && <img src={url} alt={`Progreso ${p.date}`} className="aspect-[3/4] w-full rounded-xl object-cover" />}
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="text-xs font-medium">{fmtShort(p.date)}</span>
        <button className="btn-ghost !p-1 text-red-500" onClick={() => confirmAction('¿Eliminar esta foto?') && db.photos.delete(p.id)} aria-label="Eliminar"><Trash2 size={14} /></button>
      </div>
      {p.note && <p className="muted text-[11px]">{p.note}</p>}
    </div>
  )
}

function Photos() {
  const toast = useToast()
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), []) ?? []
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) throw new Error('Solo se admiten imágenes')
        const blob = await compressImage(f)
        await db.photos.add({ id: uid(), date, blob, note: note || undefined })
      }
      setNote('')
      toast('Foto guardada')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al guardar la foto', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4">
      <Card title="Añadir foto de progreso">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <Field label="Fecha"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Nota"><input className="input" placeholder="Frontal, lateral, en ayunas…" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <label className={cn('btn-primary cursor-pointer', busy && 'opacity-50')}>
            <Camera size={16} />{busy ? 'Guardando…' : 'Elegir foto'}
            <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
          </label>
        </div>
        <p className="muted mt-2 text-xs">Las fotos se guardan solo en este dispositivo (comprimidas). Inclúyelas en la copia de seguridad para no perderlas.</p>
      </Card>
      {photos.length === 0 ? <Empty>Aún no hay fotos.</Empty> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{photos.map((p) => <PhotoThumb key={p.id} p={p} />)}</div>
      )}
    </div>
  )
}
