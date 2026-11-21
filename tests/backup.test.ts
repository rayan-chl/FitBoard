import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { FitDB, ensureSeed } from '../src/db/db'
import { exportAll, importBackup, parseBackup } from '../src/lib/backup'

describe('copia de seguridad', () => {
  it('exporta e importa todos los datos (reemplazar y combinar)', async () => {
    const a = new FitDB('test-a')
    await ensureSeed(a)
    await a.measurements.add({ id: 'm1', date: '2026-11-20', weight: 88.6, waist: 95 })
    await a.diary.add({ id: 'd1', date: '2026-11-20', meal: 'comida', kind: 'food', name: 'Arroz', factor: 1, items: [], createdAt: 1 })
    const json = JSON.stringify(await exportAll(true, a))
    const parsed = parseBackup(json)

    const b = new FitDB('test-b')
    await ensureSeed(b)
    await b.measurements.add({ id: 'other', date: '2026-01-01', weight: 90 })
    await importBackup(parsed, 'replace', b)
    expect(await b.measurements.count()).toBe(1)
    expect((await b.measurements.get('m1'))?.weight).toBe(88.6)
    expect(await b.foods.count()).toBe(await a.foods.count())

    const c = new FitDB('test-c')
    await c.measurements.add({ id: 'other', date: '2026-01-01', weight: 90 })
    await importBackup(parsed, 'merge', c)
    expect(await c.measurements.count()).toBe(2)
  })
  it('rechaza archivos que no son copias', () => {
    expect(() => parseBackup('{"hola":1}')).toThrow()
    expect(() => parseBackup('no json')).toThrow()
  })
})
