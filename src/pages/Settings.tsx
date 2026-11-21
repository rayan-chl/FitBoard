import { useLiveQuery } from 'dexie-react-hooks'
import { Database, Download, FlaskConical, HardDrive, Moon, Sun, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from '../components/Layout'
import { Card, Field, Modal, NumInput, PageHeader, confirmAction, fmtNum, useToast } from '../components/ui'
import { TABLES, db, ensureSeed, requestPersistence } from '../db/db'
import type { Profile } from '../db/types'
import { backupSummary, downloadJson, exportAll, importBackup, parseBackup, type Backup } from '../lib/backup'
import { todayStr } from '../lib/date'
import { useMeasurements, useProfile } from '../lib/hooks'
import { bmr, maintenance } from '../lib/nutrition'
import { countSampleData, loadSampleData, removeSampleData } from '../lib/sample'
import { latestWeight } from '../lib/stats'

const TABLE_LABELS: Record<string, string> = {
  profile: 'Perfil', foods: 'Alimentos', recipes: 'Recetas', diary: 'Registros de comida', days: 'Agua / días', exercises: 'Ejercicios', routine: 'Programa',
  sessions: 'Entrenamientos', measurements: 'Medidas', photos: 'Fotos', digestive: 'Registro digestivo', shopping: 'Lista de compra', shoppingWeeks: 'Semanas de compra',
}

export default function SettingsPage() {
  const profile = useProfile()
  return (
    <div className="space-y-4">
      <PageHeader title="Configuración" subtitle="Perfil, objetivos, copias de seguridad y datos" />
      <div className="grid gap-4 xl:grid-cols-2">
        {profile && <ProfileForm key={profile.startDate + profile.startWeight} profile={profile} />}
        <div className="space-y-4">
          <BackupCard />
          <StorageCard />
          <SampleCard />
          <ThemeCard />
          <DangerCard />
        </div>
      </div>
    </div>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const toast = useToast()
  const ms = useMeasurements()
  const [p, setP] = useState<Profile>(profile)
  const [errors, setErrors] = useState<string[]>([])
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }))
  const setT = (k: keyof Profile['targets'], v: number | null) => setP((x) => ({ ...x, targets: { ...x.targets, [k]: v ?? 0 } }))
  const w = latestWeight(ms)?.weight ?? p.startWeight
  const macroKcal = p.targets.protein * 4 + p.targets.carbs * 4 + p.targets.fat * 9
  const b = bmr(p, w)
  const m = maintenance(p, w)

  const save = async () => {
    const e: string[] = []
    if (!(p.heightCm >= 120 && p.heightCm <= 230)) e.push('Altura entre 120 y 230 cm.')
    if (!(p.age >= 14 && p.age <= 100)) e.push('Edad entre 14 y 100 años.')
    if (!(p.startWeight >= 30 && p.startWeight <= 300) || !(p.goalWeight >= 30 && p.goalWeight <= 300)) e.push('Pesos entre 30 y 300 kg.')
    if (!(p.targets.kcal >= 1000 && p.targets.kcal <= 6000)) e.push('Calorías objetivo entre 1.000 y 6.000 kcal.')
    if ([p.targets.protein, p.targets.carbs, p.targets.fat].some((v) => !(v >= 0))) e.push('Los macros no pueden ser negativos.')
    if (!(p.weeklyBudget >= 0)) e.push('Presupuesto no válido.')
    setErrors(e)
    if (e.length) return
    await db.profile.put(p)
    toast('Perfil guardado')
  }

  return (
    <Card title="Perfil y objetivos">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Altura (cm)"><NumInput value={p.heightCm} onChange={(n) => set('heightCm', n ?? 0)} /></Field>
          <Field label="Edad"><NumInput value={p.age} onChange={(n) => set('age', n ?? 0)} /></Field>
          <Field label="Sexo"><select className="input" value={p.sex} onChange={(e) => set('sex', e.target.value as Profile['sex'])}><option value="hombre">Hombre</option><option value="mujer">Mujer</option></select></Field>
          <Field label="Fecha de inicio"><input type="date" className="input" value={p.startDate} onChange={(e) => set('startDate', e.target.value || todayStr())} /></Field>
          <Field label="Peso inicial (kg)"><NumInput value={p.startWeight} onChange={(n) => set('startWeight', n ?? 0)} /></Field>
          <Field label="Peso objetivo (kg)"><NumInput value={p.goalWeight} onChange={(n) => set('goalWeight', n ?? 0)} /></Field>
          <div className="col-span-2"><Field label="Objetivo posterior"><input className="input" value={p.laterGoal} onChange={(e) => set('laterGoal', e.target.value)} /></Field></div>
        </div>
        <Field label="Objetivo"><input className="input" value={p.goal} onChange={(e) => set('goal', e.target.value)} /></Field>
        <Field label="Nivel de actividad (para estimar el mantenimiento)">
          <select className="input" value={p.activityFactor} onChange={(e) => set('activityFactor', Number(e.target.value))}>
            <option value={1.2}>Sedentario (×1,2)</option>
            <option value={1.375}>Ligero (×1,375)</option>
            <option value={1.55}>Moderado: caminar 1 h + 4 días de gimnasio (×1,55)</option>
            <option value={1.725}>Alto (×1,725)</option>
          </select>
        </Field>

        <div>
          <span className="label">Objetivos diarios</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="kcal"><NumInput value={p.targets.kcal} onChange={(n) => setT('kcal', n)} /></Field>
            <Field label="Proteína (g)"><NumInput value={p.targets.protein} onChange={(n) => setT('protein', n)} /></Field>
            <Field label="Carbos (g)"><NumInput value={p.targets.carbs} onChange={(n) => setT('carbs', n)} /></Field>
            <Field label="Grasas (g)"><NumInput value={p.targets.fat} onChange={(n) => setT('fat', n)} /></Field>
            <Field label="Agua (ml)"><NumInput value={p.targets.waterMl} onChange={(n) => setT('waterMl', n)} /></Field>
          </div>
        </div>
        <div className="rounded-xl bg-zinc-100 p-3 text-xs leading-relaxed dark:bg-zinc-800/60">
          <div>Los macros suman <b>{fmtNum(macroKcal, 0)} kcal</b> (objetivo {fmtNum(p.targets.kcal, 0)}){Math.abs(macroKcal - p.targets.kcal) > 100 && <span className="text-amber-600"> — no cuadran con el objetivo de kcal</span>}.</div>
          <div>Proteína: <b>{fmtNum(p.targets.protein / w, 2)} g/kg</b> con {fmtNum(w)} kg · {fmtNum(p.targets.protein / p.goalWeight, 2)} g/kg con el peso objetivo.</div>
          <div>Metabolismo en reposo estimado (Mifflin-St Jeor): ~{fmtNum(b, 0)} kcal · mantenimiento ~{fmtNum(m, 0)} kcal → diferencia con el objetivo: {fmtNum(p.targets.kcal - m, 0)} kcal/día.</div>
          <div className="muted mt-1">Son estimaciones orientativas (error individual apreciable), no objetivos médicos. Ajusta según tu evolución real.</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Presupuesto semanal de compra (€)"><NumInput value={p.weeklyBudget} onChange={(n) => set('weeklyBudget', n ?? 0)} /></Field>
          <Field label="Sugerir subir peso cuando…">
            <select className="input" value={p.progressTrigger} onChange={(e) => set('progressTrigger', e.target.value as Profile['progressTrigger'])}>
              <option value="all_sets">Todas las series llegan al tope del rango</option>
              <option value="first_set">La primera serie llega al tope</option>
            </select>
          </Field>
        </div>
        <Field label="Punto de medida de la cintura"><input className="input" value={p.waistSite} onChange={(e) => set('waistSite', e.target.value)} /></Field>
        {errors.length > 0 && <ul className="text-sm text-red-500">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="flex justify-end"><button className="btn-primary" onClick={save}>Guardar perfil</button></div>
      </div>
    </Card>
  )
}

