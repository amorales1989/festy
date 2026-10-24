// Arma el comprobante de un cobro a partir de su id (trae evento, cliente y cobros previos).
import type { Fila } from './supabase'
import { api } from './api'
import { aLocal } from './formato'
import { CONCEPTOS_PAGO, MEDIOS_PAGO } from './catalogos'
import { crearPdfComprobante, emisorDe, numeroDoc, type Emisor } from './documentos'

export async function comprobanteDePago(pagoId: string, organizacion: Parameters<typeof emisorDe>[0]) {
  // El comprobante trae el pago, su evento y lo cobrado hasta este recibo (calculado en la base).
  const p = await api.get<Fila<'pagos'> & {
    reservas: { numero: number; titulo: string; inicio: string; precio_total: number; clientes: { nombre: string; telefono: string | null } | null }
    pagado_hasta_este: number
    registrado_por_nombre: string | null
  }>(`/pagos/${pagoId}/comprobante`)
  const r = p.reservas
  const emisor: Emisor = emisorDe(organizacion)
  const doc = await crearPdfComprobante(emisor, {
    numero: p.numero_comprobante, fecha: p.fecha, monto: Number(p.monto), concepto: CONCEPTOS_PAGO[p.concepto] ?? p.concepto,
    medio: MEDIOS_PAGO[p.medio] ?? p.medio, referencia: p.referencia, anulado: p.anulado, anulado_motivo: p.anulado_motivo,
    cliente: { nombre: r.clientes?.nombre ?? '' }, evento: { numero: r.numero, titulo: r.titulo, fecha: aLocal(r.inicio, emisor.zona_horaria).fecha },
    total_evento: Number(r.precio_total), pagado_hasta_este: Number(p.pagado_hasta_este), registrado_por: p.registrado_por_nombre,
  })
  return { doc, archivo: `comprobante-${numeroDoc(p.numero_comprobante, 8)}.pdf`, telefono: r.clientes?.telefono ?? null, cliente: r.clientes?.nombre ?? '', titulo: r.titulo }
}
