<script setup lang="ts">
// Alta y edición de reservas. La disponibilidad se consulta en vivo a la base
// (verificar_disponibilidad), pero la garantía contra superposiciones la da la
// restricción EXCLUDE al guardar con guardar_reserva().
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDown, CircleAlert, CircleCheck, LoaderCircle, Search, TriangleAlert, UserPlus } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoHora from '@/components/ui/CampoHora.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import Ayuda from '@/components/ui/Ayuda.vue'
import type { EstadoContrato, EstadoReserva, Fila } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { aLocal, desdeLocal, fmtFechaHora, fmtMoneda, hoyISO, sumarDiasISO } from '@/lib/formato'
import { ESTADOS_CONTRATO, ESTADOS_RESERVA, TIPOS_EVENTO } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'
import { useSesion } from '@/stores/sesion'
import { useNotificaciones } from '@/composables/useNotificaciones'

interface Conflicto { espacio: string; desde: string; hasta: string; numero?: number; titulo?: string; bloqueo: boolean; motivo?: string; reserva_id?: string }
interface Disponibilidad { disponible: boolean; conflictos: Conflicto[]; avisos: string[] }
interface Miembro { usuario_id: string; nombre: string; email: string; activo: boolean }
interface EspacioElegido { espacio_id: string; antes_min: number | null; despues_min: number | null }

const org = useOrganizacion()
const acciones = useAcciones()
const sesion = useSesion()
const router = useRouter()
const { exito } = useNotificaciones()

const abierto = computed({ get: () => acciones.reservaAbierta, set: (v) => { acciones.reservaAbierta = v } })
const editando = computed(() => !!acciones.reservaId)

const vacio = () => ({
  cliente_id: '' as string,
  cliente_nombre: '',
  titulo: '',
  tituloTocado: false,
  tipo_evento: 'cumpleanos',
  estado: 'consulta' as EstadoReserva,
  contrato_estado: 'pendiente' as EstadoContrato,
  sucursal_id: '',
  espacios: [] as EspacioElegido[],
  fecha: '',
  fecha_fin: '',
  varios_dias: false,
  hora_inicio: '21:00',
  hora_fin: '04:00',
  invitados: null as number | null,
  precio_total: null as number | null,
  responsable_id: '',
  notas: '',
  motivo_cancelacion: '',
})
const f = reactive(vacio())
const original = ref<Fila<'reservas'> | null>(null)
const errores = reactive<Record<string, string>>({})
const errorGeneral = ref('')
const guardando = ref(false)
const cargando = ref(false)
const fechaInvalida = ref(false)
const miembros = ref<Miembro[]>([])
const verTiempos = ref(false)

// --- Cliente ---------------------------------------------------------------
const busquedaCliente = ref('')
const sugerencias = ref<Array<Pick<Fila<'clientes'>, 'id' | 'nombre' | 'telefono' | 'email'>>>([])
const nuevoCliente = reactive({ activo: false, nombre: '', telefono: '', email: '' })
let tBusqueda: ReturnType<typeof setTimeout> | undefined

watch(busquedaCliente, (q) => {
  clearTimeout(tBusqueda)
  if (q.trim().length < 2 || f.cliente_id) { sugerencias.value = []; return }
  tBusqueda = setTimeout(async () => {
    sugerencias.value = await api.get<typeof sugerencias.value>(rutaOrg(org.id, 'clientes/buscar'), { q, limite: 6 }).catch(() => [])
  }, 200)
})
function elegirCliente(c: { id: string; nombre: string }) {
  f.cliente_id = c.id
  f.cliente_nombre = c.nombre
  busquedaCliente.value = c.nombre
  sugerencias.value = []
  nuevoCliente.activo = false
  sugerirTitulo()
}
function quitarCliente() {
  f.cliente_id = ''
  f.cliente_nombre = ''
  busquedaCliente.value = ''
}
function crearClienteNuevo() {
  nuevoCliente.activo = true
  nuevoCliente.nombre = busquedaCliente.value.trim()
  sugerencias.value = []
}

function sugerirTitulo() {
  if (f.tituloTocado) return
  const nombre = f.cliente_nombre || nuevoCliente.nombre
  f.titulo = nombre ? `${TIPOS_EVENTO[f.tipo_evento]} · ${nombre}` : ''
}
watch(() => [f.tipo_evento, nuevoCliente.nombre], sugerirTitulo)