function BackupCard() {
  const toast = useToast()
  const profile = useProfile()
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Backup | null>(null)

  const doExport = async (photos: boolean) => {
    setBusy(true)
    try {
      const b = await exportAll(photos)
      downloadJson(b, `fitdash-backup-${todayStr()}${photos ? '' : '-sin-fotos'}.json`)
      await db.profile.update('profile', { lastBackupAt: Date.now() })
      toast('Copia descargada')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al exportar', 'error')
    } finally {
      setBusy(false)
    }
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      setPending(parseBackup(await f.text()))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivo no válido', 'error')
    }
  }
  const doImport = async (mode: 'replace' | 'merge') => {
    if (!pending) return
    if (mode === 'replace' && !confirmAction('Se BORRARÁN los datos actuales y se sustituirán por los de la copia. ¿Continuar?')) return
    setBusy(true)
    try {
      await importBackup(pending, mode)
      await ensureSeed()
      toast(mode === 'replace' ? 'Datos restaurados' : 'Datos combinados')
      setPending(null)
    } catch (e) {
      toast(e instanceof Error ? `Error al importar: ${e.message}` : 'Error al importar', 'error')
    } finally {
      setBusy(false)
    }
  }
  const days = profile?.lastBackupAt ? Math.floor((Date.now() - profile.lastBackupAt) / 86400000) : null

  return (
    <Card title={<span className="flex items-center gap-2"><Database size={16} />Copia de seguridad (JSON)</span>}>
      <p className="muted mb-3 text-sm">Tus datos viven solo en este navegador. Exporta una copia con regularidad y guárdala en la nube o en tu ordenador para recuperarla en otro navegador o dispositivo.</p>
      <p className="mb-3 text-sm">Última copia: <b>{days === null ? 'nunca' : days === 0 ? 'hoy' : `hace ${days} día${days === 1 ? '' : 's'}`}</b></p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => doExport(true)}><Download size={16} />Exportar todo</button>
        <button className="btn-secondary" disabled={busy} onClick={() => doExport(false)}><Download size={16} />Exportar sin fotos</button>
        <label className="btn-secondary cursor-pointer"><Upload size={16} />Importar…<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} /></label>
      </div>
      {pending && (
        <Modal open onClose={() => setPending(null)} title="Importar copia de seguridad">
          <p className="mb-2 text-sm">Copia del <b>{new Date(pending.exportedAt).toLocaleString('es-ES')}</b> (esquema v{pending.schemaVersion}){pending.includesPhotos ? '' : ', sin fotos'}.</p>
          <ul className="mb-4 grid grid-cols-2 gap-x-4 text-sm">
            {backupSummary(pending).map((s) => <li key={s.table} className="flex justify-between"><span className="muted">{TABLE_LABELS[s.table]}</span><b className="tabular-nums">{s.count}</b></li>)}
          </ul>
          <div className="space-y-2 text-sm">
            <button className="btn-danger w-full" disabled={busy} onClick={() => doImport('replace')}>Reemplazar todo (restaurar)</button>
            <button className="btn-secondary w-full" disabled={busy} onClick={() => doImport('merge')}>Combinar (añade y actualiza, no borra)</button>
            <p className="muted text-xs">"Reemplazar" es lo indicado al cambiar de navegador o dispositivo. {!pending.includesPhotos && 'Como la copia no incluye fotos, tus fotos actuales se conservan.'}</p>
          </div>
        </Modal>
      )}
    </Card>
  )
}

