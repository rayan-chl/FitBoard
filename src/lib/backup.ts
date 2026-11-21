import { z } from 'zod'
import { db, SCHEMA_VERSION, TABLES, type FitDB, type TableName } from '../db/db'

export const BACKUP_FORMAT = 'fitdash-backup'

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string(),
  includesPhotos: z.boolean(),
  data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
})

export type Backup = z.infer<typeof backupSchema>

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`
}

function dataUrlToBlob(url: string): Blob {
  const m = /^data:([^;]*);base64,(.*)$/.exec(url)
  if (!m) throw new Error('Foto con formato no válido')
  const bin = atob(m[2])
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: m[1] })
}

export async function exportAll(includePhotos = true, database: FitDB = db): Promise<Backup> {
  const data: Record<string, Record<string, unknown>[]> = {}
  for (const t of TABLES) {
    if (t === 'photos') {
      if (!includePhotos) {
        data.photos = []
        continue
      }
      const photos = await database.photos.toArray()
      data.photos = await Promise.all(photos.map(async (p) => ({ ...p, blob: await blobToDataUrl(p.blob) })))
    } else {
      data[t] = (await database.table(t).toArray()) as Record<string, unknown>[]
    }
  }
  return { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), includesPhotos: includePhotos, data }
}

export function parseBackup(text: string): Backup {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  const res = backupSchema.safeParse(json)
  if (!res.success) throw new Error('El archivo no es una copia de seguridad de FitDash.')
  if (res.data.schemaVersion > SCHEMA_VERSION) throw new Error(`La copia es de una versión más nueva de la app (esquema ${res.data.schemaVersion}). Actualiza la app.`)
  const keyOf: Record<TableName, string> = {
    profile: 'id', foods: 'id', recipes: 'id', diary: 'id', days: 'date', exercises: 'id', routine: 'isoDay',
    sessions: 'id', measurements: 'id', photos: 'id', digestive: 'id', shopping: 'id', shoppingWeeks: 'id',
  }
  for (const [t, rows] of Object.entries(res.data.data)) {
    if (!(TABLES as readonly string[]).includes(t)) continue
    const k = keyOf[t as TableName]
    if (rows.some((r) => r[k] === undefined || r[k] === null)) throw new Error(`Registros sin clave en la tabla "${t}".`)
  }
  return res.data
}

export function backupSummary(b: Backup): { table: string; count: number }[] {
  return TABLES.map((t) => ({ table: t, count: b.data[t]?.length ?? 0 }))
}

/** mode 'replace': borra todo y restaura. 'merge': añade/actualiza por clave sin borrar nada. */
export async function importBackup(b: Backup, mode: 'replace' | 'merge', database: FitDB = db): Promise<void> {
  const prepared: Partial<Record<TableName, unknown[]>> = {}
  for (const t of TABLES) {
    const rows = b.data[t]
    if (!rows) continue
    prepared[t] = t === 'photos' ? rows.map((p) => ({ ...p, blob: dataUrlToBlob(String(p.blob)) })) : rows
  }
  await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
    for (const t of TABLES) {
      // Una copia "sin fotos" nunca borra las fotos existentes.
      if (t === 'photos' && !b.includesPhotos) continue
      const rows = prepared[t]
      if (mode === 'replace') await database.table(t).clear()
      if (rows?.length) await database.table(t).bulkPut(rows)
    }
  })
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