// --- Sedes ----------------------------------------------------------------
const sucursales = computed(() => org.sucursalesActivas.filter((s) => org.espaciosActivos.some((e) => e.sucursal_id === s.id)))
const espaciosSucursal = computed(() => org.espaciosActivos.filter((e) => e.sucursal_id === f.sucursal_id))
function espacioElegido(id: string) {
  return f.espacios.find((e) => e.espacio_id === id)
}
function alternarEspacio(id: string) {
  const i = f.espacios.findIndex((e) => e.espacio_id === id)
  if (i >= 0) f.espacios.splice(i, 1)
  else f.espacios.push({ espacio_id: id, antes_min: null, despues_min: null })
}
watch(() => f.sucursal_id, (nueva, anterior) => {
  if (anterior && nueva !== anterior) f.espacios = f.espacios.filter((e) => espaciosSucursal.value.some((x) => x.id === e.espacio_id))
})
const capacidadElegida = computed(() => f.espacios.reduce((s, e) => s + (org.espacios.find((x) => x.id === e.espacio_id)?.capacidad_maxima ?? 0), 0))
// Mínimo de invitados: el mayor mínimo entre los espacios elegidos (es solo un aviso).
const minimoElegido = computed(() => Math.max(0, ...f.espacios.map((e) => org.espacios.find((x) => x.id === e.espacio_id)?.capacidad_minima ?? 0)))
const avisoInvitados = computed(() => {
  if (!f.invitados) return ''
  if (capacidadElegida.value && f.invitados > capacidadElegida.value) return `Supera la capacidad de ${capacidadElegida.value} personas.`
  if (minimoElegido.value && f.invitados < minimoElegido.value) return `El mínimo para este espacio es de ${minimoElegido.value} invitados.`
  return ''
})
const tieneServicios = ref(false)

