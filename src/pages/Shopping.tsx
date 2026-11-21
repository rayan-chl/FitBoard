import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Card, Empty, NumInput, PageHeader, ProgressBar, Stat, cn, confirmAction, fmtNum, useToast } from '../components/ui'
import { db, uid } from '../db/db'
import { SEED_SHOPPING } from '../db/seed'
import type { ShoppingItem } from '../db/types'
import { fmtShort, todayStr, weekStartStr } from '../lib/date'
import { useProfile } from '../lib/hooks'

const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })

export default function Shopping() {
  const toast = useToast()
  const profile = useProfile()
  const items = useLiveQuery(() => db.shopping.orderBy('order').toArray(), []) ?? []
  const weeks = useLiveQuery(() => db.shoppingWeeks.orderBy('weekStart').reverse().toArray(), []) ?? []
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [cat, setCat] = useState('Otros')
  const budget = profile?.weeklyBudget ?? 50
  const priced = items.filter((i) => i.price !== null)
  const estimated = priced.reduce((s, i) => s + (i.price ?? 0), 0)
  const spent = items.filter((i) => i.bought && i.price !== null).reduce((s, i) => s + (i.price ?? 0), 0)
  const cats = [...new Set(items.map((i) => i.category))]

  const upd = (id: string, p: Partial<ShoppingItem>) => db.shopping.update(id, p)
  const add = async () => {
    if (!name.trim()) return toast('Escribe el producto', 'error')
    await db.shopping.add({ id: uid(), name: name.trim(), qty: qty.trim(), category: cat.trim() || 'Otros', price: null, bought: false, order: (items[items.length - 1]?.order ?? 0) + 1 })
    setName('')
    setQty('')
  }
  const closeWeek = async () => {
    if (!confirmAction('¿Cerrar la semana? Se guardará en el historial y la lista se reutilizará (desmarcada, conservando los últimos precios).')) return
    await db.transaction('rw', db.shopping, db.shoppingWeeks, async () => {
      await db.shoppingWeeks.add({ id: uid(), weekStart: weekStartStr(todayStr()), closedAt: Date.now(), total: spent, budget, items: items.map((i) => ({ ...i })) })
      await db.shopping.bulkPut(items.map((i) => ({ ...i, bought: false })))
    })
    toast('Semana guardada. Lista lista para reutilizar')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Lista de la compra" subtitle="Referencia: Mercadona · los precios los introduces tú" action={
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => items.forEach((i) => i.bought && upd(i.id, { bought: false }))}><RotateCcw size={15} />Desmarcar</button>
          <button className="btn-primary" onClick={closeWeek}><Archive size={15} />Cerrar semana</button>
        </div>
      } />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Presupuesto" value={eur(budget)} sub="Editable en Configuración" />
        <Stat label="Gastado (marcado)" value={eur(spent)} sub={`${items.filter((i) => i.bought).length}/${items.length} productos`} />
        <Stat label="Coste estimado lista" value={priced.length ? eur(estimated) : '–'} sub={`${priced.length}/${items.length} con precio`} />
        <Stat label={estimated <= budget ? 'Margen' : 'Exceso'} value={priced.length ? eur(Math.abs(budget - estimated)) : '–'} sub={priced.length < items.length ? 'Faltan precios' : 'Lista completa'} />
      </div>
      <ProgressBar value={spent} max={budget} />

      <Card title="Añadir producto">
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <input className="input" placeholder="Producto" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <input className="input" placeholder="Cantidad" value={qty} onChange={(e) => setQty(e.target.value)} />
          <input className="input" list="cats" placeholder="Categoría" value={cat} onChange={(e) => setCat(e.target.value)} />
          <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <button className="btn-primary" onClick={add}><Plus size={16} />Añadir</button>
        </div>
      </Card>

      {items.length === 0 ? (
        <Empty>
          Lista vacía. <button className="text-emerald-600 underline" onClick={() => db.shopping.bulkPut(SEED_SHOPPING)}>Cargar productos habituales</button>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cats.map((c) => (
            <Card key={c} title={c}>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.filter((i) => i.category === c).map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2">
                    <input type="checkbox" className="h-5 w-5 shrink-0 accent-emerald-500" checked={i.bought} onChange={(e) => upd(i.id, { bought: e.target.checked })} aria-label={`Comprado: ${i.name}`} />
                    <div className="min-w-0 flex-1">
                      <input className={cn('w-full bg-transparent text-sm font-medium outline-none', i.bought && 'muted line-through')} value={i.name} onChange={(e) => upd(i.id, { name: e.target.value })} />
                      <input className="muted w-full bg-transparent text-xs outline-none" placeholder="cantidad" value={i.qty} onChange={(e) => upd(i.id, { qty: e.target.value })} />
                    </div>
                    <div className="relative w-24 shrink-0">
                      <NumInput className="input-sm !pr-5 text-right" value={i.price} onChange={(n) => upd(i.id, { price: n })} min={0} placeholder="precio" aria-label="Precio" />
                      <span className="muted pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">€</span>
                    </div>
                    <button className="btn-ghost !p-1.5 text-red-500" onClick={() => db.shopping.delete(i.id)} aria-label="Eliminar"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <Card title="Historial de semanas">
        {weeks.length === 0 ? <p className="muted text-sm">Aún no has cerrado ninguna semana.</p> : (
          <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
            {weeks.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2">
                <span>Semana del {fmtShort(w.weekStart)}</span>
                <span className="tabular-nums"><b>{eur(w.total)}</b> <span className={cn('text-xs', w.total > w.budget ? 'text-red-500' : 'text-emerald-600')}>({w.total > w.budget ? '+' : '−'}{eur(Math.abs(w.total - w.budget))})</span>
                  <button className="btn-ghost ml-1 !p-1 text-red-500" onClick={() => confirmAction('¿Eliminar esta semana del historial?') && db.shoppingWeeks.delete(w.id)} aria-label="Eliminar"><Trash2 size={13} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {weeks.length > 0 && <p className="muted mt-2 text-xs">Media: {eur(weeks.reduce((s, w) => s + w.total, 0) / weeks.length)} / semana ({fmtNum(weeks.length, 0)} semanas)</p>}
      </Card>
    </div>
  )
}
