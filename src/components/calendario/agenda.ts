// Carga y armado de la agenda para las vistas del calendario. Trabaja con
// fechas locales de la organización ('yyyy-MM-dd') y convierte a UTC solo para
// consultar la base.
import type { EstadoReserva } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { desdeLocal, enZona, sumarDiasISO } from '@/lib/formato'
import { format } from 'date-fns'

export interface ItemAgenda {
  clave: string
  tipo: 'reserva' | 'bloqueo' | 'feriado' | 'entrevista'
  id: string
  titulo: string
  estado?: EstadoReserva
  inicio: string
  fin: string
  /** Ocupación real con montaje/limpieza (solo reservas). */
  ocupaInicio?: string
  ocupaFin?: string
  espacioIds: string[]
  numero?: number
  invitados?: number | null
  cliente?: string | null
  motivo?: string | null
  tipoBloqueo?: string
}

export interface Columna { clave: string; etiqueta: string; sub?: string; dia: string; espacioId?: string; color?: string }

export interface FiltrosAgenda {
  sucursalId?: string
  espacioIds?: string[]
  estados?: EstadoReserva[]
  incluirCanceladas?: boolean
}

export async function cargarAgenda(orgId: string, desde: string, hasta: string, zona: string, filtros: FiltrosAgenda = {}): Promise<ItemAgenda[]> {
  const ini = desdeLocal(desde, '00:00', zona)
  const fin = desdeLocal(sumarDiasISO(hasta, 1), '00:00', zona)

  // Reservas, bloqueos, feriados y entrevistas del rango en una sola llamada.
  const { reservas, bloqueos, feriados, entrevistas } = await api.get<{
    reservas: Array<{ id: string; numero: number; titulo: string; estado: EstadoReserva; inicio: string; fin: string; invitados: number | null
      sucursal_id: string; clientes: { nombre: string } | null; reserva_espacios: Array<{ espacio_id: string; antes_min: number; despues_min: number }> }>
    bloqueos: Array<{ id: string; espacio_id: string; inicio: string; fin: string; tipo: string; motivo: string | null }>
    feriados: Array<{ id: string; fecha: string; nombre: string }>
    entrevistas: Array<{ id: string; inicio: string; duracion_min: number; estado: string; contacto_nombre: string | null; modalidad: string
      sucursal_id: string | null; clientes: { nombre: string } | null }>
  }>(rutaOrg(orgId, 'agenda'), { inicio: ini, fin, desde, hasta, sucursal: filtros.sucursalId, canceladas: filtros.incluirCanceladas ?? false })

  const items: ItemAgenda[] = []
  for (const r of reservas) {
    const espacios = r.reserva_espacios
    const antes = Math.max(0, ...espacios.map((e) => e.antes_min))
    const despues = Math.max(0, ...espacios.map((e) => e.despues_min))
    items.push({
      clave: `r-${r.id}`, tipo: 'reserva', id: r.id, titulo: r.titulo, estado: r.estado, numero: r.numero,
      inicio: r.inicio, fin: r.fin, invitados: r.invitados,
      ocupaInicio: new Date(new Date(r.inicio).getTime() - antes * 6e4).toISOString(),
      ocupaFin: new Date(new Date(r.fin).getTime() + despues * 6e4).toISOString(),
      espacioIds: espacios.map((e) => e.espacio_id),
      cliente: (r.clientes as { nombre: string } | null)?.nombre ?? null,
    })
  }
  for (const b of bloqueos) {
    items.push({
      clave: `b-${b.id}`, tipo: 'bloqueo', id: b.id, titulo: b.motivo || 'Bloqueo', inicio: b.inicio, fin: b.fin,
      espacioIds: [b.espacio_id], motivo: b.motivo, tipoBloqueo: b.tipo,
    })
  }
  for (const f of feriados) {
    items.push({
      clave: `f-${f.id}`, tipo: 'feriado', id: f.id, titulo: f.nombre,
      inicio: desdeLocal(f.fecha, '00:00', zona), fin: desdeLocal(sumarDiasISO(f.fecha, 1), '00:00', zona), espacioIds: [],
    })
  }

  // Las entrevistas no ocupan espacios; si el rol no puede verlas, la consulta viene vacía.
  for (const e of entrevistas) {
    if (filtros.sucursalId && e.sucursal_id && e.sucursal_id !== filtros.sucursalId) continue
    const nombre = e.clientes?.nombre ?? e.contacto_nombre ?? ''
    items.push({
      clave: `e-${e.id}`, tipo: 'entrevista', id: e.id, titulo: `Entrevista · ${nombre}`, inicio: e.inicio,
      fin: new Date(new Date(e.inicio).getTime() + e.duracion_min * 6e4).toISOString(), espacioIds: [], motivo: e.estado,
    })
  }

  return items.filter((i) => {
    if (i.tipo === 'feriado' || i.tipo === 'entrevista') return !(i.tipo === 'entrevista' && filtros.estados?.length)
    if (filtros.espacioIds?.length && !i.espacioIds.some((e) => filtros.espacioIds!.includes(e))) return false
    if (i.tipo === 'reserva' && filtros.estados?.length && !filtros.estados.includes(i.estado!)) return false
    return true
  })
}

/**
 * Días locales ('yyyy-MM-dd') que toca un item. Con `ignorarMadrugada`, un
 * evento nocturno que termina antes del mediodía no cuenta para el día
 * siguiente (misma regla que public.ocupa_dia en la base).
 */
export function diasDelItem(item: ItemAgenda, zona: string, ignorarMadrugada = false): string[] {
  const ini = format(enZona(item.inicio, zona), 'yyyy-MM-dd')
  // un evento que termina exactamente a medianoche no ocupa el día siguiente
  const finExclusivo = new Date(new Date(item.fin).getTime() - 1)
  const fin = format(enZona(finExclusivo, zona), 'yyyy-MM-dd')
  const dias: string[] = []
  for (let d = ini; d <= fin && dias.length < 400; d = sumarDiasISO(d, 1)) dias.push(d)
  if (!ignorarMadrugada) return dias
  return dias.filter((d) => d === ini || minutosEnDia(item.fin, d, zona) > 12 * 60)
}

/** Minutos desde la medianoche local del día indicado (puede ser <0 o >1440). */
export function minutosEnDia(valor: string, diaISO: string, zona: string): number {
  return (new Date(valor).getTime() - new Date(desdeLocal(diaISO, '00:00', zona)).getTime()) / 6e4
}
