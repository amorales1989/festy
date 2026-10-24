<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Ban, CircleCheck, Download, History, MessageCircle, Package, Receipt, Pencil, Plus, ShieldCheck, Trash2, Users, Wallet } from 'lucide-vue-next'
import InsigniaEstado from '@/components/ui/InsigniaEstado.vue'
import Cargando from '@/components/ui/Cargando.vue'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import type { EstadoContrato, EstadoReserva, Fila } from '@/lib/supabase'
import { api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { aLocal, fmtFecha, fmtFechaHora, fmtMoneda, fmtRango, hoyISO, sumarDiasISO } from '@/lib/formato'
import { crearPdfComprobante, crearPdfGarantia, emisorDe, numeroDoc } from '@/lib/documentos'
import { enviarPorWhatsApp, guardarPDF } from '@/lib/compartir'
import { CONCEPTOS_PAGO, ESTADOS_CONTRATO, ESTADOS_RESERVA, MEDIOS_PAGO, TIPOS_EVENTO, UNIDADES_SERVICIO } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

type Reserva = Fila<'reservas'> & {
  clientes: Pick<Fila<'clientes'>, 'id' | 'nombre' | 'telefono' | 'email'> | null
  sucursales: { nombre: string } | null
  reserva_espacios: Array<{ antes_min: number; despues_min: number; espacios: { id: string; nombre: string; color: string; capacidad_maxima: number } | null }>
}
interface Cuota { id: string; concepto: string; vencimiento: string; monto: number; pendiente: number }

const route = useRoute()
const router = useRouter()
const org = useOrganizacion()
const acciones = useAcciones()
const { confirmar, pedirTexto } = useConfirmar()
const { exito, info, error: notificarError } = useNotificaciones()
const id = computed(() => String(route.params.id))

const reserva = ref<Reserva | null>(null)
type Pago = Fila<'pagos'> & { registrado_por_nombre: string | null }
const pagos = ref<Pago[]>([])
const cuotas = ref<Cuota[]>([])
const saldo = ref<{ pagado: number; saldo: number; vencido: number } | null>(null)
const tareas = ref<Fila<'tareas'>[]>([])
interface EventoHistorial { id: number; accion: string; creado_at: string; cambios: unknown }
const historial = ref<EventoHistorial[]>([])
const responsable = ref('')
const cargando = ref(true)
const error = ref('')

async function cargar() {
  error.value = ''
  try {
    // Toda la ficha en una llamada; lo que el rol no puede ver llega vacío (RLS).
    const f = await api.get<{
      reserva: Reserva & { reserva_items: Fila<'reserva_items'>[] }
      responsable: { nombre: string | null; email: string } | null
      pagos: Pago[]
      cuotas: Array<{ id: string; concepto: string; vencimiento: string; monto: number; pendiente: number }>
      saldo: { pagado: number; saldo: number; vencido: number } | null
      tareas: Fila<'tareas'>[]
      historial: EventoHistorial[]
      garantia: Garantia | null
    }>(`/reservas/${id.value}/ficha`)
    reserva.value = f.reserva
    pagos.value = f.pagos
    items.value = f.reserva.reserva_items
    garantia.value = f.garantia
    cuotas.value = f.cuotas.map((x) => ({ id: x.id, concepto: x.concepto, vencimiento: x.vencimiento, monto: Number(x.monto), pendiente: Number(x.pendiente) }))
    saldo.value = f.saldo ? { pagado: Number(f.saldo.pagado), saldo: Number(f.saldo.saldo), vencido: Number(f.saldo.vencido) } : null
    tareas.value = f.tareas
    historial.value = f.historial
    responsable.value = f.responsable ? (f.responsable.nombre || f.responsable.email) : ''
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)
watch(() => acciones.version, cargar)
watch(id, () => { cargando.value = true; void cargar() })

const hoy = computed(() => hoyISO(org.zona))
const capacidad = computed(() => reserva.value?.reserva_espacios.reduce((s, e) => s + (e.espacios?.capacidad_maxima ?? 0), 0) ?? 0)
const pagado = computed(() => pagos.value.filter((p) => !p.anulado).reduce((s, p) => s + Number(p.monto), 0))
const totalCuotas = computed(() => cuotas.value.reduce((s, c) => s + c.monto, 0))

// --- Estado y contrato ----------------------------------------------------
async function cambiarEstado(estado: EstadoReserva) {
  if (!reserva.value) return
  let motivo: string | null = null
  if (estado === 'cancelada') {
    motivo = await pedirTexto({
      titulo: 'Cancelar reserva', peligro: true, confirmar: 'Cancelar reserva', etiquetaTexto: 'Motivo de la cancelación',
      mensaje: 'La fecha se libera para otros eventos. Los cobros registrados se mantienen.',
    })
    if (!motivo) return
  } else {
    const ok = await confirmar({ titulo: `Pasar a ${ESTADOS_RESERVA[estado].etiqueta.toLowerCase()}`, mensaje: ESTADOS_RESERVA[estado].ayuda, confirmar: 'Confirmar' })
    if (!ok) return
  }
  try {
    await api.patch(`/reservas/${reserva.value.id}/estado`, { estado, motivo })
    exito(`Reserva ${ESTADOS_RESERVA[estado].etiqueta.toLowerCase()}.`)
    acciones.cambiosGuardados()
  } catch (e) {
    notificarError(e)
  }
}
async function cambiarContrato(e: Event) {
  const valor = (e.target as HTMLSelectElement).value as EstadoContrato
  try {
    await api.patch(`/reservas/${id.value}/contrato`, { estado: valor })
    exito('Estado del contrato actualizado.')
    void cargar()
  } catch (err) {
    notificarError(err)
    void cargar()
  }
}
async function eliminar() {
  const ok = await confirmar({
    titulo: 'Eliminar reserva', peligro: true, confirmar: 'Eliminar definitivamente', textoRequerido: `#${reserva.value?.numero}`,
    mensaje: 'Se borra la reserva con su plan de cuotas y tareas. Si tiene cobros registrados no se puede eliminar: cancelala.\nEsta acción no se puede deshacer.',
  })
  if (!ok) return
  try {
    await eliminarRegistro('reservas', id.value)
    exito('Reserva eliminada.')
    acciones.cambiosGuardados()
    await router.replace({ name: 'reservas' })
  } catch (e) {
    notificarError(e)
  }
}

// --- Cobros ---------------------------------------------------------------
const pagoAbierto = ref(false)
const pago = reactive({ monto: null as number | null, fecha: '', medio: 'transferencia', concepto: 'cuota', referencia: '', notas: '' })
const guardandoPago = ref(false)
const errorPago = ref('')
function abrirPago() {
  Object.assign(pago, { monto: null, fecha: hoy.value, medio: 'transferencia', referencia: '', notas: '',
    concepto: ['consulta', 'tentativa'].includes(reserva.value?.estado ?? '') ? 'sena' : 'cuota' })
  const proxima = cuotas.value.find((c) => c.pendiente > 0)
  if (proxima) pago.monto = proxima.pendiente
  errorPago.value = ''
  pagoAbierto.value = true
}
async function registrarPago() {
  errorPago.value = ''
  if (!pago.monto || pago.monto <= 0) { errorPago.value = 'Ingresá un monto mayor a 0.'; return }
  if (!pago.fecha) { errorPago.value = 'Ingresá la fecha del cobro.'; return }
  guardandoPago.value = true
  try {
    const { id: pagoId } = await api.post<{ id: string }>(`/reservas/${id.value}/pagos`, {
      monto: pago.monto, fecha: pago.fecha, medio: pago.medio, concepto: pago.concepto, referencia: pago.referencia, notas: pago.notas,
    })
    pagoAbierto.value = false
    acciones.cambiosGuardados()
    await cargar()
    pagoRecien.value = pagos.value.find((x) => x.id === pagoId) ?? null
  } catch (e) {
    errorPago.value = traducirError(e)
  } finally {
    guardandoPago.value = false
  }
}
// --- Comprobantes ----------------------------------------------------------------
const pagoRecien = ref<Pago | null>(null)
const pagoRecienAbierto = computed({ get: () => !!pagoRecien.value, set: (v) => { if (!v) pagoRecien.value = null } })
async function armarComprobante(p: Pago) {
  const r = reserva.value!
  const pagadoHasta = pagos.value.filter((x) => !x.anulado && x.numero_comprobante <= p.numero_comprobante).reduce((t, x) => t + Number(x.monto), 0)
  const doc = await crearPdfComprobante(emisorDe(org.actual!), {
    numero: p.numero_comprobante, fecha: p.fecha, monto: Number(p.monto), concepto: CONCEPTOS_PAGO[p.concepto] ?? p.concepto,
    medio: MEDIOS_PAGO[p.medio] ?? p.medio, referencia: p.referencia, anulado: p.anulado, anulado_motivo: p.anulado_motivo,
    cliente: { nombre: r.clientes?.nombre ?? '' },
    evento: { numero: r.numero, titulo: r.titulo, fecha: aLocal(r.inicio, org.zona).fecha },
    total_evento: Number(r.precio_total), pagado_hasta_este: pagadoHasta, registrado_por: p.registrado_por_nombre,
  })
  return { doc, archivo: `comprobante-${numeroDoc(p.numero_comprobante, 8)}.pdf` }
}
async function descargarComprobante(p: Pago) {
  try { const { doc, archivo } = await armarComprobante(p); await guardarPDF(doc, archivo, `Comprobante N° ${numeroDoc(p.numero_comprobante, 8)}`) } catch (e) { notificarError(e) }
}
async function enviarComprobante(p: Pago) {
  try {
    const { doc, archivo } = await armarComprobante(p)
    const r = reserva.value!
    const mensaje = `Hola ${(r.clientes?.nombre ?? '').split(' ')[0]}! Te envío el comprobante N° ${numeroDoc(p.numero_comprobante, 8)} por ${fmtMoneda(p.monto)} ` +
      `(${(CONCEPTOS_PAGO[p.concepto] ?? '').toLowerCase()} de ${r.titulo}). ¡Gracias! ${org.actual?.nombre ?? ''}`
    const res = await enviarPorWhatsApp(doc, archivo, mensaje, r.clientes?.telefono)
    if (res === 'descargado') info('Descargamos el comprobante y abrimos WhatsApp: adjuntalo en el chat.')
  } catch (e) { notificarError(e) }
}

async function anularPago(p: Pago) {
  const motivo = await pedirTexto({
    titulo: 'Anular cobro', peligro: true, confirmar: 'Anular cobro', etiquetaTexto: 'Motivo de la anulación',
    mensaje: `El cobro de ${fmtMoneda(p.monto)} del ${fmtFecha(p.fecha, org.zona)} queda anulado (no se borra) y deja de sumar al saldo.`,
  })
  if (!motivo) return
  try {
    await api.patch(`/pagos/${p.id}/anular`, { motivo })
    exito('Cobro anulado.')
    void cargar()
  } catch (e) {
    notificarError(e)
  }
}

// Plan de cuotas
const planAbierto = ref(false)
const plan = reactive({ senaPct: 30, cuotas: 2, primera: '', cada: 30 })
const verCuotaNueva = ref(false)
const cuotaNueva = reactive({ concepto: '', vencimiento: '', monto: null as number | null })
async function agregarCuota() {
  if (!cuotaNueva.vencimiento || !cuotaNueva.monto) { notificarError('Completá vencimiento y monto.'); return }
  try {
    await api.post(rutaOrg(org.id, `reservas/${id.value}/cuotas`), { concepto: cuotaNueva.concepto || 'Cuota', vencimiento: cuotaNueva.vencimiento, monto: cuotaNueva.monto })
    Object.assign(cuotaNueva, { concepto: '', vencimiento: '', monto: null })
    void cargar()
  } catch (e) { notificarError(e) }
}
async function generarPlan() {
  const total = Number(reserva.value?.precio_total ?? 0)
  if (total <= 0) { notificarError('Primero cargá el precio total de la reserva.'); return }
  if (!plan.primera) { notificarError('Indicá el vencimiento de la primera cuota.'); return }
  const sena = Math.round(total * plan.senaPct) / 100
  const resto = total - sena
  const monto = Math.floor((resto / plan.cuotas) * 100) / 100
  const filas = [{ concepto: 'Seña', vencimiento: hoy.value, monto: sena }]
  for (let i = 0; i < plan.cuotas; i++) {
    filas.push({ concepto: i === plan.cuotas - 1 ? 'Saldo' : `Cuota ${i + 1}`, vencimiento: sumarDiasISO(plan.primera, i * plan.cada),
      monto: i === plan.cuotas - 1 ? Math.round((resto - monto * (plan.cuotas - 1)) * 100) / 100 : monto })
  }
  try {
    if (cuotas.value.length) {
      const ok = await confirmar({ titulo: 'Reemplazar plan', mensaje: 'Se reemplazan las cuotas actuales. Los cobros registrados se mantienen.', confirmar: 'Reemplazar' })
      if (!ok) return
    }
    // Reemplaza el plan completo en una transacción (borra las cuotas anteriores).
    await api.put(rutaOrg(org.id, `reservas/${id.value}/cuotas`), { cuotas: filas })
    exito('Plan de pagos generado.')
    planAbierto.value = false
    void cargar()
  } catch (e) { notificarError(e) }
}
async function borrarCuota(c: Cuota) {
  try {
    await eliminarRegistro('cuotas', c.id)
    void cargar()
  } catch (e) { notificarError(e) }
}

// --- Tareas ---------------------------------------------------------------
const tareaNueva = reactive({ titulo: '', vence_el: '' })
async function agregarTarea() {
  if (tareaNueva.titulo.trim().length < 2) return
  try {
    await api.post(rutaOrg(org.id, 'tareas'), { reserva_id: id.value, titulo: tareaNueva.titulo.trim(), vence_el: tareaNueva.vence_el })
    Object.assign(tareaNueva, { titulo: '', vence_el: '' })
    void cargar()
  } catch (e) { notificarError(e) }
}
async function alternarTarea(t: Fila<'tareas'>) {
  try {
    await api.patch(`/tareas/${t.id}/estado`, { estado: t.estado === 'hecha' ? 'pendiente' : 'hecha' })
    void cargar()
  } catch (e) { notificarError(e) }
}

// "Próximo paso": una sola indicación clara de qué falta, con el botón para hacerlo.
interface Paso { tono: 'info' | 'aviso' | 'peligro' | 'ok'; titulo: string; detalle?: string; acciones: Array<{ etiqueta: string; hacer: () => void; primaria?: boolean }> }
// --- Servicios contratados y adicionales --------------------------------------------
const items = ref<Fila<'reserva_items'>[]>([])
const catalogo = ref<Fila<'servicios'>[]>([])
const adicionalAbierto = ref(false)
const adic = reactive({ servicio_id: null as string | null, descripcion: '', cantidad: 1, unidad: 'evento', precio: null as number | null, crear_cuota: true, vencimiento: '' })
const errorAdic = ref('')
async function abrirAdicional() {
  if (!catalogo.value.length) {
    const data = await api.get<Fila<'servicios'>[]>(rutaOrg(org.id, 'servicios'), { activos: true })
    catalogo.value = data.sort((a, b) => Number(b.tipo === 'adicional') - Number(a.tipo === 'adicional'))
  }
  const r = reserva.value!
  Object.assign(adic, { servicio_id: null, descripcion: '', cantidad: 1, unidad: 'evento', precio: null, crear_cuota: org.puede('pagos.registrar'),
    vencimiento: (() => { const f = sumarDiasISO(aLocal(r.inicio, org.zona).fecha, -7); return f > hoy.value ? f : hoy.value })() })
  errorAdic.value = ''
  adicionalAbierto.value = true
}
function elegirServicio(sv: Fila<'servicios'>) {
  // Con personas incluidas, las de más se suman al precio de la misma línea.
  const exceso = sv.personas_incluidas ? Math.max((reserva.value?.invitados ?? 0) - sv.personas_incluidas, 0) : 0
  Object.assign(adic, { servicio_id: sv.id, descripcion: exceso ? `${sv.nombre} (+${exceso} personas extra)` : sv.nombre, unidad: sv.unidad,
    precio: Number(sv.precio) + exceso * Number(sv.precio_persona_extra), cantidad: sv.unidad === 'persona' ? (reserva.value?.invitados ?? 1) : 1 })
}
async function guardarAdicional() {
  errorAdic.value = ''
  if (adic.descripcion.trim().length < 2 || !(adic.cantidad > 0) || adic.precio === null) { errorAdic.value = 'Completá qué es, la cantidad y el precio.'; return }
  if (!items.value.length && Number(reserva.value?.precio_total) > 0) {
    const ok = await confirmar({ titulo: 'Detallar servicios', confirmar: 'Continuar',
      mensaje: `Este evento tiene un total cargado a mano (${fmtMoneda(reserva.value!.precio_total)}). Al agregar servicios, el total pasa a ser la suma de los servicios: cargá también lo que ya estaba incluido.` })
    if (!ok) return
  }
  try {
    await api.post(`/reservas/${id.value}/items`, {
      descripcion: adic.descripcion.trim(), cantidad: adic.cantidad, unidad: adic.unidad, precio: adic.precio,
      servicio_id: adic.servicio_id, es_adicional: items.value.length > 0,
      crear_cuota: adic.crear_cuota && org.puede('pagos.registrar'), vencimiento: adic.vencimiento,
    })
    exito(adic.crear_cuota ? 'Servicio agregado con su cuota.' : 'Servicio agregado.')
    adicionalAbierto.value = false
    void cargar()
  } catch (e) { errorAdic.value = traducirError(e) }
}
async function quitarItem(i: Fila<'reserva_items'>) {
  const ok = await confirmar({ titulo: 'Quitar servicio', confirmar: 'Quitar', peligro: true,
    mensaje: `Se quita “${i.descripcion}” y el total baja ${fmtMoneda(Number(i.cantidad) * Number(i.precio_unitario))}. Si tenía una cuota, revisá el plan de cuotas.` })
  if (!ok) return
  try { await eliminarRegistro('reserva_items', i.id); void cargar() } catch (e) { notificarError(e) }
}

// --- Depósito de garantía --------------------------------------------------------
type Garantia = Fila<'garantias'> & { cobrada_por_nombre: string | null; devuelta_por_nombre: string | null }
const garantia = ref<Garantia | null>(null)
const eventoTermino = computed(() => !!reserva.value && new Date(reserva.value.fin) < new Date())
const garantiaSugerida = computed(() => Math.max(0, ...(reserva.value?.reserva_espacios ?? []).map((e) => Number(org.espacios.find((x) => x.id === e.espacios?.id)?.garantia_sugerida ?? 0))))
const garModo = ref<'pedir' | 'cobrar' | 'devolver' | null>(null)
const garAbierto = computed({ get: () => !!garModo.value, set: (v) => { if (!v) garModo.value = null } })
const gar = reactive({ monto: null as number | null, fecha: '', medio: 'transferencia', referencia: '', completa: true, devuelto: null as number | null, motivo: '' })
const errorGar = ref('')
function abrirGarantia(modo: 'pedir' | 'cobrar' | 'devolver') {
  Object.assign(gar, { monto: garantia.value ? Number(garantia.value.monto) : (garantiaSugerida.value || null), fecha: hoy.value, medio: 'transferencia',
    referencia: '', completa: true, devuelto: garantia.value ? Number(garantia.value.monto) : null, motivo: '' })
  errorGar.value = ''
  garModo.value = modo
}
async function confirmarGarantia() {
  errorGar.value = ''
  try {
    if (garModo.value === 'pedir') {
      if (!gar.monto || gar.monto <= 0) { errorGar.value = 'Ingresá el monto.'; return }
      await api.put(`/reservas/${id.value}/garantia`, { monto: gar.monto })
      exito('Garantía pedida.')
    } else if (garModo.value === 'cobrar') {
      await api.post(`/reservas/${id.value}/garantia/cobro`, { fecha: gar.fecha, medio: gar.medio, referencia: gar.referencia })
      exito('Garantía cobrada. Descargá o enviá el recibo.')
    } else {
      const devuelto = gar.completa ? Number(garantia.value!.monto) : (gar.devuelto ?? 0)
      await api.post(`/reservas/${id.value}/garantia/devolucion`, { fecha: gar.fecha, monto_devuelto: devuelto, medio: gar.medio,
        motivo: gar.completa ? null : gar.motivo })
      exito('Devolución registrada.')
    }
    garModo.value = null
    await cargar()
  } catch (e) { errorGar.value = traducirError(e) }
}
async function quitarGarantia() {
  if (!(await confirmar({ titulo: 'Quitar garantía', mensaje: 'Este evento ya no pedirá depósito de garantía.', confirmar: 'Quitar' }))) return
  try { await api.delete(`/reservas/${id.value}/garantia`); void cargar() } catch (e) { notificarError(e) }
}
async function documentoGarantia(tipo: 'recibo' | 'devolucion', enviar = false) {
  const g = garantia.value!, r = reserva.value!
  try {
    const numero = tipo === 'recibo' ? g.numero_recibo! : g.numero_devolucion!
    const doc = await crearPdfGarantia(emisorDe(org.actual!), {
      tipo, numero, fecha: tipo === 'recibo' ? g.cobro_fecha! : g.devolucion_fecha!, monto: Number(g.monto),
      medio: MEDIOS_PAGO[(tipo === 'recibo' ? g.cobro_medio : g.devolucion_medio) ?? ''] ?? null, referencia: g.cobro_referencia,
      devuelto: Number(g.devolucion_monto ?? 0), motivo_retencion: g.motivo_retencion, dias_devolucion: org.actual?.dias_devolucion_garantia ?? 7,
      cliente: { nombre: r.clientes?.nombre ?? '' }, evento: { numero: r.numero, titulo: r.titulo, fecha: aLocal(r.inicio, org.zona).fecha },
      registrado_por: (tipo === 'recibo' ? g.cobrada_por_nombre : g.devuelta_por_nombre) ?? null,
    })
    const archivo = `${tipo === 'recibo' ? 'recibo-garantia' : 'devolucion-garantia'}-${numeroDoc(numero, 8)}.pdf`
    if (!enviar) { await guardarPDF(doc, archivo, 'Garantía'); return }
    const nombre = (r.clientes?.nombre ?? '').split(' ')[0]
    const texto = tipo === 'recibo'
      ? `Hola ${nombre}! Te envío el recibo de la garantía de ${r.titulo} por ${fmtMoneda(g.monto)}. Se devuelve después del evento si no hay daños. ${org.actual?.nombre ?? ''}`
      : `Hola ${nombre}! Te envío la constancia de devolución de la garantía de ${r.titulo}. ¡Gracias por elegirnos! ${org.actual?.nombre ?? ''}`
    const res = await enviarPorWhatsApp(doc, archivo, texto, r.clientes?.telefono)
    if (res === 'descargado') info('Descargamos el PDF y abrimos WhatsApp: adjuntalo en el chat.')
  } catch (e) { notificarError(e) }
}
const ESTADOS_GARANTIA: Record<string, { etiqueta: string; clase: string }> = {
  pendiente: { etiqueta: 'Falta cobrarla', clase: 'bg-amber-50 text-amber-800 ring-amber-200' },
  cobrada: { etiqueta: 'En custodia', clase: 'bg-sky-50 text-sky-800 ring-sky-200' },
  devuelta: { etiqueta: 'Devuelta', clase: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  retenida: { etiqueta: 'Devuelta con retención', clase: 'bg-rose-50 text-rose-700 ring-rose-200' },
}

const proximoPaso = computed<Paso | null>(() => {
  const r = reserva.value
  if (!r) return null
  const cobrar = org.puede('pagos.registrar')
  const editar = org.puede('reservas.editar')
  const pagar = { etiqueta: 'Registrar cobro', hacer: abrirPago, primaria: true }
  const sena = { etiqueta: 'Registrar seña', hacer: abrirPago, primaria: true }
  const s = saldo.value
  if (r.estado === 'cancelada') return null
  const g = garantia.value
  if (g?.estado === 'cobrada' && eventoTermino.value) {
    return { tono: 'aviso', titulo: `Devolver la garantía (${fmtMoneda(g.monto)})`,
      detalle: `El evento terminó. Revisá que no haya daños y devolvela dentro de los ${org.actual?.dias_devolucion_garantia ?? 7} días.`,
      acciones: cobrar ? [{ etiqueta: 'Registrar devolución', hacer: () => abrirGarantia('devolver'), primaria: true }] : [] }
  }
  if (r.estado === 'finalizada') {
    return s && s.saldo > 0 ? { tono: 'aviso', titulo: `Quedaron ${fmtMoneda(s.saldo)} sin cobrar`, acciones: cobrar ? [pagar] : [] } : null
  }
  if (r.estado === 'consulta') {
    return { tono: 'info', titulo: 'Es una consulta: la fecha todavía no está reservada',
      detalle: 'Podés guardarle la fecha unos días mientras decide, o registrar la seña si ya pagó.',
      acciones: [...(org.puede('presupuestos.gestionar') ? [{ etiqueta: 'Hacer presupuesto', hacer: hacerPresupuesto, primaria: true }] : []),
        ...(cobrar ? [{ ...sena, primaria: !org.puede('presupuestos.gestionar') }] : []),
        ...(editar ? [{ etiqueta: 'Guardarle la fecha', hacer: () => cambiarEstado('tentativa') }] : [])] }
  }
  if (r.estado === 'tentativa') {
    return { tono: 'aviso', titulo: 'Fecha retenida: falta la seña',
      detalle: r.vence_tentativa_at ? `Si no paga, la fecha se libera sola el ${fmtFechaHora(r.vence_tentativa_at, org.zona)}.` : undefined,
      acciones: [...(cobrar ? [sena] : []), ...(editar ? [{ etiqueta: 'Confirmar sin seña', hacer: () => cambiarEstado('confirmada') }] : [])] }
  }
  if (s && s.vencido > 0) {
    return { tono: 'peligro', titulo: `Tiene ${fmtMoneda(s.vencido)} atrasados`, detalle: 'Hay cuotas vencidas sin pagar.', acciones: cobrar ? [pagar] : [] }
  }
  if ((r.contrato_estado === 'pendiente' || r.contrato_estado === 'enviado') && org.puede('contratos.gestionar')) {
    return { tono: 'aviso', titulo: r.contrato_estado === 'enviado' ? 'El contrato se envió pero no está firmado' : 'Falta firmar el contrato',
      acciones: [{ etiqueta: 'Marcar como firmado', hacer: () => marcarContrato('firmado'), primaria: true },
        ...(r.contrato_estado === 'pendiente' ? [{ etiqueta: 'Ya lo envié', hacer: () => marcarContrato('enviado') }] : [])] }
  }
  if (g?.estado === 'pendiente' && !eventoTermino.value) {
    return { tono: 'aviso', titulo: `Falta cobrar la garantía (${fmtMoneda(g.monto)})`, detalle: 'Es un depósito reintegrable: se devuelve después del evento si no hay daños.',
      acciones: cobrar ? [{ etiqueta: 'Cobrar garantía', hacer: () => abrirGarantia('cobrar'), primaria: true }] : [] }
  }
  if (r.estado === 'senada' && editar) {
    return { tono: 'info', titulo: 'Pagó la seña', detalle: 'Cuando esté todo acordado, confirmá el evento.',
      acciones: [{ etiqueta: 'Confirmar evento', hacer: () => cambiarEstado('confirmada'), primaria: true }] }
  }
  if (s && s.saldo > 0) {
    return { tono: 'info', titulo: `Resta cobrar ${fmtMoneda(s.saldo)}`, detalle: cuotas.value.length ? undefined : 'Podés armar un plan de pagos en la sección Cobros.', acciones: cobrar ? [pagar] : [] }
  }
  return { tono: 'ok', titulo: 'Todo en orden', detalle: 'Está confirmado, pagado y con el contrato firmado.', acciones: [] }
})
function hacerPresupuesto() {
  void router.push({ name: 'presupuesto-nuevo', query: { reserva: id.value } })
}
async function marcarContrato(valor: EstadoContrato) {
  try {
    await api.patch(`/reservas/${id.value}/contrato`, { estado: valor })
    exito(valor === 'firmado' ? 'Contrato marcado como firmado.' : 'Contrato marcado como enviado.')
    void cargar()
  } catch (e) { notificarError(e) }
}
const TONOS = {
  info: 'bg-sky-50 ring-sky-200 text-sky-900', aviso: 'bg-amber-50 ring-amber-200 text-amber-900',
  peligro: 'bg-rose-50 ring-rose-200 text-rose-900', ok: 'bg-emerald-50 ring-emerald-200 text-emerald-900',
}
const historialVisible = computed(() => historial.value.filter((h) => h.accion !== 'cambio' || describirCambio(h.cambios) !== ''))
function describirCambio(cambios: unknown): string {
  const c = cambios as Record<string, { antes: unknown; despues: unknown }>
  const nombres: Record<string, string> = { estado: 'Estado', inicio: 'Inicio', fin: 'Fin', invitados: 'Invitados', precio_total: 'Precio', contrato_estado: 'Contrato', titulo: 'Título', notas: 'Notas', responsable_id: 'Responsable', cliente_id: 'Cliente' }
  return Object.keys(c).filter((k) => nombres[k]).map((k) => {
    const v = c[k]!
    if (k === 'estado') return `Estado: ${ESTADOS_RESERVA[v.antes as EstadoReserva]?.etiqueta} → ${ESTADOS_RESERVA[v.despues as EstadoReserva]?.etiqueta}`
    if (k === 'inicio' || k === 'fin') return `${nombres[k]}: ${fmtFechaHora(String(v.despues), org.zona)}`
    if (k === 'contrato_estado') return `Contrato: ${ESTADOS_CONTRATO[v.despues as EstadoContrato]}`
    return nombres[k]!
  }).join(' · ')
}
</script>

<template>
  <div class="space-y-4">
    <button class="btn-fantasma -ml-2" @click="router.back()"><ArrowLeft class="size-4" /> Volver</button>
    <Cargando v-if="cargando" :filas="5" />
    <p v-else-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <template v-else-if="reserva">
      <!-- Encabezado -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="titulo-pagina">{{ reserva.titulo }}</h1>
            <InsigniaEstado :estado="reserva.estado" />
          </div>
          <p class="mt-1 text-sm text-slate-600 first-letter:uppercase">{{ fmtRango(reserva.inicio, reserva.fin, org.zona) }}
            · {{ reserva.reserva_espacios.map((e) => e.espacios?.nombre).join(', ') || 'sin espacio' }}</p>
          <p class="text-xs text-slate-400">#{{ reserva.numero }} · {{ TIPOS_EVENTO[reserva.tipo_evento] }}</p>
          <p v-if="reserva.estado === 'cancelada'" class="mt-1 text-sm text-rose-700">Motivo: {{ reserva.motivo_cancelacion || '—' }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="org.puede('reservas.editar')" class="btn-secundario" @click="acciones.editarReserva(reserva.id)">
            <Pencil class="size-4" /> {{ reserva.estado === 'cancelada' ? 'Reactivar' : 'Editar' }}
          </button>
          <button v-if="org.puede('reservas.cancelar') && reserva.estado !== 'cancelada' && reserva.estado !== 'finalizada'" class="btn-fantasma text-rose-600" @click="cambiarEstado('cancelada')"><Ban class="size-4" /> Cancelar</button>
          <button v-if="org.puede('reservas.eliminar')" class="btn-fantasma text-rose-600" aria-label="Eliminar evento" title="Eliminar" @click="eliminar"><Trash2 class="size-4" /></button>
        </div>
      </div>

      <!-- Próximo paso -->
      <section v-if="proximoPaso" :class="['flex flex-col gap-3 rounded-xl px-4 py-3 ring-1 sm:flex-row sm:items-center', TONOS[proximoPaso.tono]]" aria-label="Próximo paso">
        <div class="min-w-0 sm:flex-1">
          <p class="text-xs font-semibold uppercase tracking-wide opacity-70">Próximo paso</p>
          <p class="font-semibold">{{ proximoPaso.titulo }}</p>
          <p v-if="proximoPaso.detalle" class="text-sm opacity-80">{{ proximoPaso.detalle }}</p>
        </div>
        <div class="flex flex-wrap gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          <button v-for="a in proximoPaso.acciones" :key="a.etiqueta" :class="a.primaria ? 'btn-primario' : 'btn-secundario'" @click="a.hacer()">{{ a.etiqueta }}</button>
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-3">
        <!-- Datos -->
        <section class="tarjeta space-y-4 p-4 lg:col-span-1">
          <h2 class="text-sm font-semibold">Datos del evento</h2>
          <dl class="space-y-3 text-sm">
            <div v-if="org.sucursales.length > 1"><dt class="text-xs text-slate-500">Sede</dt><dd>{{ reserva.sucursales?.nombre }}</dd></div>
            <div><dt class="text-xs text-slate-500">Espacios</dt>
              <dd v-for="e in reserva.reserva_espacios" :key="e.espacios?.id" class="flex items-center gap-2">
                <span class="size-2 rounded-full" :style="{ background: e.espacios?.color }" /> {{ e.espacios?.nombre }}
                <span class="text-xs text-slate-500">(montaje {{ e.antes_min }} min · limpieza {{ e.despues_min }} min)</span>
              </dd>
              <dd v-if="!reserva.reserva_espacios.length" class="text-amber-700">Sin espacio asignado</dd></div>
            <div class="flex gap-3"><Users class="mt-0.5 size-4 shrink-0 text-slate-400" />
              <dd>{{ reserva.invitados ?? '—' }} invitados <span v-if="capacidad" class="text-xs text-slate-500">(capacidad {{ capacidad }})</span></dd></div>
            <div><dt class="text-xs text-slate-500">Cliente</dt>
              <dd><RouterLink v-if="reserva.clientes && org.puede('clientes.ver')" :to="{ name: 'cliente', params: { id: reserva.clientes.id } }" class="enlace">{{ reserva.clientes.nombre }}</RouterLink>
                <span v-else>{{ reserva.clientes?.nombre }}</span></dd>
              <dd class="text-xs text-slate-500">
                <a v-if="reserva.clientes?.telefono" :href="`https://wa.me/${reserva.clientes.telefono.replace(/\D/g, '')}`" target="_blank" rel="noopener" class="hover:underline">{{ reserva.clientes.telefono }}</a>
                <template v-if="reserva.clientes?.email"> · <a :href="`mailto:${reserva.clientes.email}`" class="hover:underline">{{ reserva.clientes.email }}</a></template>
              </dd></div>
            <div><dt class="text-xs text-slate-500">Responsable</dt><dd>{{ responsable || 'Sin asignar' }}</dd></div>
            <div><dt class="text-xs text-slate-500">Contrato</dt>
              <dd v-if="org.puede('contratos.gestionar')">
                <select :value="reserva.contrato_estado" class="entrada mt-1 py-1.5" aria-label="Estado del contrato" @change="cambiarContrato">
                  <option v-for="(t, k) in ESTADOS_CONTRATO" :key="k" :value="k">{{ t }}</option>
                </select></dd>
              <dd v-else>{{ ESTADOS_CONTRATO[reserva.contrato_estado] }}</dd></div>
            <div v-if="reserva.notas"><dt class="text-xs text-slate-500">Notas</dt><dd class="whitespace-pre-line">{{ reserva.notas }}</dd></div>
          </dl>
        </section>

        <!-- Cobros -->
        <section v-if="org.puede('pagos.ver')" class="tarjeta p-4 lg:col-span-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="flex items-center gap-2 text-sm font-semibold"><Wallet class="size-4 text-marca-600" /> Cobros</h2>
            <div class="flex gap-2">
              <button v-if="org.puede('pagos.registrar')" class="btn-secundario btn-chico" @click="plan.primera = sumarDiasISO(hoy, 30); planAbierto = true">Plan de pagos</button>
              <button v-if="org.puede('pagos.registrar') && reserva.estado !== 'cancelada'" class="btn-primario btn-chico" @click="abrirPago"><Plus class="size-4" /> Registrar cobro</button>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <div class="rounded-lg bg-slate-50 p-3"><p class="text-xs text-slate-500">Total</p><p class="font-semibold tabular-nums">{{ fmtMoneda(reserva.precio_total) }}</p></div>
            <div class="rounded-lg bg-emerald-50 p-3"><p class="text-xs text-emerald-700">Cobrado</p><p class="font-semibold tabular-nums text-emerald-800">{{ fmtMoneda(pagado) }}</p></div>
            <div class="rounded-lg bg-slate-50 p-3"><p class="text-xs text-slate-500">Saldo</p><p class="font-semibold tabular-nums">{{ fmtMoneda(saldo?.saldo ?? null) }}</p></div>
            <div v-if="(saldo?.vencido ?? 0) > 0" class="rounded-lg bg-rose-50 p-3"><p class="text-xs text-rose-700">Atrasado</p>
              <p :class="['font-semibold tabular-nums', (saldo?.vencido ?? 0) > 0 && 'text-rose-700']">{{ fmtMoneda(saldo?.vencido ?? 0) }}</p></div>
          </div>
          <p v-if="cuotas.length && Math.abs(totalCuotas - Number(reserva.precio_total)) > 0.5" class="mt-2 text-xs text-amber-700">
            El plan de cuotas suma {{ fmtMoneda(totalCuotas) }} y el total de la reserva es {{ fmtMoneda(reserva.precio_total) }}.
          </p>

          <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan de cuotas</h3>
          <ul class="mt-1 divide-y divide-slate-100 text-sm">
            <li v-for="c in cuotas" :key="c.id" class="flex items-center gap-3 py-2">
              <span class="flex-1">{{ c.concepto }} <span class="text-xs text-slate-500">· vence {{ fmtFecha(c.vencimiento, org.zona) }}</span></span>
              <span class="tabular-nums">{{ fmtMoneda(c.monto) }}</span>
              <span :class="['w-24 text-right text-xs font-medium', c.pendiente === 0 ? 'text-emerald-600' : c.vencimiento < hoy ? 'text-rose-600' : 'text-slate-500']">
                {{ c.pendiente === 0 ? 'Pagada' : c.vencimiento < hoy ? `Debe ${fmtMoneda(c.pendiente, true)}` : `Pend. ${fmtMoneda(c.pendiente, true)}` }}
              </span>
              <button v-if="org.puede('pagos.registrar')" class="text-slate-400 hover:text-rose-600" aria-label="Quitar cuota" @click="borrarCuota(c)"><Trash2 class="size-4" /></button>
            </li>
            <li v-if="!cuotas.length" class="py-2 text-slate-500">Sin plan de cuotas.</li>
          </ul>
          <button v-if="org.puede('pagos.registrar') && !verCuotaNueva" type="button" class="enlace mt-1 text-sm" @click="verCuotaNueva = true">+ Agregar una cuota</button>
          <form v-if="org.puede('pagos.registrar') && verCuotaNueva" class="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]" @submit.prevent="agregarCuota">
            <input v-model="cuotaNueva.concepto" class="entrada" placeholder="Concepto (ej.: Cuota 2)" aria-label="Concepto" />
            <CampoFecha v-model="cuotaNueva.vencimiento" aria-label="Vencimiento" />
            <CampoMoneda v-model="cuotaNueva.monto" placeholder="Monto" />
            <button class="btn-secundario">Agregar</button>
          </form>

          <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Cobros registrados</h3>
          <ul class="mt-1 divide-y divide-slate-100 text-sm">
            <li v-for="p in pagos" :key="p.id" :class="['flex flex-wrap items-center gap-3 py-2', p.anulado && 'opacity-60']">
              <span class="w-24 text-slate-500">{{ fmtFecha(p.fecha, org.zona) }}</span>
              <span class="flex-1">{{ CONCEPTOS_PAGO[p.concepto] }} · {{ MEDIOS_PAGO[p.medio] }}<span v-if="p.referencia" class="text-xs text-slate-500"> · {{ p.referencia }}</span>
                <span v-if="p.anulado" class="block text-xs text-rose-600">Anulado: {{ p.anulado_motivo }}</span></span>
              <span :class="['tabular-nums font-medium', p.anulado && 'line-through']">{{ fmtMoneda(p.monto) }}</span>
              <span class="flex gap-1">
                <button class="btn-fantasma btn-chico" :title="`Comprobante N° ${numeroDoc(p.numero_comprobante, 8)}`" @click="descargarComprobante(p)"><Receipt class="size-4" /> Comprobante</button>
                <button v-if="!p.anulado" class="btn-fantasma btn-chico text-emerald-700" aria-label="Enviar comprobante por WhatsApp" title="Enviar por WhatsApp" @click="enviarComprobante(p)"><MessageCircle class="size-4" /></button>
                <button v-if="!p.anulado && org.puede('pagos.anular')" class="btn-fantasma btn-chico text-rose-600" @click="anularPago(p)">Anular</button>
              </span>
            </li>
            <li v-if="!pagos.length" class="py-2 text-slate-500">Todavía no se registraron cobros.</li>
          </ul>
        </section>

        <!-- Servicios contratados -->
        <section class="tarjeta p-4 lg:col-span-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="flex items-center gap-2 text-sm font-semibold"><Package class="size-4 text-marca-600" /> Servicios contratados</h2>
            <button v-if="org.puede('reservas.editar') && reserva.estado !== 'cancelada'" class="btn-secundario btn-chico" @click="abrirAdicional">
              <Plus class="size-4" /> {{ items.length ? 'Agregar adicional' : 'Detallar servicios' }}
            </button>
          </div>
          <ul v-if="items.length" class="mt-2 divide-y divide-slate-100 text-sm">
            <li v-for="i in items" :key="i.id" class="flex items-center gap-3 py-2">
              <span class="min-w-0 flex-1">{{ i.descripcion }}
                <span v-if="i.es_adicional" class="ml-1 rounded bg-marca-50 px-1.5 text-[10px] font-semibold uppercase text-marca-700">Adicional</span>
                <span class="block text-xs text-slate-500">{{ Number(i.cantidad).toLocaleString('es-AR') }} {{ UNIDADES_SERVICIO[i.unidad]?.corta }} × {{ fmtMoneda(i.precio_unitario) }}</span></span>
              <span class="tabular-nums">{{ fmtMoneda(Number(i.cantidad) * Number(i.precio_unitario)) }}</span>
              <button v-if="org.puede('reservas.editar')" class="text-slate-400 hover:text-rose-600" :aria-label="`Quitar ${i.descripcion}`" @click="quitarItem(i)"><Trash2 class="size-4" /></button>
            </li>
            <li v-if="Number(reserva.descuento) > 0" class="flex justify-between py-2 text-slate-500"><span>Descuento</span><span class="tabular-nums">- {{ fmtMoneda(reserva.descuento) }}</span></li>
            <li class="flex justify-between py-2 font-semibold"><span>Total del evento</span><span class="tabular-nums">{{ fmtMoneda(reserva.precio_total) }}</span></li>
          </ul>
          <p v-else class="mt-2 text-sm text-slate-500">No hay servicios detallados: el total ({{ fmtMoneda(reserva.precio_total) }}) se cargó a mano.</p>
        </section>

        <!-- Garantía -->
        <section v-if="org.puede('pagos.ver')" class="tarjeta p-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold"><ShieldCheck class="size-4 text-amber-600" /> Depósito de garantía</h2>
          <template v-if="garantia">
            <div class="mt-2 flex items-center justify-between gap-2">
              <span class="text-lg font-semibold tabular-nums">{{ fmtMoneda(garantia.monto) }}</span>
              <span :class="['rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ESTADOS_GARANTIA[garantia.estado]?.clase]">{{ ESTADOS_GARANTIA[garantia.estado]?.etiqueta }}</span>
            </div>
            <p v-if="garantia.estado !== 'pendiente'" class="mt-1 text-xs text-slate-500">Cobrada el {{ fmtFecha(garantia.cobro_fecha, org.zona) }} · {{ MEDIOS_PAGO[garantia.cobro_medio ?? ''] }}</p>
            <p v-if="garantia.estado === 'devuelta' || garantia.estado === 'retenida'" class="mt-1 text-xs text-slate-500">
              Devuelto {{ fmtMoneda(garantia.devolucion_monto) }} el {{ fmtFecha(garantia.devolucion_fecha, org.zona) }}
              <template v-if="garantia.estado === 'retenida'"> · retenido {{ fmtMoneda(Number(garantia.monto) - Number(garantia.devolucion_monto)) }}: {{ garantia.motivo_retencion }}</template>
            </p>
            <div v-if="org.puede('pagos.registrar')" class="mt-3 flex flex-wrap gap-2">
              <template v-if="garantia.estado === 'pendiente'">
                <button class="btn-primario btn-chico" @click="abrirGarantia('cobrar')">Cobrar</button>
                <button class="btn-fantasma btn-chico" @click="abrirGarantia('pedir')">Cambiar monto</button>
                <button class="btn-fantasma btn-chico text-rose-600" @click="quitarGarantia">Quitar</button>
              </template>
              <button v-if="garantia.estado === 'cobrada'" :class="eventoTermino ? 'btn-primario btn-chico' : 'btn-secundario btn-chico'" @click="abrirGarantia('devolver')">Registrar devolución</button>
            </div>
            <div v-if="garantia.estado !== 'pendiente'" class="mt-2 flex flex-wrap gap-1">
              <button class="btn-fantasma btn-chico" @click="documentoGarantia('recibo')"><Receipt class="size-4" /> Recibo</button>
              <button class="btn-fantasma btn-chico text-emerald-700" aria-label="Enviar recibo por WhatsApp" @click="documentoGarantia('recibo', true)"><MessageCircle class="size-4" /></button>
              <template v-if="garantia.numero_devolucion">
                <button class="btn-fantasma btn-chico" @click="documentoGarantia('devolucion')"><Receipt class="size-4" /> Devolución</button>
                <button class="btn-fantasma btn-chico text-emerald-700" aria-label="Enviar constancia por WhatsApp" @click="documentoGarantia('devolucion', true)"><MessageCircle class="size-4" /></button>
              </template>
            </div>
          </template>
          <template v-else>
            <p class="mt-2 text-sm text-slate-500">Este evento no pide garantía.</p>
            <button v-if="org.puede('pagos.registrar') && reserva.estado !== 'cancelada'" class="btn-secundario btn-chico mt-2" @click="abrirGarantia('pedir')">
              Pedir garantía<template v-if="garantiaSugerida"> ({{ fmtMoneda(garantiaSugerida, true) }})</template>
            </button>
          </template>
        </section>

        <!-- Tareas -->
        <section v-if="org.puede('tareas.ver')" class="tarjeta p-4">
          <h2 class="text-sm font-semibold">Tareas del evento</h2>
          <ul class="mt-2 space-y-1 text-sm">
            <li v-for="t in tareas" :key="t.id" class="flex items-start gap-2">
              <input type="checkbox" :checked="t.estado === 'hecha'" class="mt-0.5 rounded border-slate-300 text-marca-600" :aria-label="t.titulo" @change="alternarTarea(t)" />
              <span :class="t.estado === 'hecha' && 'text-slate-400 line-through'">{{ t.titulo }}
                <span v-if="t.vence_el" :class="['text-xs', t.estado !== 'hecha' && t.vence_el < hoy ? 'text-rose-600' : 'text-slate-500']"> · {{ fmtFecha(t.vence_el, org.zona) }}</span></span>
            </li>
            <li v-if="!tareas.length" class="text-slate-500">Sin tareas.</li>
          </ul>
          <form v-if="org.puede('tareas.gestionar')" class="mt-3 space-y-2" @submit.prevent="agregarTarea">
            <input v-model="tareaNueva.titulo" class="entrada" placeholder="Nueva tarea (ej.: confirmar DJ)" aria-label="Nueva tarea" />
            <div class="flex gap-2"><CampoFecha v-model="tareaNueva.vence_el" class="flex-1" /><button class="btn-secundario">Agregar</button></div>
          </form>
        </section>

        <!-- Historial -->
        <section v-if="org.puede('auditoria.ver')" class="tarjeta p-4 lg:col-span-2">
          <h2 class="flex items-center gap-2 text-sm font-semibold"><History class="size-4 text-slate-500" /> Historial</h2>
          <ol class="mt-2 space-y-2 border-l border-slate-200 pl-4 text-sm">
            <li v-for="h in historialVisible" :key="h.id">
              <p class="text-xs text-slate-500">{{ fmtFechaHora(h.creado_at, org.zona) }}</p>
              <p>{{ h.accion === 'alta' ? 'Evento creado' : h.accion === 'baja' ? 'Evento eliminado' : describirCambio(h.cambios) }}</p>
            </li>
          </ol>
        </section>
      </div>
    </template>

    <Modal v-model="pagoAbierto" titulo="Registrar cobro" ancho="sm">
      <form id="form-pago" class="space-y-3" @submit.prevent="registrarPago">
        <Campo etiqueta="Monto" para="p-monto" requerido><CampoMoneda id="p-monto" v-model="pago.monto" /></Campo>
        <div class="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha" para="p-fecha" requerido><CampoFecha id="p-fecha" v-model="pago.fecha" /></Campo>
          <Campo etiqueta="Concepto" para="p-concepto">
            <select id="p-concepto" v-model="pago.concepto" class="entrada"><option v-for="(t, k) in CONCEPTOS_PAGO" :key="k" :value="k">{{ t }}</option></select>
          </Campo>
        </div>
        <Campo etiqueta="Medio de pago" para="p-medio">
          <select id="p-medio" v-model="pago.medio" class="entrada"><option v-for="(t, k) in MEDIOS_PAGO" :key="k" :value="k">{{ t }}</option></select>
        </Campo>
        <Campo etiqueta="Referencia" para="p-ref" ayuda="Nº de operación, recibo o comprobante."><input id="p-ref" v-model="pago.referencia" class="entrada" /></Campo>
        <p v-if="pago.concepto === 'sena' && ['consulta', 'tentativa'].includes(reserva?.estado ?? '')" class="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
          Al registrar la seña, la reserva pasa a <strong>Señada</strong> y la fecha queda bloqueada.
        </p>
        <p v-if="errorPago" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorPago }}</p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="pagoAbierto = false">Cancelar</button>
        <button type="submit" form="form-pago" class="btn-primario" :disabled="guardandoPago">{{ guardandoPago ? 'Guardando…' : 'Registrar' }}</button>
      </template>
    </Modal>

    <Modal v-model="adicionalAbierto" :titulo="items.length ? 'Agregar adicional' : 'Detallar servicios'">
      <div class="space-y-3">
        <div v-if="catalogo.length" class="max-h-48 overflow-y-auto rounded-lg ring-1 ring-slate-200">
          <button v-for="sv in catalogo" :key="sv.id" type="button" :class="['flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50', adic.servicio_id === sv.id && 'bg-marca-50']"
                  @click="elegirServicio(sv)">
            <span>{{ sv.nombre }} <span v-if="sv.tipo === 'adicional'" class="text-xs text-marca-700">· adicional</span></span>
            <span class="tabular-nums text-slate-600">{{ fmtMoneda(sv.precio, true) }} <span class="text-xs">{{ UNIDADES_SERVICIO[sv.unidad]?.corta }}</span></span>
          </button>
        </div>
        <Campo etiqueta="Qué es" para="ad-desc"><input id="ad-desc" v-model="adic.descripcion" class="entrada" placeholder="Ej.: Cabina de fotos" @input="adic.servicio_id = null" /></Campo>
        <div class="grid grid-cols-3 gap-3">
          <Campo etiqueta="Cantidad" para="ad-cant"><input id="ad-cant" v-model.number="adic.cantidad" type="number" min="0" step="any" class="entrada" /></Campo>
          <Campo etiqueta="Unidad" para="ad-uni"><select id="ad-uni" v-model="adic.unidad" class="entrada"><option v-for="(u, k) in UNIDADES_SERVICIO" :key="k" :value="k">{{ u.corta }}</option></select></Campo>
          <Campo etiqueta="Precio" para="ad-precio"><CampoMoneda id="ad-precio" v-model="adic.precio" /></Campo>
        </div>
        <p class="text-sm">Importe: <strong class="tabular-nums">{{ fmtMoneda((adic.cantidad || 0) * (adic.precio || 0)) }}</strong></p>
        <div v-if="org.puede('pagos.registrar')" class="rounded-lg bg-slate-50 p-3">
          <label class="flex items-center gap-2 text-sm"><input v-model="adic.crear_cuota" type="checkbox" class="rounded border-slate-300 text-marca-600" /> Agregar una cuota por este importe</label>
          <Campo v-if="adic.crear_cuota" etiqueta="Vence" para="ad-venc" class="mt-2 max-w-48"><CampoFecha id="ad-venc" v-model="adic.vencimiento" /></Campo>
        </div>
        <p v-if="errorAdic" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorAdic }}</p>
      </div>
      <template #pie>
        <button class="btn-secundario" @click="adicionalAbierto = false">Cancelar</button>
        <button class="btn-primario" @click="guardarAdicional">Agregar</button>
      </template>
    </Modal>

    <Modal v-model="garAbierto" :titulo="garModo === 'pedir' ? 'Depósito de garantía' : garModo === 'cobrar' ? 'Cobrar garantía' : 'Devolver garantía'" ancho="sm"
           :descripcion="garModo === 'pedir' ? 'Monto que se pide como garantía. Es reintegrable y no suma al total del evento.' : undefined">
      <div class="space-y-3">
        <Campo v-if="garModo === 'pedir'" etiqueta="Monto" para="g-monto"><CampoMoneda id="g-monto" v-model="gar.monto" /></Campo>
        <template v-else>
          <p class="text-sm">Garantía: <strong class="tabular-nums">{{ fmtMoneda(garantia?.monto) }}</strong></p>
          <div v-if="garModo === 'devolver'" role="radiogroup" class="grid grid-cols-2 gap-2">
            <button type="button" role="radio" :aria-checked="gar.completa" :class="['rounded-lg p-2.5 text-left text-sm ring-1', gar.completa ? 'bg-emerald-50 ring-2 ring-emerald-500' : 'ring-slate-300']" @click="gar.completa = true">
              <span class="block font-semibold">Todo bien</span><span class="text-xs text-slate-500">Se devuelve completa</span></button>
            <button type="button" role="radio" :aria-checked="!gar.completa" :class="['rounded-lg p-2.5 text-left text-sm ring-1', !gar.completa ? 'bg-rose-50 ring-2 ring-rose-500' : 'ring-slate-300']" @click="gar.completa = false">
              <span class="block font-semibold">Hubo daños</span><span class="text-xs text-slate-500">Se retiene una parte</span></button>
          </div>
          <template v-if="garModo === 'devolver' && !gar.completa">
            <Campo etiqueta="Monto que se devuelve" para="g-dev" ayuda="Poné 0 si se retiene todo."><CampoMoneda id="g-dev" v-model="gar.devuelto" /></Campo>
            <p v-if="gar.devuelto !== null && garantia" class="text-xs text-rose-700">Se retienen {{ fmtMoneda(Number(garantia.monto) - (gar.devuelto ?? 0)) }}.</p>
            <Campo etiqueta="Motivo de la retención" para="g-motivo"><input id="g-motivo" v-model="gar.motivo" class="entrada" placeholder="Ej.: 3 copas rotas y mantel manchado" /></Campo>
          </template>
          <div class="grid grid-cols-2 gap-3">
            <Campo etiqueta="Fecha" para="g-fecha"><CampoFecha id="g-fecha" v-model="gar.fecha" /></Campo>
            <Campo etiqueta="Medio" para="g-medio"><select id="g-medio" v-model="gar.medio" class="entrada"><option v-for="(m, k) in MEDIOS_PAGO" :key="k" :value="k">{{ m }}</option></select></Campo>
          </div>
          <Campo v-if="garModo === 'cobrar'" etiqueta="Referencia" para="g-ref"><input id="g-ref" v-model="gar.referencia" class="entrada" placeholder="N° de operación (opcional)" /></Campo>
        </template>
        <p v-if="errorGar" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorGar }}</p>
      </div>
      <template #pie>
        <button class="btn-secundario" @click="garModo = null">Cancelar</button>
        <button class="btn-primario" @click="confirmarGarantia">{{ garModo === 'pedir' ? 'Guardar' : garModo === 'cobrar' ? 'Registrar cobro' : 'Registrar devolución' }}</button>
      </template>
    </Modal>

    <Modal v-model="pagoRecienAbierto" titulo="Cobro registrado" ancho="sm">
      <div v-if="pagoRecien" class="space-y-2 text-center">
        <CircleCheck class="mx-auto size-10 text-emerald-500" />
        <p class="text-lg font-semibold tabular-nums">{{ fmtMoneda(pagoRecien.monto) }}</p>
        <p class="text-sm text-slate-600">Comprobante N° {{ numeroDoc(pagoRecien.numero_comprobante, 8) }}</p>
      </div>
      <template #pie>
        <button class="btn-secundario" @click="pagoRecien && descargarComprobante(pagoRecien)"><Download class="size-4" /> Descargar</button>
        <button class="btn-primario" @click="pagoRecien && enviarComprobante(pagoRecien)"><MessageCircle class="size-4" /> Enviar por WhatsApp</button>
      </template>
    </Modal>

    <Modal v-model="planAbierto" titulo="Generar plan de pagos" ancho="sm" :descripcion="`Total: ${fmtMoneda(reserva?.precio_total)}`">
      <form id="form-plan" class="grid grid-cols-2 gap-3" @submit.prevent="generarPlan">
        <Campo etiqueta="Seña (%)" para="pl-sena"><input id="pl-sena" v-model.number="plan.senaPct" type="number" min="0" max="100" class="entrada" /></Campo>
        <Campo etiqueta="Cantidad de cuotas" para="pl-n"><input id="pl-n" v-model.number="plan.cuotas" type="number" min="1" max="24" class="entrada" /></Campo>
        <Campo etiqueta="Primera cuota" para="pl-1"><CampoFecha id="pl-1" v-model="plan.primera" /></Campo>
        <Campo etiqueta="Cada (días)" para="pl-cada"><input id="pl-cada" v-model.number="plan.cada" type="number" min="1" class="entrada" /></Campo>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="planAbierto = false">Cancelar</button>
        <button type="submit" form="form-plan" class="btn-primario">Generar</button>
      </template>
    </Modal>
  </div>
</template>
