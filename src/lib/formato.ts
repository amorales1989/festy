// Formato y fechas para Argentina. Toda fecha/hora se muestra y se ingresa en la
// zona horaria de la organización (no la del navegador) y se guarda en UTC.
import { TZDate } from '@date-fns/tz'
import { addDays, format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

export const ZONA_POR_DEFECTO = 'America/Argentina/Buenos_Aires'

const moneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })
const monedaCorta = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const numero = new Intl.NumberFormat('es-AR')

export function fmtMoneda(valor: number | string | null | undefined, corta = false): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const n = typeof valor === 'string' ? Number(valor) : valor
  if (Number.isNaN(n)) return '—'
  return (corta ? monedaCorta : moneda).format(n)
}

export function fmtNumero(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : numero.format(valor)
}

/** Interpreta montos escritos en formato argentino: "1.500.000,50", "1500000.5", "$ 1.000". */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.replace(/[$\s]/g, '')
  if (!limpio) return null
  let normalizado: string
  if (limpio.includes(',')) {
    normalizado = limpio.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    normalizado = limpio.replace(/\./g, '')
  } else {
    normalizado = limpio
  }
  const n = Number(normalizado)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** Fecha/hora (ISO o Date) expresada en la zona horaria indicada. */
export function enZona(valor: string | Date, zona: string): TZDate {
  return new TZDate(typeof valor === 'string' ? new Date(valor) : valor, zona)
}

export function ahoraEn(zona: string): TZDate {
  return TZDate.tz(zona)
}

/** 'yyyy-MM-dd' de hoy en la zona. */
export function hoyISO(zona: string): string {
  return format(ahoraEn(zona), 'yyyy-MM-dd')
}

export function fmtFecha(valor: string | Date | null | undefined, zona: string): string {
  if (!valor) return '—'
  // Fechas puras ('yyyy-MM-dd') no tienen zona: se formatean tal cual.
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-')
    return `${d}/${m}/${a}`
  }
  return format(enZona(valor, zona), 'dd/MM/yyyy')
}

export function fmtHora(valor: string | Date | null | undefined, zona: string): string {
  if (!valor) return '—'
  return format(enZona(valor, zona), 'HH:mm')
}

export function fmtFechaHora(valor: string | Date | null | undefined, zona: string): string {
  if (!valor) return '—'
  return format(enZona(valor, zona), 'dd/MM/yyyy HH:mm')
}

/** "sáb 14/11 21:00 → dom 15/11 04:00" o "sáb 14/11/2026 · 21:00 a 04:00". */
export function fmtRango(inicio: string, fin: string, zona: string): string {
  const i = enZona(inicio, zona)
  const f = enZona(fin, zona)
  const horas = (fin: Date) => format(fin, 'HH:mm')
  const duracionHs = (f.getTime() - i.getTime()) / 36e5
  if (duracionHs <= 24) {
    return `${format(i, "EEE dd/MM/yyyy '·' HH:mm", { locale: es })} a ${horas(f)}`
  }
  return `${format(i, 'EEE dd/MM/yyyy HH:mm', { locale: es })} → ${format(f, 'EEE dd/MM/yyyy HH:mm', { locale: es })}`
}

export function fmtDiaLargo(fechaISO: string): string {
  const [a, m, d] = fechaISO.split('-').map(Number)
  return format(new Date(a!, m! - 1, d!), "EEEE d 'de' MMMM", { locale: es })
}

/** Convierte fecha local ('yyyy-MM-dd') + hora ('HH:mm') de la zona a ISO UTC. */
export function desdeLocal(fechaISO: string, hora: string, zona: string): string {
  const [a, m, d] = fechaISO.split('-').map(Number)
  const [h, mi] = hora.split(':').map(Number)
  // TZDate.toISOString() conserva el offset de la zona; se normaliza a UTC ('Z').
  return new Date(new TZDate(a!, m! - 1, d!, h ?? 0, mi ?? 0, 0, zona).getTime()).toISOString()
}

/** Descompone un ISO en fecha y hora locales de la zona. */
export function aLocal(valor: string, zona: string): { fecha: string; hora: string } {
  const z = enZona(valor, zona)
  return { fecha: format(z, 'yyyy-MM-dd'), hora: format(z, 'HH:mm') }
}

/** Parsea DD/MM/AAAA → 'yyyy-MM-dd' validando la fecha. */
export function parsearFechaAR(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim())
  if (!m) return null
  const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3])
  const fecha = new Date(a, mes - 1, d)
  if (fecha.getFullYear() !== a || fecha.getMonth() !== mes - 1 || fecha.getDate() !== d) return null
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function sumarDiasISO(fechaISO: string, dias: number): string {
  const [a, m, d] = fechaISO.split('-').map(Number)
  return format(addDays(new Date(a!, m! - 1, d!), dias), 'yyyy-MM-dd')
}

/** Inicio del día local (en la zona) como Date absoluto. */
export function inicioDiaEn(fechaISO: string, zona: string): Date {
  return new Date(desdeLocal(fechaISO, '00:00', zona))
}

export function fechaDeISO(fechaISO: string): Date {
  const [a, m, d] = fechaISO.split('-').map(Number)
  return startOfDay(new Date(a!, m! - 1, d!))
}

export function aFechaISO(fecha: Date): string {
  return format(fecha, 'yyyy-MM-dd')
}

export function tiempoRelativo(valor: string, zona: string): string {
  const ms = new Date(valor).getTime() - Date.now()
  const abs = Math.abs(ms)
  const futuro = ms > 0
  const min = Math.round(abs / 6e4)
  if (min < 60) return futuro ? `en ${min} min` : `hace ${min} min`
  const hs = Math.round(min / 60)
  if (hs < 48) return futuro ? `en ${hs} h` : `hace ${hs} h`
  return fmtFecha(valor, zona)
}