// --- Fechas ---------------------------------------------------------------
const rango = computed<{ inicio: string; fin: string } | null>(() => {
  if (!f.fecha || !f.hora_inicio || !f.hora_fin) return null
  let fechaFin = f.fecha
  if (f.varios_dias) {
    if (!f.fecha_fin) return null
    fechaFin = f.fecha_fin
  } else if (f.hora_fin <= f.hora_inicio) {
    fechaFin = sumarDiasISO(f.fecha, 1)
  }
  return { inicio: desdeLocal(f.fecha, f.hora_inicio, org.zona), fin: desdeLocal(fechaFin, f.hora_fin, org.zona) }
})
const pasaMedianoche = computed(() => !f.varios_dias && f.hora_fin && f.hora_inicio && f.hora_fin <= f.hora_inicio)
const duracionTexto = computed(() => {
  if (!rango.value) return ''
  const min = (new Date(rango.value.fin).getTime() - new Date(rango.value.inicio).getTime()) / 6e4
  if (min <= 0) return ''
  const h = Math.floor(min / 60), m = min % 60
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h${m ? ` ${m} min` : ''}`
})

// --- Disponibilidad en vivo ------------------------------------------------
const disponibilidad = ref<Disponibilidad | null>(null)
const verificando = ref(false)
let tDisp: ReturnType<typeof setTimeout> | undefined
let nDisp = 0
watch(() => [rango.value?.inicio, rango.value?.fin, f.espacios.map((e) => e.espacio_id).join(','), f.invitados, abierto.value], () => {
  clearTimeout(tDisp)
  disponibilidad.value = null
  if (!abierto.value || !rango.value || !f.espacios.length) return
  tDisp = setTimeout(async () => {
    const n = ++nDisp
    verificando.value = true
    const data = await api.post<Disponibilidad>(rutaOrg(org.id, 'disponibilidad'), {
      espacios: f.espacios.map((e) => e.espacio_id), inicio: rango.value!.inicio, fin: rango.value!.fin,
      excluir: acciones.reservaId, invitados: f.invitados,
    }).catch(() => null)
    if (n !== nDisp) return
    verificando.value = false
    disponibilidad.value = data
  }, 350)
})
const bloquea = computed(() => ['tentativa', 'senada', 'confirmada', 'finalizada'].includes(f.estado))

// --- Carga ----------------------------------------------------------------
watch(abierto, async (v) => {
  if (!v) return
  Object.assign(f, vacio())
  Object.keys(errores).forEach((k) => delete errores[k])
  errorGeneral.value = ''
  original.value = null
  busquedaCliente.value = ''
  Object.assign(nuevoCliente, { activo: false, nombre: '', telefono: '', email: '' })
  verTiempos.value = false
  tieneServicios.value = false
  masOpciones.value = false
  void cargarMiembros()

  if (acciones.reservaId) {
    cargando.value = true
    try {
      const r = await api.get<Fila<'reservas'> & {
        clientes: { nombre: string } | null
        reserva_espacios: Array<{ espacio_id: string; antes_min: number; despues_min: number }>
        reserva_items: Array<{ id: string }>
      }>(`/reservas/${acciones.reservaId}`)
      original.value = r
      tieneServicios.value = ((r as unknown as { reserva_items: unknown[] }).reserva_items ?? []).length > 0
      const ini = aLocal(r.inicio, org.zona), fin = aLocal(r.fin, org.zona)
      const variosDias = fin.fecha !== ini.fecha && !(fin.fecha === sumarDiasISO(ini.fecha, 1) && fin.hora <= ini.hora)
      Object.assign(f, {
        cliente_id: r.cliente_id, cliente_nombre: (r.clientes as { nombre: string } | null)?.nombre ?? '',
        titulo: r.titulo, tituloTocado: true, tipo_evento: r.tipo_evento, estado: r.estado, contrato_estado: r.contrato_estado,
        sucursal_id: r.sucursal_id,
        espacios: (r.reserva_espacios as EspacioElegido[]).map((e) => ({ ...e })),
        fecha: ini.fecha, hora_inicio: ini.hora, hora_fin: fin.hora, varios_dias: variosDias, fecha_fin: variosDias ? fin.fecha : '',
        invitados: r.invitados, precio_total: Number(r.precio_total), responsable_id: r.responsable_id ?? '',
        notas: r.notas ?? '', motivo_cancelacion: r.motivo_cancelacion ?? '',
      })
      busquedaCliente.value = f.cliente_nombre
    } catch (e) {
      errorGeneral.value = traducirError(e)
    } finally {
      cargando.value = false
    }
  } else {
    const p = acciones.precarga
    f.fecha = p.fecha ?? ''
    if (p.horaInicio) f.hora_inicio = p.horaInicio
    if (p.horaFin) f.hora_fin = p.horaFin
    f.responsable_id = sesion.usuario?.id ?? ''
    const esp = p.espacioId ? org.espacios.find((e) => e.id === p.espacioId) : undefined
    f.sucursal_id = esp?.sucursal_id ?? sucursales.value[0]?.id ?? ''
    if (esp) f.espacios = [{ espacio_id: esp.id, antes_min: null, despues_min: null }]
    else if (espaciosSucursal.value.length === 1) f.espacios = [{ espacio_id: espaciosSucursal.value[0]!.id, antes_min: null, despues_min: null }]
    if (p.clienteId) {
      const data = await api.get<{ id: string; nombre: string }>(`/clientes/${p.clienteId}`).catch(() => null)
      if (data) elegirCliente({ id: data.id, nombre: data.nombre })
    }
  }
})

async function cargarMiembros() {
  const data = await api.get<Miembro[]>(rutaOrg(org.id, 'miembros')).catch(() => [])
  miembros.value = data.filter((m) => m.activo)
}

// --- Guardado -------------------------------------------------------------
function validar(): boolean {
  Object.keys(errores).forEach((k) => delete errores[k])
  if (!f.cliente_id && !nuevoCliente.activo) errores.cliente = 'Escribí el nombre del cliente y elegilo, o cargalo como nuevo.'
  if (nuevoCliente.activo && nuevoCliente.nombre.trim().length < 2) errores.cliente = 'Ingresá el nombre del cliente.'
  if (nuevoCliente.activo && nuevoCliente.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nuevoCliente.email)) errores.cliente = 'El email del cliente no es válido.'
  if (!f.titulo.trim()) f.titulo = `${TIPOS_EVENTO[f.tipo_evento]}${f.cliente_nombre || nuevoCliente.nombre ? ' · ' + (f.cliente_nombre || nuevoCliente.nombre.trim()) : ''}`
  if (f.titulo.trim().length < 2) errores.titulo = 'Ingresá un nombre para identificar el evento.'
  if (!f.sucursal_id) errores.sucursal = 'Elegí el salón.'
  if (!f.espacios.length && f.estado !== 'consulta' && f.estado !== 'cancelada') errores.espacios = 'Elegí al menos un espacio.'
  if (!f.fecha || fechaInvalida.value) errores.fecha = 'Ingresá una fecha válida.'
  if (f.varios_dias && (!f.fecha_fin || f.fecha_fin < f.fecha)) errores.fecha_fin = 'La fecha de fin debe ser igual o posterior al inicio.'
  if (rango.value && new Date(rango.value.fin) <= new Date(rango.value.inicio)) errores.hora_fin = 'El fin debe ser posterior al inicio.'
  if (f.invitados !== null && f.invitados < 1) errores.invitados = 'Ingresá un número mayor a 0.'
  if (f.estado === 'cancelada' && !f.motivo_cancelacion.trim()) errores.motivo = 'Indicá el motivo de la cancelación.'
  if (errores.titulo || errores.fecha_fin) masOpciones.value = true
  return Object.keys(errores).length === 0
}

async function guardar() {
  errorGeneral.value = ''
  if (!validar() || !rango.value) return
  guardando.value = true
  try {
    let clienteId = f.cliente_id
    if (nuevoCliente.activo) {
      clienteId = (await api.post<{ id: string }>(rutaOrg(org.id, 'clientes'), {
        nombre: nuevoCliente.nombre.trim(), telefono: nuevoCliente.telefono.trim() || null, email: nuevoCliente.email.trim().toLowerCase() || null,
      })).id
      f.cliente_id = clienteId
      nuevoCliente.activo = false
    }
    const datos: Record<string, unknown> = {
      sucursal_id: f.sucursal_id, cliente_id: clienteId, titulo: f.titulo.trim(), tipo_evento: f.tipo_evento,
      estado: f.estado, inicio: rango.value.inicio, fin: rango.value.fin,
      invitados: f.invitados, precio_total: f.precio_total ?? 0, responsable_id: f.responsable_id || null,
      notas: f.notas.trim() || null,
    }
    if (f.estado === 'cancelada') datos.motivo_cancelacion = f.motivo_cancelacion.trim()
    if (org.puede('contratos.gestionar') && (!original.value || original.value.contrato_estado !== f.contrato_estado)) {
      datos.contrato_estado = f.contrato_estado
    }
    const cuerpo = { datos, espacios: f.espacios }
    const { id } = acciones.reservaId
      ? await api.put<{ id: string }>(rutaOrg(org.id, `reservas/${acciones.reservaId}`), cuerpo)
      : await api.post<{ id: string }>(rutaOrg(org.id, 'reservas'), cuerpo)
    exito(editando.value ? 'Reserva actualizada.' : 'Reserva creada.')
    acciones.cambiosGuardados()
    abierto.value = false
    if (!editando.value) void router.push({ name: 'reserva', params: { id } })
  } catch (e) {
    errorGeneral.value = traducirError(e)
  } finally {
    guardando.value = false
  }
}

// Estados que se eligen al cargar: los mismos tres pasos que usa el rubro
// (consulta → fecha retenida → confirmada). "Señada" se da sola al registrar la seña.
const estadosRapidos = computed<EstadoReserva[]>(() => {
  const lista: EstadoReserva[] = ['consulta', 'tentativa', 'confirmada']
  if (original.value && !lista.includes(original.value.estado)) lista.splice(2, 0, original.value.estado)
  return lista
})
const masOpciones = ref(false)
const hoy = computed(() => hoyISO(org.zona))
const sinSedes = computed(() => !org.tieneSedes)
</script>

<template>
  <Modal v-model="abierto" :titulo="editando ? `Editar evento #${original?.numero ?? ''}` : 'Nueva reserva'" ancho="lg">
    <div v-if="sinSedes" class="py-6 text-center text-sm text-slate-600">
      Primero cargá al menos un espacio en
      <RouterLink to="/configuracion/sedes" class="enlace" @click="abierto = false">Ajustes → Sedes y espacios</RouterLink>.
    </div>
    <div v-else-if="cargando" class="py-10 text-center text-sm text-slate-500">Cargando…</div>
    <form v-else id="form-reserva" class="space-y-6" novalidate @submit.prevent="guardar">
      <!-- 1. Quién -->
      <fieldset class="space-y-2">
        <legend class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><span class="paso">1</span> ¿Para quién?</legend>
        <div v-if="!nuevoCliente.activo" class="relative">
          <Search class="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <input id="cliente" v-model="busquedaCliente" :class="['entrada pl-9', errores.cliente && 'entrada-error']" placeholder="Escribí el nombre o teléfono del cliente"
                 aria-label="Cliente" autocomplete="off" :readonly="!!f.cliente_id" @focus="f.cliente_id && ($event.target as HTMLInputElement).select()" />
          <button v-if="f.cliente_id" type="button" class="absolute right-2 top-1.5 btn-fantasma btn-chico" @click="quitarCliente">Cambiar</button>
          <ul v-if="sugerencias.length || (busquedaCliente.trim().length >= 2 && !f.cliente_id)"
              class="absolute z-20 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
            <li v-for="c in sugerencias" :key="c.id">
              <button type="button" class="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" @click="elegirCliente(c)">
                <span class="font-medium">{{ c.nombre }}</span>
                <span class="ml-2 text-xs text-slate-500">{{ [c.telefono, c.email].filter(Boolean).join(' · ') }}</span>
              </button>
            </li>
            <li v-if="org.puede('clientes.gestionar')">
              <button type="button" class="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-marca-700 hover:bg-marca-50"
                      @click="crearClienteNuevo">
                <UserPlus class="size-4" /> Es un cliente nuevo: “{{ busquedaCliente.trim() }}”
              </button>
            </li>
          </ul>
        </div>
        <div v-else class="grid gap-2 rounded-lg bg-marca-50/60 p-3 sm:grid-cols-2">
          <input v-model="nuevoCliente.nombre" class="entrada" placeholder="Nombre y apellido" aria-label="Nombre del cliente" />
          <input v-model="nuevoCliente.telefono" class="entrada" placeholder="WhatsApp / teléfono" type="tel" aria-label="Teléfono" />
          <input v-model="nuevoCliente.email" class="entrada sm:col-span-2" placeholder="Email (opcional)" type="email" aria-label="Email" />
          <button type="button" class="enlace text-left text-xs" @click="nuevoCliente.activo = false">← Buscar un cliente que ya cargué</button>
        </div>
        <p v-if="errores.cliente" class="text-xs text-rose-600" role="alert">{{ errores.cliente }}</p>
      </fieldset>

      <!-- 2. Cuándo y dónde -->
      <fieldset class="space-y-3">
        <legend class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><span class="paso">2</span> ¿Cuándo y dónde?</legend>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_7rem_7rem]">
          <Campo etiqueta="Fecha" para="fecha" :error="errores.fecha" class="col-span-2 sm:col-span-1">
            <CampoFecha id="fecha" v-model="f.fecha" :min="editando ? undefined : hoy" @invalida="fechaInvalida = $event" />
          </Campo>
          <Campo etiqueta="Desde" para="hi"><CampoHora id="hi" v-model="f.hora_inicio" /></Campo>
          <Campo etiqueta="Hasta" para="hf" :error="errores.hora_fin"><CampoHora id="hf" v-model="f.hora_fin" /></Campo>
        </div>
        <p v-if="pasaMedianoche || duracionTexto" class="-mt-1 text-xs text-slate-500">
          {{ [pasaMedianoche ? 'Termina al día siguiente' : '', duracionTexto ? `dura ${duracionTexto}` : ''].filter(Boolean).join(' · ') }}
        </p>

        <select v-if="sucursales.length > 1" id="suc" v-model="f.sucursal_id" class="entrada" aria-label="Salón">
          <option v-for="s in sucursales" :key="s.id" :value="s.id">{{ s.nombre }}</option>
        </select>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Espacios">
          <button v-for="e in espaciosSucursal" :key="e.id" type="button" :aria-pressed="!!espacioElegido(e.id)"
                  :class="['flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm ring-1 transition',
                           espacioElegido(e.id) ? 'bg-marca-50 font-medium text-marca-800 ring-2 ring-marca-500' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50']"
                  @click="alternarEspacio(e.id)">
            <span class="size-2.5 rounded-full" :style="{ background: e.color }" />
            {{ e.nombre }} <span class="text-xs text-slate-400">hasta {{ e.capacidad_maxima }}</span>
          </button>
        </div>
        <p v-if="errores.espacios" class="text-xs text-rose-600" role="alert">{{ errores.espacios }}</p>

        <!-- Disponibilidad en vivo -->
        <div v-if="f.espacios.length && rango" aria-live="polite">
          <p v-if="verificando" class="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle class="size-4 animate-spin" /> Revisando la agenda…</p>
          <template v-else-if="disponibilidad">
            <div v-if="disponibilidad.conflictos.length" :class="['rounded-lg p-3 text-sm', bloquea ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800']">
              <p class="flex items-center gap-2 font-medium"><CircleAlert class="size-4" />
                {{ bloquea ? 'Esa fecha ya está ocupada' : 'Esa fecha está ocupada: podés anotarla como consulta, pero no reservarla' }}
              </p>
              <ul class="mt-1 space-y-0.5 pl-6 text-xs">
                <li v-for="(c, i) in disponibilidad.conflictos" :key="i">
                  {{ c.espacio }}: {{ c.bloqueo ? `cerrado (${c.motivo})` : `${c.titulo ?? 'otro evento'}` }},
                  {{ fmtFechaHora(c.desde, org.zona) }} a {{ fmtFechaHora(c.hasta, org.zona) }} (con armado y limpieza)
                </li>
              </ul>
            </div>
            <p v-else class="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"><CircleCheck class="size-4" /> Disponible</p>
            <ul v-if="disponibilidad.avisos.length" class="mt-2 space-y-1">
              <li v-for="(a, i) in disponibilidad.avisos" :key="i" class="flex items-start gap-2 text-xs text-amber-700">
                <TriangleAlert class="mt-0.5 size-3.5 shrink-0" /> {{ a }}
              </li>
            </ul>
          </template>
        </div>
      </fieldset>

      <!-- 3. Qué evento -->
      <fieldset class="space-y-3">
        <legend class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><span class="paso">3</span> ¿Qué evento es?</legend>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo etiqueta="Tipo" para="tipo" class="col-span-2 sm:col-span-1">
            <select id="tipo" v-model="f.tipo_evento" class="entrada">
              <option v-for="(t, k) in TIPOS_EVENTO" :key="k" :value="k">{{ t }}</option>
            </select>
          </Campo>
          <Campo etiqueta="Invitados" para="inv" :error="errores.invitados">
            <input id="inv" v-model.number="f.invitados" type="number" min="1" :class="['entrada', avisoInvitados && 'ring-amber-400']"
                   :placeholder="capacidadElegida ? (minimoElegido ? `${minimoElegido} a ${capacidadElegida}` : `máx. ${capacidadElegida}`) : ''" />
            <p v-if="avisoInvitados" class="mt-1 text-xs text-amber-700">{{ avisoInvitados }}</p>
          </Campo>
          <Campo etiqueta="Precio total" para="precio" :ayuda="tieneServicios ? 'Se calcula con los servicios contratados.' : undefined">
            <CampoMoneda v-if="!tieneServicios" id="precio" v-model="f.precio_total" />
            <p v-else class="entrada bg-slate-50 tabular-nums text-slate-600">{{ fmtMoneda(f.precio_total) }}</p>
          </Campo>
        </div>

        <div role="radiogroup" aria-label="Estado" class="grid gap-2 sm:grid-cols-3">
          <button v-for="e in estadosRapidos" :key="e" type="button" role="radio" :aria-checked="f.estado === e"
                  :class="['rounded-xl p-3 text-left ring-1 transition', f.estado === e ? 'bg-marca-50 ring-2 ring-marca-500' : 'bg-white ring-slate-300 hover:bg-slate-50']"
                  @click="f.estado = e">
            <span class="flex items-center gap-2 text-sm font-semibold"><span :class="['size-2 rounded-full', ESTADOS_RESERVA[e].punto]" />{{ ESTADOS_RESERVA[e].etiqueta }}</span>
            <span class="mt-0.5 block text-xs text-slate-500">{{ ESTADOS_RESERVA[e].ayuda }}</span>
          </button>
        </div>
        <Campo v-if="f.estado === 'cancelada'" etiqueta="Motivo de cancelación" para="motivo" :error="errores.motivo">
          <input id="motivo" v-model="f.motivo_cancelacion" class="entrada" />
        </Campo>
      </fieldset>

      <!-- Más opciones -->
      <div class="rounded-xl ring-1 ring-slate-200">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700" :aria-expanded="masOpciones" @click="masOpciones = !masOpciones">
          Más opciones <span class="text-xs font-normal text-slate-500">nombre del evento, notas, responsable, contrato…</span>
          <ChevronDown :class="['size-4 transition', masOpciones && 'rotate-180']" />
        </button>
        <div v-if="masOpciones" class="space-y-3 border-t border-slate-100 p-4">
          <Campo etiqueta="Nombre del evento" para="titulo" :error="errores.titulo" ayuda="Se completa solo; cambialo si querés.">
            <input id="titulo" v-model="f.titulo" class="entrada" placeholder="Ej.: 15 de Sofía" @input="f.tituloTocado = true" />
          </Campo>
          <Campo etiqueta="Notas" para="notas">
            <textarea id="notas" v-model="f.notas" rows="2" class="entrada" placeholder="Menú, pedidos especiales, proveedores…" />
          </Campo>
          <div class="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Responsable" para="resp">
              <select id="resp" v-model="f.responsable_id" class="entrada">
                <option value="">Sin asignar</option>
                <option v-for="m in miembros" :key="m.usuario_id" :value="m.usuario_id">{{ m.nombre || m.email }}</option>
              </select>
            </Campo>
            <Campo v-if="org.puede('contratos.gestionar')" etiqueta="Contrato" para="contrato">
              <select id="contrato" v-model="f.contrato_estado" class="entrada">
                <option v-for="(t, k) in ESTADOS_CONTRATO" :key="k" :value="k">{{ t }}</option>
              </select>
            </Campo>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="f.varios_dias" type="checkbox" class="rounded border-slate-300 text-marca-600" /> Dura varios días
          </label>
          <Campo v-if="f.varios_dias" etiqueta="Último día" para="ff" :error="errores.fecha_fin" class="max-w-56">
            <CampoFecha id="ff" v-model="f.fecha_fin" />
          </Campo>
          <div v-if="f.espacios.length">
            <p class="text-sm font-medium text-slate-700">Armado y limpieza (minutos)
              <Ayuda texto="El espacio queda ocupado desde que empieza el armado hasta que termina la limpieza. Si no completás nada, se usan los tiempos de cada espacio." /></p>
            <div v-for="e in f.espacios" :key="e.espacio_id" class="mt-2 grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-2 text-sm">
              <span class="truncate">{{ org.espacios.find((x) => x.id === e.espacio_id)?.nombre }}</span>
              <input v-model.number="e.antes_min" type="number" min="0" class="entrada" aria-label="Minutos de armado antes"
                     :placeholder="`${(org.espacios.find((x) => x.id === e.espacio_id)?.preparacion_min ?? 0) + (org.espacios.find((x) => x.id === e.espacio_id)?.montaje_min ?? 0)} antes`" />
              <input v-model.number="e.despues_min" type="number" min="0" class="entrada" aria-label="Minutos de limpieza después"
                     :placeholder="`${(org.espacios.find((x) => x.id === e.espacio_id)?.desmontaje_min ?? 0) + (org.espacios.find((x) => x.id === e.espacio_id)?.limpieza_min ?? 0)} después`" />
            </div>
          </div>
        </div>
      </div>

      <p v-if="errorGeneral" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorGeneral }}</p>
    </form>

    <template v-if="!sinSedes" #pie>
      <button type="button" class="btn-secundario" @click="abierto = false">Cancelar</button>
      <button type="submit" form="form-reserva" class="btn-primario" :disabled="guardando || cargando">
        {{ guardando ? 'Guardando…' : editando ? 'Guardar cambios' : f.estado === 'consulta' ? 'Guardar consulta' : 'Reservar' }}
      </button>
    </template>
  </Modal>
</template>
