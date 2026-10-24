<script setup lang="ts">
// Editor de presupuestos: cliente, evento, ítems del catálogo, descuento, plan de pagos,
// PDF con la marca del salón, envío por WhatsApp y conversión en evento al aceptarlo.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CircleAlert, CircleCheck, Download, MessageCircle, Package, Plus, Trash2, X } from 'lucide-vue-next'
import SelectorCliente from '@/components/clientes/SelectorCliente.vue'
import type { ClienteElegido } from '@/components/clientes/tipos'
import Campo from '@/components/ui/Campo.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import CampoHora from '@/components/ui/CampoHora.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import Modal from '@/components/ui/Modal.vue'
import Cargando from '@/components/ui/Cargando.vue'
import type { Fila } from '@/lib/supabase'
import { api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { aLocal, desdeLocal, fmtFecha, fmtMoneda, hoyISO, sumarDiasISO } from '@/lib/formato'
import { ESTADOS_PRESUPUESTO, ESTADOS_RESERVA, TIPOS_EVENTO, UNIDADES_SERVICIO } from '@/lib/catalogos'
import { planDePagos } from '@/lib/planPagos'
import { crearPdfPresupuesto, emisorDe, numeroDoc } from '@/lib/documentos'
import { enviarPorWhatsApp, guardarPDF } from '@/lib/compartir'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'
import { useConfirmar } from '@/composables/useConfirmar'

interface Item { servicio_id: string | null; descripcion: string; cantidad: number; unidad: string; precio_unitario: number }

const route = useRoute()
const router = useRouter()
const org = useOrganizacion()
const { exito, info, error: notificarError } = useNotificaciones()
const { confirmar } = useConfirmar()
const id = ref<string | null>(route.params.id ? String(route.params.id) : null)
const hoy = computed(() => hoyISO(org.zona))

const p = reactive({
  numero: 0, estado: 'borrador', reserva_id: null as string | null, creado_at: '',
  titulo: '', tituloTocado: false, tipo_evento: 'cumpleanos', fecha_evento: '', hora_inicio: '21:00', hora_fin: '04:00',
  espacio_id: '', invitados: null as number | null, valido_hasta: '', descuento: null as number | null,
  sena_porcentaje: 30, cantidad_cuotas: 2, condiciones: '', notas: '', garantia_monto: null as number | null,
})
const cliente = ref<ClienteElegido | null>(null)
const items = ref<Item[]>([])
const catalogo = ref<Fila<'servicios'>[]>([])
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
const cambios = ref(false)
const soloLectura = computed(() => p.estado === 'aceptado' || !org.puede('presupuestos.gestionar'))

onMounted(async () => {
  try {
    catalogo.value = await api.get<Fila<'servicios'>[]>(rutaOrg(org.id, 'servicios'), { activos: true })
    if (id.value) await cargar(id.value)
    else await precargar()
  } catch (e) { error.value = traducirError(e) } finally { cargando.value = false; cambios.value = false }
})

async function cargar(pid: string) {
  const r = await api.get<Fila<'presupuestos'> & { clientes: ClienteElegido; presupuesto_items: Fila<'presupuesto_items'>[] }>(`/presupuestos/${pid}`)
  Object.assign(p, {
    numero: r.numero, estado: r.estado, reserva_id: r.reserva_id, creado_at: r.creado_at, titulo: r.titulo, tituloTocado: true, tipo_evento: r.tipo_evento,
    fecha_evento: r.fecha_evento ?? '', hora_inicio: r.hora_inicio?.slice(0, 5) ?? '', hora_fin: r.hora_fin?.slice(0, 5) ?? '', espacio_id: r.espacio_id ?? '',
    invitados: r.invitados, valido_hasta: r.valido_hasta, descuento: Number(r.descuento) || null, sena_porcentaje: Number(r.sena_porcentaje),
    cantidad_cuotas: r.cantidad_cuotas, condiciones: r.condiciones ?? '', notas: r.notas ?? '', garantia_monto: Number(r.garantia_monto) || null,
  })
  cliente.value = r.clientes as ClienteElegido
  items.value = (r.presupuesto_items as Fila<'presupuesto_items'>[]).sort((a, b) => a.orden - b.orden)
    .map((i) => ({ servicio_id: i.servicio_id, descripcion: i.descripcion, cantidad: Number(i.cantidad), unidad: i.unidad, precio_unitario: Number(i.precio_unitario) }))
}

// Precarga desde un cliente o un evento (consulta) existente.
async function precargar() {
  p.valido_hasta = sumarDiasISO(hoy.value, org.actual?.validez_presupuesto_dias ?? 15)
  p.condiciones = org.actual?.condiciones_presupuesto ?? ''
  p.espacio_id = org.espaciosActivos.length === 1 ? org.espaciosActivos[0]!.id : ''
  const reservaId = typeof route.query.reserva === 'string' ? route.query.reserva : null
  const clienteId = typeof route.query.cliente === 'string' ? route.query.cliente : null
  if (reservaId) {
    const r = await api.get<Fila<'reservas'> & { clientes: ClienteElegido; reserva_espacios: Array<{ espacio_id: string }> }>(`/reservas/${reservaId}`)
    const ini = aLocal(r.inicio, org.zona), fin = aLocal(r.fin, org.zona)
    Object.assign(p, { reserva_id: r.id, titulo: r.titulo, tituloTocado: true, tipo_evento: r.tipo_evento, fecha_evento: ini.fecha, hora_inicio: ini.hora,
      hora_fin: fin.hora, invitados: r.invitados, espacio_id: (r.reserva_espacios as Array<{ espacio_id: string }>)[0]?.espacio_id ?? p.espacio_id })
    cliente.value = r.clientes as ClienteElegido
  } else if (clienteId) {
    const c = await api.get<ClienteElegido>(`/clientes/${clienteId}`).catch(() => null)
    cliente.value = c ? { id: c.id, nombre: c.nombre, telefono: c.telefono, email: c.email } : null
  }
}

watch([() => ({ ...p }), items, cliente], () => { cambios.value = true }, { deep: true })
watch([() => p.tipo_evento, cliente], () => {
  if (!p.tituloTocado) p.titulo = cliente.value ? `${TIPOS_EVENTO[p.tipo_evento]} · ${cliente.value.nombre}` : ''
})
// Las líneas "por persona" acompañan la cantidad de invitados.
watch(() => p.invitados, (n, viejo) => {
  if (soloLectura.value) return
  ajustarExtras()
  if (!n) return
  for (const i of items.value) if (i.unidad === 'persona' && !esExtra(i) && (i.cantidad === viejo || i.cantidad === 1)) i.cantidad = n
})

// --- Ítems ---------------------------------------------------------------------
// Servicios con personas incluidas (ej.: salón hasta 20 personas): las personas de más
// van en una línea aparte, justo debajo, que sigue a la cantidad de invitados.
const conIncluidas = (sid: string | null) => catalogo.value.find((s) => s.id === sid && s.personas_incluidas) ?? null
const esExtra = (i: Item) => i.unidad === 'persona' && !!conIncluidas(i.servicio_id)
function ajustarExtras() {
  for (let n = 0; n < items.value.length; n++) {
    const base = items.value[n]!
    const s = base.unidad === 'evento' ? conIncluidas(base.servicio_id) : null
    if (!s) continue
    const exceso = Math.max((p.invitados ?? 0) - s.personas_incluidas!, 0)
    const sig = items.value[n + 1]
    const tieneExtra = sig?.servicio_id === s.id && sig.unidad === 'persona'
    if (exceso && tieneExtra) sig.cantidad = exceso
    else if (exceso) items.value.splice(n + 1, 0, { servicio_id: s.id, descripcion: `Personas extra (más de ${s.personas_incluidas}) — ${s.nombre}`,
      cantidad: exceso, unidad: 'persona', precio_unitario: Number(s.precio_persona_extra) })
    else if (tieneExtra) items.value.splice(n + 1, 1)
  }
}
const catalogoAbierto = ref(false)
function agregarDelCatalogo(s: Fila<'servicios'>) {
  items.value.push({ servicio_id: s.id, descripcion: s.descripcion ? `${s.nombre} — ${s.descripcion}` : s.nombre,
    cantidad: s.unidad === 'persona' && p.invitados ? p.invitados : 1, unidad: s.unidad, precio_unitario: Number(s.precio) })
  ajustarExtras()
  catalogoAbierto.value = false
}
function agregarLibre() {
  items.value.push({ servicio_id: null, descripcion: '', cantidad: 1, unidad: 'evento', precio_unitario: 0 })
}
const subtotal = computed(() => Math.round(items.value.reduce((t, i) => t + (i.cantidad || 0) * (i.precio_unitario || 0), 0) * 100) / 100)
const total = computed(() => Math.max(subtotal.value - (p.descuento ?? 0), 0))
const plan = computed(() => planDePagos(total.value, p.sena_porcentaje, p.cantidad_cuotas, p.fecha_evento || null, hoy.value))

// --- Capacidad y garantía del espacio elegido -------------------------------------
const espacioSel = computed(() => org.espacios.find((e) => e.id === p.espacio_id) ?? null)
const avisoInvitados = computed(() => {
  const e = espacioSel.value
  if (!e || !p.invitados) return ''
  if (p.invitados > e.capacidad_maxima) return `${e.nombre} admite hasta ${e.capacidad_maxima} personas.`
  if (e.capacidad_minima && p.invitados < e.capacidad_minima) return `El mínimo para ${e.nombre} es de ${e.capacidad_minima} invitados.`
  return ''
})
watch(() => p.espacio_id, (nuevo, viejo) => {
  if (cargando.value || soloLectura.value) return
  const anterior = org.espacios.find((e) => e.id === viejo)
  // Propone la garantía del espacio si no se escribió otra a mano.
  if (!p.garantia_monto || Number(anterior?.garantia_sugerida) === p.garantia_monto) {
    const sugerida = Number(org.espacios.find((e) => e.id === nuevo)?.garantia_sugerida) || null
    p.garantia_monto = sugerida
  }
})

// --- Disponibilidad (informativa) ----------------------------------------------
const disponible = ref<boolean | null>(null)
watch(() => [p.fecha_evento, p.hora_inicio, p.hora_fin, p.espacio_id], async () => {
  disponible.value = null
  if (!p.fecha_evento || !p.espacio_id || !p.hora_inicio || !p.hora_fin) return
  const fechaFin = p.hora_fin <= p.hora_inicio ? sumarDiasISO(p.fecha_evento, 1) : p.fecha_evento
  const data = await api.post<{ disponible?: boolean }>(rutaOrg(org.id, 'disponibilidad'), { espacios: [p.espacio_id],
    inicio: desdeLocal(p.fecha_evento, p.hora_inicio, org.zona), fin: desdeLocal(fechaFin, p.hora_fin, org.zona),
    excluir: p.reserva_id }).catch(() => null)
  disponible.value = (data as { disponible?: boolean } | null)?.disponible ?? null
}, { immediate: true })

// --- Guardar ---------------------------------------------------------------------
function validar(): string | null {
  if (!cliente.value) return 'Elegí o cargá el cliente.'
  if (!p.titulo.trim()) p.titulo = `${TIPOS_EVENTO[p.tipo_evento]} · ${cliente.value.nombre}`
  if (!items.value.length) return 'Agregá al menos un ítem.'
  if (items.value.some((i) => !i.descripcion.trim() || !(i.cantidad > 0) || i.precio_unitario < 0)) return 'Revisá los ítems: cada uno necesita descripción, cantidad y precio.'
  if (!p.valido_hasta) return 'Indicá hasta cuándo vale el presupuesto.'
  return null
}
async function guardar(estado?: string): Promise<string | null> {
  error.value = ''
  const problema = validar()
  if (problema) { error.value = problema; return null }
  guardando.value = true
  try {
    const cuerpo = {
      datos: { cliente_id: cliente.value!.id, reserva_id: p.reserva_id, espacio_id: p.espacio_id || null, titulo: p.titulo.trim(), tipo_evento: p.tipo_evento,
        fecha_evento: p.fecha_evento || null, hora_inicio: p.hora_inicio || null, hora_fin: p.hora_fin || null, invitados: p.invitados,
        estado: estado ?? p.estado, valido_hasta: p.valido_hasta, descuento: p.descuento ?? 0, sena_porcentaje: p.sena_porcentaje,
        cantidad_cuotas: p.cantidad_cuotas, condiciones: p.condiciones, notas: p.notas, garantia_monto: p.garantia_monto ?? 0 },
      items: items.value.map((i) => ({ ...i, descripcion: i.descripcion.trim() })),
    }
    const { id: nuevoId } = id.value
      ? await api.put<{ id: string }>(rutaOrg(org.id, `presupuestos/${id.value}`), cuerpo)
      : await api.post<{ id: string }>(rutaOrg(org.id, 'presupuestos'), cuerpo)
    if (!id.value) {
      id.value = nuevoId
      await router.replace({ name: 'presupuesto', params: { id: nuevoId } })
    }
    await cargar(nuevoId)
    cambios.value = false
    return nuevoId
  } catch (e) {
    error.value = traducirError(e)
    return null
  } finally {
    guardando.value = false
  }
}
async function guardarYAvisar() {
  if (await guardar()) exito('Presupuesto guardado.')
}

// --- PDF y WhatsApp ------------------------------------------------------------
async function armarPdf() {
  const espacio = org.espacios.find((e) => e.id === p.espacio_id)
  return crearPdfPresupuesto(emisorDe(org.actual!), {
    numero: p.numero, fecha_emision: p.creado_at ? aLocal(p.creado_at, org.zona).fecha : hoy.value, valido_hasta: p.valido_hasta,
    titulo: p.titulo, tipo_evento: TIPOS_EVENTO[p.tipo_evento] ?? p.tipo_evento, fecha_evento: p.fecha_evento || null,
    horario: p.hora_inicio && p.hora_fin ? `${p.hora_inicio} a ${p.hora_fin} hs` : null, espacio: espacio?.nombre ?? null, invitados: p.invitados,
    cliente: { nombre: cliente.value!.nombre, telefono: cliente.value!.telefono, email: cliente.value!.email },
    items: items.value, subtotal: subtotal.value, descuento: p.descuento ?? 0, total: total.value, sena_porcentaje: p.sena_porcentaje,
    plan: plan.value, condiciones: p.condiciones, notas: p.notas, estado: p.estado,
    garantia: p.garantia_monto ? { monto: p.garantia_monto, dias: org.actual?.dias_devolucion_garantia ?? 7 } : null,
  })
}
const nombreArchivoPdf = computed(() => `presupuesto-${numeroDoc(p.numero, 4)}-${(cliente.value?.nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`)
async function descargar() {
  if (!soloLectura.value && (cambios.value || !id.value) && !(await guardar())) return
  try { await guardarPDF(await armarPdf(), nombreArchivoPdf.value, `Presupuesto N° ${numeroDoc(p.numero, 4)}`) } catch (e) { notificarError(e) }
}
async function enviar() {
  if (!soloLectura.value && !(await guardar(p.estado === 'borrador' ? 'enviado' : undefined))) return
  try {
    const mensaje = `Hola ${cliente.value!.nombre.split(' ')[0]}! Te paso el presupuesto para ${p.titulo}` +
      `${p.fecha_evento ? ` del ${fmtFecha(p.fecha_evento, org.zona)}` : ''}: total ${fmtMoneda(total.value)}. Es válido hasta el ${fmtFecha(p.valido_hasta, org.zona)}. ` +
      `Cualquier consulta, estoy a disposición. ${org.actual?.nombre ?? ''}`
    const r = await enviarPorWhatsApp(await armarPdf(), nombreArchivoPdf.value, mensaje, cliente.value!.telefono)
    if (r === 'descargado') info('Descargamos el PDF y abrimos WhatsApp: adjuntalo en el chat.')
  } catch (e) { notificarError(e) }
}

// --- Aceptar / rechazar ---------------------------------------------------------
const aceptarAbierto = ref(false)
const estadoEvento = ref<'tentativa' | 'confirmada' | 'consulta'>('tentativa')
const aceptando = ref(false)
async function aceptar() {
  aceptando.value = true
  error.value = ''
  try {
    if (cambios.value && !(await guardar())) return
    const { reserva_id: reservaId } = await api.post<{ reserva_id: string }>(`/presupuestos/${id.value!}/aceptar`, { estado: estadoEvento.value })
    exito('¡Presupuesto aceptado! Se creó el evento con su plan de pagos.')
    aceptarAbierto.value = false
    await router.push({ name: 'reserva', params: { id: reservaId } })
  } catch (e) {
    error.value = traducirError(e)
    aceptarAbierto.value = false
  } finally {
    aceptando.value = false
  }
}
async function rechazar() {
  if (!(await confirmar({ titulo: 'Marcar como rechazado', mensaje: 'El cliente no aceptó este presupuesto. Queda guardado en el historial.', confirmar: 'Marcar rechazado' }))) return
  if (await guardar('rechazado')) exito('Presupuesto marcado como rechazado.')
}
async function eliminar() {
  if (!(await confirmar({ titulo: 'Eliminar presupuesto', mensaje: 'Se elimina definitivamente.', confirmar: 'Eliminar', peligro: true }))) return
  try {
    await eliminarRegistro('presupuestos', id.value!)
    exito('Presupuesto eliminado.')
    await router.replace({ name: 'presupuestos' })
  } catch (e) { notificarError(e) }
}
</script>

<template>
  <div class="space-y-5 pb-24">
    <button class="btn-fantasma -ml-2" @click="router.push({ name: 'presupuestos' })"><ArrowLeft class="size-4" /> Presupuestos</button>
    <Cargando v-if="cargando" :filas="6" />
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="titulo-pagina">{{ id ? `Presupuesto N° ${numeroDoc(p.numero, 4)}` : 'Nuevo presupuesto' }}</h1>
          <span v-if="id" :class="['rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ESTADOS_PRESUPUESTO[p.estado]?.clase]">{{ ESTADOS_PRESUPUESTO[p.estado]?.etiqueta }}</span>
        </div>
        <RouterLink v-if="p.estado === 'aceptado' && p.reserva_id" :to="{ name: 'reserva', params: { id: p.reserva_id } }" class="btn-secundario">Ver el evento</RouterLink>
        <div v-else-if="id && org.puede('presupuestos.gestionar')" class="flex flex-wrap gap-2">
          <button v-if="org.puede('reservas.crear')" class="btn-primario bg-emerald-600 hover:bg-emerald-700" @click="aceptarAbierto = true"><CircleCheck class="size-4" /> Aceptar presupuesto</button>
          <button v-if="p.estado !== 'rechazado'" class="btn-secundario" @click="rechazar">Marcar rechazado</button>
          <button class="btn-fantasma p-2 text-rose-600" aria-label="Eliminar presupuesto" title="Eliminar" @click="eliminar"><Trash2 class="size-4" /></button>
        </div>
      </div>
      <p v-if="soloLectura && p.estado === 'aceptado'" class="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Este presupuesto fue aceptado y ya es un evento. Para cambiar algo, editá el evento.
      </p>

      <fieldset :disabled="soloLectura" class="space-y-5">
        <div class="grid gap-5 lg:grid-cols-2">
          <!-- Cliente y evento -->
          <section class="tarjeta space-y-4 p-4">
            <h2 class="flex items-center gap-2 text-sm font-semibold"><span class="paso">1</span> Cliente y evento</h2>
            <SelectorCliente v-model="cliente" :deshabilitado="soloLectura" :invalido="!!error && !cliente" />
            <div class="grid grid-cols-2 gap-3">
              <Campo etiqueta="Tipo de evento" para="p-tipo">
                <select id="p-tipo" v-model="p.tipo_evento" class="entrada"><option v-for="(t, k) in TIPOS_EVENTO" :key="k" :value="k">{{ t }}</option></select>
              </Campo>
              <Campo etiqueta="Invitados" para="p-inv">
                <input id="p-inv" v-model.number="p.invitados" type="number" min="1" :class="['entrada', avisoInvitados && 'ring-amber-400']"
                       :placeholder="espacioSel ? (espacioSel.capacidad_minima ? `${espacioSel.capacidad_minima} a ${espacioSel.capacidad_maxima}` : `máx. ${espacioSel.capacidad_maxima}`) : ''" />
                <p v-if="avisoInvitados" class="mt-1 text-xs text-amber-700">{{ avisoInvitados }}</p>
              </Campo>
              <Campo etiqueta="Nombre del evento" para="p-titulo" class="col-span-2">
                <input id="p-titulo" v-model="p.titulo" class="entrada" placeholder="Se completa solo" @input="p.tituloTocado = true" />
              </Campo>
            </div>
          </section>
          <section class="tarjeta space-y-4 p-4">
            <h2 class="flex items-center gap-2 text-sm font-semibold"><span class="paso">2</span> Fecha y lugar <span class="font-normal text-slate-500">(se puede dejar para después)</span></h2>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_6.5rem_6.5rem]">
              <Campo etiqueta="Fecha" para="p-fecha" class="col-span-2 sm:col-span-1"><CampoFecha id="p-fecha" v-model="p.fecha_evento" /></Campo>
              <Campo etiqueta="Desde" para="p-hi"><CampoHora id="p-hi" v-model="p.hora_inicio" /></Campo>
              <Campo etiqueta="Hasta" para="p-hf"><CampoHora id="p-hf" v-model="p.hora_fin" /></Campo>
            </div>
            <Campo etiqueta="Espacio" para="p-esp">
              <select id="p-esp" v-model="p.espacio_id" class="entrada">
                <option value="">A definir</option>
                <option v-for="e in org.espaciosActivos" :key="e.id" :value="e.id">{{ e.nombre }}{{ org.sucursalesActivas.length > 1 ? ` · ${org.sucursales.find((s) => s.id === e.sucursal_id)?.nombre}` : '' }}</option>
              </select>
            </Campo>
            <p v-if="disponible === true" class="flex items-center gap-2 text-sm text-emerald-700"><CircleCheck class="size-4" /> La fecha está libre</p>
            <p v-else-if="disponible === false" class="flex items-center gap-2 text-sm text-rose-700"><CircleAlert class="size-4" /> Esa fecha ya está ocupada en ese espacio</p>
          </section>
        </div>

        <!-- Ítems -->
        <section class="tarjeta p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="flex items-center gap-2 text-sm font-semibold"><span class="paso">3</span> Qué incluye</h2>
            <div v-if="!soloLectura" class="flex gap-2">
              <button type="button" class="btn-primario btn-chico" @click="catalogoAbierto = true"><Package class="size-4" /> Del catálogo</button>
              <button type="button" class="btn-secundario btn-chico" @click="agregarLibre"><Plus class="size-4" /> Ítem libre</button>
            </div>
          </div>
          <ul class="mt-3 space-y-2">
            <li v-for="(i, n) in items" :key="n" class="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_6rem_8rem_9rem_7rem_auto] sm:items-center">
              <input v-model="i.descripcion" class="entrada col-span-2 sm:col-span-1" placeholder="Descripción" :aria-label="`Descripción del ítem ${n + 1}`" />
              <input v-model.number="i.cantidad" type="number" min="0" step="any" class="entrada" :aria-label="`Cantidad del ítem ${n + 1}`" />
              <select v-model="i.unidad" class="entrada" :aria-label="`Unidad del ítem ${n + 1}`">
                <option v-for="(u, k) in UNIDADES_SERVICIO" :key="k" :value="k">{{ u.corta }}</option>
              </select>
              <CampoMoneda v-model="i.precio_unitario" />
              <span class="text-right text-sm font-semibold tabular-nums">{{ fmtMoneda((i.cantidad || 0) * (i.precio_unitario || 0), true) }}</span>
              <button v-if="!soloLectura" type="button" class="btn-fantasma p-1.5 text-rose-600" :aria-label="`Quitar ítem ${n + 1}`" @click="items.splice(n, 1)"><X class="size-4" /></button>
            </li>
            <li v-if="!items.length" class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              Agregá servicios de tu catálogo o ítems libres.
            </li>
          </ul>
          <dl class="mt-4 ml-auto max-w-sm space-y-1 text-sm">
            <div class="flex justify-between"><dt class="text-slate-500">Subtotal</dt><dd class="tabular-nums">{{ fmtMoneda(subtotal) }}</dd></div>
            <div class="flex items-center justify-between gap-3"><dt class="text-slate-500">Descuento</dt><dd class="w-40"><CampoMoneda v-model="p.descuento" /></dd></div>
            <div class="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>Total</dt><dd class="tabular-nums">{{ fmtMoneda(total) }}</dd></div>
          </dl>
          <div class="mt-4 ml-auto flex max-w-sm items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
            <div>
              <p class="font-medium text-amber-900">Depósito de garantía</p>
              <p class="text-xs text-amber-800">Aparte del total. Se devuelve si no hay daños.</p>
            </div>
            <div class="w-40"><CampoMoneda v-model="p.garantia_monto" placeholder="Sin garantía" /></div>
          </div>
        </section>

        <!-- Pago y condiciones -->
        <div class="grid gap-5 lg:grid-cols-2">
          <section class="tarjeta space-y-3 p-4">
            <h2 class="flex items-center gap-2 text-sm font-semibold"><span class="paso">4</span> Forma de pago</h2>
            <div class="grid grid-cols-2 gap-3">
              <Campo etiqueta="Seña (%)" para="p-sena"><input id="p-sena" v-model.number="p.sena_porcentaje" type="number" min="0" max="100" class="entrada" /></Campo>
              <Campo etiqueta="Cuotas del saldo" para="p-cuotas"><input id="p-cuotas" v-model.number="p.cantidad_cuotas" type="number" min="0" max="24" class="entrada" /></Campo>
            </div>
            <ul v-if="plan.length" class="divide-y divide-slate-100 text-sm">
              <li v-for="(c, i) in plan" :key="i" class="flex justify-between py-1.5">
                <span>{{ c.concepto }} <span class="text-xs text-slate-500">· {{ i === 0 && c.concepto === 'Seña' ? 'al reservar' : `antes del ${fmtFecha(c.vencimiento, org.zona)}` }}</span></span>
                <span class="tabular-nums">{{ fmtMoneda(c.monto) }}</span>
              </li>
            </ul>
            <p v-if="!p.fecha_evento && plan.length > 1" class="text-xs text-slate-500">Cargá la fecha del evento para calcular los vencimientos.</p>
          </section>
          <section class="tarjeta space-y-3 p-4">
            <h2 class="flex items-center gap-2 text-sm font-semibold"><span class="paso">5</span> Vigencia y condiciones</h2>
            <Campo etiqueta="Válido hasta" para="p-validez" class="max-w-48"><CampoFecha id="p-validez" v-model="p.valido_hasta" /></Campo>
            <Campo etiqueta="Condiciones" para="p-cond"><textarea id="p-cond" v-model="p.condiciones" rows="3" class="entrada" /></Campo>
            <Campo etiqueta="Observaciones para el cliente" para="p-notas"><textarea id="p-notas" v-model="p.notas" rows="2" class="entrada" /></Campo>
          </section>
        </div>
      </fieldset>
      <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>

      <!-- Acciones -->
      <div class="fixed inset-x-0 bottom-[calc(4rem+var(--ins-bottom))] z-20 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:bottom-0 lg:left-64">
        <div class="flex flex-wrap items-center gap-2">
          <span class="w-full text-sm font-semibold tabular-nums sm:mr-auto sm:w-auto">Total {{ fmtMoneda(total) }}</span>
          <button v-if="!soloLectura" class="btn-secundario flex-1 sm:flex-none" :disabled="guardando" @click="guardarYAvisar">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
          <button class="btn-secundario flex-1 sm:flex-none" :disabled="guardando || !cliente" @click="descargar"><Download class="size-4" /> PDF</button>
          <button class="btn-primario flex-[2] sm:flex-none" :disabled="guardando || !cliente" @click="enviar"><MessageCircle class="size-4" /> WhatsApp</button>
        </div>
      </div>
    </template>

    <Modal v-model="catalogoAbierto" titulo="Agregar del catálogo" ancho="lg">
      <p v-if="!catalogo.length" class="py-6 text-center text-sm text-slate-500">
        Tu catálogo está vacío. <RouterLink :to="{ name: 'catalogo' }" class="enlace">Cargá tus servicios</RouterLink>.
      </p>
      <ul class="divide-y divide-slate-100">
        <li v-for="s in catalogo" :key="s.id">
          <button type="button" class="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-slate-50" @click="agregarDelCatalogo(s)">
            <span class="min-w-0 flex-1"><span class="block text-sm font-medium">{{ s.nombre }}</span>
              <span class="block truncate text-xs text-slate-500">{{ s.descripcion }}</span>
              <span v-if="s.personas_incluidas" class="block text-xs text-slate-500">Hasta {{ s.personas_incluidas }} personas · extra {{ fmtMoneda(s.precio_persona_extra, true) }} c/u</span></span>
            <span class="text-right text-sm font-semibold tabular-nums">{{ fmtMoneda(s.precio, true) }}<span class="block text-xs font-normal text-slate-500">{{ UNIDADES_SERVICIO[s.unidad]?.corta }}</span></span>
            <Plus class="size-4 text-marca-600" />
          </button>
        </li>
      </ul>
    </Modal>

    <Modal v-model="aceptarAbierto" titulo="El cliente aceptó el presupuesto" ancho="sm">
      <div class="space-y-3 text-sm">
        <p>Vamos a crear el evento con el total de {{ fmtMoneda(total) }} y su plan de pagos. ¿En qué estado queda?</p>
        <p v-if="!p.fecha_evento || !p.espacio_id" class="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">Antes completá la fecha y el espacio del evento.</p>
        <div role="radiogroup" class="space-y-2">
          <button v-for="e in (['tentativa', 'confirmada'] as const)" :key="e" type="button" role="radio" :aria-checked="estadoEvento === e"
                  :class="['w-full rounded-lg p-3 text-left ring-1', estadoEvento === e ? 'bg-marca-50 ring-2 ring-marca-500' : 'ring-slate-300']" @click="estadoEvento = e">
            <span class="block font-semibold">{{ ESTADOS_RESERVA[e].etiqueta }}</span><span class="text-xs text-slate-500">{{ ESTADOS_RESERVA[e].ayuda }}</span>
          </button>
        </div>
      </div>
      <template #pie>
        <button class="btn-secundario" @click="aceptarAbierto = false">Cancelar</button>
        <button class="btn-primario" :disabled="aceptando || !p.fecha_evento || !p.espacio_id" @click="aceptar">{{ aceptando ? 'Creando evento…' : 'Crear el evento' }}</button>
      </template>
    </Modal>
  </div>
</template>