function StorageCard() {
  const toast = useToast()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<{ usage?: number; quota?: number } | null>(null)
  const refresh = async () => {
    try {
      setPersisted((await navigator.storage?.persisted?.()) ?? null)
      setUsage((await navigator.storage?.estimate?.()) ?? null)
    } catch {
      setPersisted(null)
    }
  }
  useEffect(() => {
    refresh()
  }, [])
  const mb = (n?: number) => (n === undefined ? '?' : `${fmtNum(n / 1048576, 1)} MB`)
  return (
    <Card title={<span className="flex items-center gap-2"><HardDrive size={16} />Almacenamiento</span>}>
      <p className="text-sm">Almacenamiento persistente: <b>{persisted === null ? 'no disponible' : persisted ? 'concedido ✓' : 'no concedido'}</b></p>
      {usage && <p className="muted text-xs">Uso: {mb(usage.usage)} de {mb(usage.quota)}</p>}
      <p className="muted my-2 text-xs">Con almacenamiento persistente, el navegador no borra tus datos para liberar espacio. Instalar la app en la pantalla de inicio ayuda a que se conceda. Aun así, haz copias: Safari puede borrar datos tras 7 días sin usar la web.</p>
      {!persisted && <button className="btn-secondary" onClick={async () => { const ok = await requestPersistence(); toast(ok ? 'Almacenamiento persistente concedido' : 'El navegador no lo ha concedido (puede hacerlo más adelante)', ok ? 'ok' : 'error'); refresh() }}>Solicitar almacenamiento persistente</button>}
    </Card>
  )
}

function SampleCard() {
  const toast = useToast()
  const count = useLiveQuery(() => countSampleData(), []) ?? 0
  const [busy, setBusy] = useState(false)
  return (
    <Card title={<span className="flex items-center gap-2"><FlaskConical size={16} />Datos de ejemplo</span>}>
      <p className="muted mb-3 text-sm">Para probar gráficos y análisis. Se marcan con la etiqueta <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300">Ejemplo</span> y se borran de una vez sin tocar tus registros.</p>
      <p className="mb-3 text-sm">Registros de ejemplo actuales: <b>{count}</b></p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={busy || count > 0} onClick={async () => { setBusy(true); try { await loadSampleData(); toast('Datos de ejemplo cargados') } finally { setBusy(false) } }}>Cargar ejemplo (4 semanas)</button>
        <button className="btn-danger" disabled={busy || count === 0} onClick={async () => { if (!confirmAction('¿Eliminar todos los datos de ejemplo?')) return; await removeSampleData(); toast('Datos de ejemplo eliminados') }}>Eliminar datos de ejemplo</button>
      </div>
    </Card>
  )
}

function ThemeCard() {
  const { dark, toggle } = useTheme()
  return (
    <Card title="Apariencia">
      <button className="btn-secondary" onClick={toggle}>{dark ? <Sun size={16} /> : <Moon size={16} />}Cambiar a tema {dark ? 'claro' : 'oscuro'}</button>
    </Card>
  )
}

function DangerCard() {
  const toast = useToast()
  return (
    <Card title="Zona peligrosa">
      <p className="muted mb-3 text-sm">Borra todos los datos de este navegador y vuelve a la configuración inicial. Exporta antes una copia.</p>
      <button className="btn-danger" onClick={async () => {
        if (!confirmAction('¿Borrar TODOS tus datos? Esta acción no se puede deshacer.')) return
        if (window.prompt('Escribe BORRAR para confirmar') !== 'BORRAR') return
        await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => { for (const t of TABLES) await db.table(t).clear() })
        await ensureSeed()
        toast('Datos borrados')
      }}><Trash2 size={16} />Borrar todos los datos</button>
    </Card>
  )
}
