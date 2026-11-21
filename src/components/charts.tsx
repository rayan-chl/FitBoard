import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtShort } from '../lib/date'
import { Empty } from './ui'

const axis = { stroke: 'var(--chart-text)', fontSize: 11, tickLine: false, axisLine: false }
const tooltipStyle = {
  contentStyle: { background: 'var(--tooltip-bg, #111827)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 12 },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#fff' },
}

export interface SeriesDef {
  key: string
  name: string
  color: string
  dashed?: boolean
  dot?: boolean
}

export function TimeLineChart({ data, series, height = 220, unit = '', refY, refLabel, minPoints = 2, emptyText = 'Aún no hay suficientes registros para el gráfico.' }: {
  data: Record<string, unknown>[]
  series: SeriesDef[]
  height?: number
  unit?: string
  refY?: number
  refLabel?: string
  minPoints?: number
  emptyText?: string
}) {
  if (data.length < minPoints) return <Empty>{emptyText}</Empty>
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => fmtShort(d)} minTickGap={24} />
          <YAxis {...axis} domain={['auto', 'auto']} width={48} tickFormatter={(v: number) => `${Math.round(v * 10) / 10}`} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtShort(String(d))} formatter={(v) => [`${typeof v === 'number' ? Math.round(v * 10) / 10 : v}${unit ? ' ' + unit : ''}`]} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {refY !== undefined && <ReferenceLine y={refY} stroke="#10b981" strokeDasharray="4 4" label={{ value: refLabel, fill: 'var(--chart-text)', fontSize: 11, position: 'insideTopRight' }} />}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={s.dashed ? 1.5 : 2.5} strokeDasharray={s.dashed ? '4 3' : undefined} dot={s.dot === false ? false : { r: 2.5 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SimpleBarChart({ data, xKey, bars, height = 220, refY, horizontal }: {
  data: Record<string, unknown>[]
  xKey: string
  bars: { key: string; name: string; color: string }[]
  height?: number
  refY?: number
  horizontal?: boolean
}) {
  if (!data.length) return <Empty>Aún no hay datos.</Empty>
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: horizontal ? 8 : -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={!!horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" {...axis} />
              <YAxis type="category" dataKey={xKey} {...axis} width={110} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axis} />
              <YAxis {...axis} width={48} />
            </>
          )}
          <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(127,127,127,0.08)' }} />
          {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {refY !== undefined && (horizontal ? <ReferenceLine x={refY} stroke="#10b981" strokeDasharray="4 4" /> : <ReferenceLine y={refY} stroke="#10b981" strokeDasharray="4 4" />)}
          {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
