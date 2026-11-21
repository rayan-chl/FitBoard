import { addDays, differenceInCalendarDays, format, getISODay, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

// Los días se guardan como cadenas locales 'YYYY-MM-DD'. Nunca toISOString() (usa UTC y en Madrid
// puede asignar el registro al día anterior).

export const toDayStr = (d: Date): string => format(d, 'yyyy-MM-dd')
export const todayStr = (): string => toDayStr(new Date())
export const parseDay = (s: string): Date => parseISO(s)
export const addDaysStr = (s: string, n: number): string => toDayStr(addDays(parseISO(s), n))
export const diffDays = (a: string, b: string): number => differenceInCalendarDays(parseISO(a), parseISO(b))
export const isoDayOf = (s: string): number => getISODay(parseISO(s))
export const weekStartStr = (s: string): string => toDayStr(startOfWeek(parseISO(s), { weekStartsOn: 1 }))
export const weekDays = (s: string): string[] => {
  const start = weekStartStr(s)
  return Array.from({ length: 7 }, (_, i) => addDaysStr(start, i))
}
export const fmt = (s: string, pattern: string): string => format(parseISO(s), pattern, { locale: es })
export const fmtLong = (s: string): string => fmt(s, "EEEE d 'de' MMMM")
export const fmtShort = (s: string): string => fmt(s, 'd MMM')
export const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function daysRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(d)
  return out
}
