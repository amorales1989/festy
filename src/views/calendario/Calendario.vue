<script setup lang="ts">
// Módulo 2 · Calendario y disponibilidad. Vistas mensual, semanal y diaria
// (la diaria muestra una columna por espacio). Estado en la URL para poder
// compartir enlaces.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { Ban, ChevronLeft, ChevronRight, Lock, MessagesSquare, Plus, SlidersHorizontal, Trash2, X } from 'lucide-vue-next'
import VistaMes from '@/components/calendario/VistaMes.vue'
import VistaTiempo from '@/components/calendario/VistaTiempo.vue'
import FormBloqueo from '@/components/calendario/FormBloqueo.vue'
import Modal from '@/components/ui/Modal.vue'
import { cargarAgenda, diasDelItem, type Columna, type ItemAgenda } from '@/components/calendario/agenda'
import VistaLista from '@/components/calendario/VistaLista.vue'
import InsigniaEstado from '@/components/ui/InsigniaEstado.vue'
import type { EstadoReserva } from '@/lib/supabase'
import { eliminar as eliminarRegistro } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { aFechaISO, fechaDeISO, fmtDiaLargo, fmtFechaHora, fmtHora, hoyISO, parsearFechaAR } from '@/lib/formato'
import { ESTADOS_RESERVA, ORDEN_ESTADOS, TIPOS_BLOQUEO } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

type Vista = 'lista' | 'mes' | 'semana' | 'dia'
const org = useOrganizacion()
const acciones = useAcciones()
const route = useRoute()
const router = useRouter()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()

const hoy = computed(() => hoyISO(org.zona))
const q = route.query
const estado = reactive({
  vista: (['lista', 'mes', 'semana', 'dia'].includes(String(q.vista)) ? q.vista : (window.innerWidth < 640 ? 'lista' : 'mes')) as Vista,
  fecha: typeof q.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.fecha) ? q.fecha : hoyISO(org.zona),
  sucursal: typeof q.sucursal === 'string' ? q.sucursal : '',
  espacio: typeof q.espacio === 'string' ? q.espacio : '',
  estados: [] as EstadoReserva[],
  canceladas: false,
})

const items = ref<ItemAgenda[]>([])
const cargando = ref(false)
const error = ref('')
const bloqueoAbierto = ref(false)
const bloqueoSel = ref<ItemAgenda | null>(null)
const irA = ref('')

const sucursal = computed(() => estado.sucursal || (org.sucursalesActivas.length === 1 ? org.sucursalesActivas[0]!.id : ''))
const espaciosVisibles = computed(() => org.espaciosActivos.filter((e) =>
  (!sucursal.value || e.sucursal_id === sucursal.value) && (!estado.espacio || e.id === estado.espacio)))

const rango = computed(() => {
  const base = fechaDeISO(estado.fecha)
  if (estado.vista === 'lista') return { desde: aFechaISO(startOfMonth(base)), hasta: aFechaISO(endOfMonth(base)) }
  if (estado.vista === 'mes') {
    return { desde: aFechaISO(startOfWeek(startOfMonth(base), { weekStartsOn: 1 })), hasta: aFechaISO(endOfWeek(endOfMonth(base), { weekStartsOn: 1 })) }
  }
  if (estado.vista === 'semana') {
    return { desde: aFechaISO(startOfWeek(base, { weekStartsOn: 1 })), hasta: aFechaISO(endOfWeek(base, { weekStartsOn: 1 })) }
  }
  return { desde: estado.fecha, hasta: estado.fecha }
})

const titulo = computed(() => {
  const base = fechaDeISO(estado.fecha)
  if (estado.vista === 'mes' || estado.vista === 'lista') return format(base, 'MMMM yyyy', { locale: es })
  if (estado.vista === 'dia') return format(base, "EEEE d 'de' MMMM yyyy", { locale: es })
  const ini = fechaDeISO(rango.value.desde), fin = fechaDeISO(rango.value.hasta)
  return `${format(ini, 'd MMM', { locale: es })} – ${format(fin, 'd MMM yyyy', { locale: es })}`
})

const columnas = computed<Columna[]>(() => {
  if (estado.vista === 'dia') {
    return espaciosVisibles.value.map((e) => ({ clave: e.id, etiqueta: e.nombre, sub: `${e.capacidad_maxima} pers.`, dia: estado.fecha, espacioId: e.id, color: e.color }))
  }
  const cols: Columna[] = []
  for (let d = rango.value.desde; d <= rango.value.hasta; d = aFechaISO(addDays(fechaDeISO(d), 1))) {
    const f = fechaDeISO(d)
    cols.push({ clave: d, etiqueta: format(f, 'EEE d', { locale: es }), dia: d })
  }
  return cols
})

async function cargar() {
  if (!org.id) return
  cargando.value = true
  error.value = ''
  try {
    items.value = await cargarAgenda(org.id, rango.value.desde, rango.value.hasta, org.zona, {
      sucursalId: sucursal.value || undefined,
      espacioIds: estado.espacio ? [estado.espacio] : undefined,
      estados: estado.estados.length ? estado.estados : undefined,
      incluirCanceladas: estado.canceladas,
    })
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}

watch(() => [estado.vista, estado.fecha, estado.sucursal, estado.espacio], () => {
  const query: Record<string, string> = { vista: estado.vista, fecha: estado.fecha }
  if (estado.sucursal) query.sucursal = estado.sucursal
  if (estado.espacio) query.espacio = estado.espacio
  void router.replace({ query })
})
watch(() => [rango.value.desde, rango.value.hasta, sucursal.value, estado.espacio, estado.estados.join(), estado.canceladas], cargar)
watch(() => acciones.version, cargar)
watch(() => estado.sucursal, () => {
  if (estado.espacio && !org.espacios.some((e) => e.id === estado.espacio && e.sucursal_id === estado.sucursal)) estado.espacio = ''
})
onMounted(cargar)

function mover(delta: number) {
  const base = fechaDeISO(estado.fecha)
  const nueva = estado.vista === 'mes' || estado.vista === 'lista' ? addMonths(base, delta) : addDays(base, estado.vista === 'semana' ? 7 * delta : delta)
  estado.fecha = aFechaISO(nueva)
}
function irAFecha() {
  const iso = parsearFechaAR(irA.value)
  if (iso) { estado.fecha = iso; irA.value = '' }
  else notificarError('Fecha inválida. Usá el formato DD/MM/AAAA.')
}
function alternarEstado(e: EstadoReserva) {
  const i = estado.estados.indexOf(e)
  if (i >= 0) estado.estados.splice(i, 1)
  else estado.estados.push(e)
}

function elegirItem(it: ItemAgenda) {
  if (it.tipo === 'reserva') void router.push({ name: 'reserva', params: { id: it.id } })
  else if (it.tipo === 'bloqueo') bloqueoSel.value = it
  else if (it.tipo === 'entrevista') acciones.verEntrevista(it.id)
}
const diaSel = ref<string | null>(null)
function elegirDia(dia: string) {
  diaSel.value = diaSel.value === dia ? null : dia
}
function verHorarios(dia: string) {
  estado.fecha = dia
  estado.vista = 'dia'
  diaSel.value = null
}
const itemsDiaSel = computed(() => !diaSel.value ? [] : items.value
  .filter((i) => i.tipo !== 'feriado' && diasDelItem(i, org.zona, true).includes(diaSel.value!))
  .sort((a, b) => a.inicio.localeCompare(b.inicio)))
const verFiltros = ref(false)
const filtrosActivos = computed(() => estado.estados.length + (estado.canceladas ? 1 : 0))
function nuevaEn(dia: string, hora?: string, espacioId?: string) {
  if (!org.puede('reservas.crear')) return
  const hi = hora ?? '21:00'
  const [h, m] = hi.split(':').map(Number)
  const fin = `${String(((h ?? 0) + 5) % 24).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`
  acciones.nuevaReserva({ fecha: dia, horaInicio: hi, horaFin: fin, espacioId: espacioId ?? (estado.espacio || undefined) })
}

async function quitarBloqueo() {
  const b = bloqueoSel.value
  if (!b) return
  const ok = await confirmar({ titulo: 'Quitar bloqueo', mensaje: 'El espacio volverá a estar disponible en ese período.', confirmar: 'Quitar', peligro: true })
  if (!ok) return
  try {
    await eliminarRegistro('bloqueos', b.id)
    exito('Bloqueo eliminado.')
    bloqueoSel.value = null
    void cargar()
  } catch (e) {
    notificarError(e)
  }
}
const bloqueoAbiertoDetalle = computed({ get: () => !!bloqueoSel.value, set: (v) => { if (!v) bloqueoSel.value = null } })
const nombreEspacio = (id: string) => org.espacios.find((e) => e.id === id)?.nombre ?? ''
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="titulo-pagina">Agenda</h1>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="org.puede('entrevistas.gestionar')" class="btn-secundario" @click="acciones.nuevaEntrevista({ fecha: diaSel ?? (estado.vista === 'mes' || estado.vista === 'lista' ? undefined : estado.fecha) })"><MessagesSquare class="size-4" /> Agendar entrevista</button>
        <button v-if="org.puede('bloqueos.gestionar')" class="btn-fantasma" @click="bloqueoAbierto = true"><Ban class="size-4" /> Cerrar fechas</button>
      </div>
    </div>

    <!-- Barra de navegación -->
    <div class="tarjeta flex flex-wrap items-center gap-2 p-2">
      <div class="flex items-center gap-1">
        <button class="btn-secundario btn-chico" @click="estado.fecha = hoy">Hoy</button>
        <button class="btn-fantasma p-1.5" aria-label="Anterior" @click="mover(-1)"><ChevronLeft class="size-5" /></button>
        <button class="btn-fantasma p-1.5" aria-label="Siguiente" @click="mover(1)"><ChevronRight class="size-5" /></button>
      </div>
      <h2 class="min-w-40 flex-1 text-base font-semibold first-letter:uppercase" aria-live="polite">{{ titulo }}</h2>
      <form class="hidden items-center gap-1 md:flex" @submit.prevent="irAFecha">
        <input v-model="irA" class="entrada w-32 py-1.5" placeholder="DD/MM/AAAA" aria-label="Ir a fecha" />
        <button class="btn-fantasma btn-chico">Ir</button>
      </form>
      <div class="flex rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="Vista">
        <button v-for="v in (['lista', 'mes', 'semana', 'dia'] as const)" :key="v" role="tab" :aria-selected="estado.vista === v"
                :class="['rounded-md px-3 py-1 text-sm font-medium', estado.vista === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600']"
                @click="estado.vista = v">{{ { lista: 'Lista', mes: 'Mes', semana: 'Semana', dia: 'Día' }[v] }}</button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex flex-wrap items-center gap-2">
      <select v-if="org.sucursalesActivas.length > 1" v-model="estado.sucursal" class="entrada w-auto py-1.5" aria-label="Salón">
        <option value="">Todos los salones</option>
        <option v-for="s in org.sucursalesActivas" :key="s.id" :value="s.id">{{ s.nombre }}</option>
      </select>
      <select v-if="org.espaciosActivos.length > 1" v-model="estado.espacio" class="entrada w-auto py-1.5" aria-label="Espacio">
        <option value="">Todos los espacios</option>
        <option v-for="e in org.espaciosActivos.filter((x) => !sucursal || x.sucursal_id === sucursal)" :key="e.id" :value="e.id">{{ e.nombre }}</option>
      </select>
      <button class="btn-fantasma btn-chico" :aria-expanded="verFiltros" @click="verFiltros = !verFiltros">
        <SlidersHorizontal class="size-4" /> Filtrar por estado<span v-if="filtrosActivos" class="rounded-full bg-marca-600 px-1.5 text-white">{{ filtrosActivos }}</span>
      </button>
      <div class="ml-auto hidden items-center gap-3 text-xs text-slate-500 md:flex" aria-label="Referencias">
        <span v-for="e in (['consulta', 'tentativa', 'senada', 'confirmada'] as const)" :key="e" class="flex items-center gap-1"><span :class="['size-2 rounded-full', ESTADOS_RESERVA[e].punto]" />{{ ESTADOS_RESERVA[e].etiqueta }}</span>
        <span class="flex items-center gap-1"><Lock class="size-3" /> Cerrado</span>
        <span class="flex items-center gap-1"><span class="size-2 rounded-full bg-indigo-400" />Entrevista</span>
      </div>
    </div>
    <div v-if="verFiltros" class="flex flex-wrap items-center gap-1 rounded-lg bg-white p-2 ring-1 ring-slate-200" role="group" aria-label="Filtrar por estado">
      <button v-for="e in ORDEN_ESTADOS.filter((x) => x !== 'cancelada')" :key="e" type="button" :aria-pressed="estado.estados.includes(e)"
              :class="['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition',
                       estado.estados.length === 0 || estado.estados.includes(e) ? ESTADOS_RESERVA[e].clase : 'bg-white text-slate-400 ring-slate-200']"
              @click="alternarEstado(e)">
        <span :class="['size-1.5 rounded-full', ESTADOS_RESERVA[e].punto]" />{{ ESTADOS_RESERVA[e].etiqueta }}
      </button>
      <label class="ml-auto flex items-center gap-2 text-xs text-slate-600">
        <input v-model="estado.canceladas" type="checkbox" class="rounded border-slate-300 text-marca-600" /> Mostrar cancelados
      </label>
    </div>

    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }} <button class="enlace" @click="cargar">Reintentar</button></p>
    <p v-if="!org.tieneSedes" class="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Todavía no hay espacios cargados. <RouterLink to="/configuracion/sedes" class="enlace">Configurá tus espacios</RouterLink> para empezar a reservar.
    </p>

    <div :class="['transition-opacity', cargando && 'opacity-60']" :aria-busy="cargando">
      <VistaLista v-if="estado.vista === 'lista'" :desde="rango.desde" :hasta="rango.hasta" :hoy="hoy" :items="items" :zona="org.zona"
                  :nombre-espacio="nombreEspacio" @elegir-item="elegirItem" />
      <VistaMes v-else-if="estado.vista === 'mes'" :mes="estado.fecha" :hoy="hoy" :items="items" :zona="org.zona"
                :espacio-ids="espaciosVisibles.map((e) => e.id)" :puede-crear="org.puede('reservas.crear')" :seleccionado="diaSel ?? undefined"
                @elegir-item="elegirItem" @elegir-dia="elegirDia" @nueva-en="nuevaEn" />
      <VistaTiempo v-else-if="columnas.length" :columnas="columnas" :items="items" :zona="org.zona" :hoy="hoy" :puede-crear="org.puede('reservas.crear')"
                   @elegir-item="elegirItem" @nueva-en="nuevaEn" />
      <p v-else class="tarjeta p-8 text-center text-sm text-slate-500">No hay espacios para mostrar con estos filtros.</p>
    </div>
    <!-- Día seleccionado (vista mes) -->
    <section v-if="diaSel && estado.vista === 'mes'" class="tarjeta p-4" aria-live="polite">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold first-letter:uppercase">{{ fmtDiaLargo(diaSel) }}</h2>
        <div class="flex gap-2">
          <button class="btn-fantasma btn-chico" @click="verHorarios(diaSel)">Ver por horario</button>
          <button v-if="org.puede('reservas.crear') && diaSel >= hoy" class="btn-primario btn-chico" @click="nuevaEn(diaSel)"><Plus class="size-4" /> Reservar este día</button>
          <button class="btn-fantasma p-1" aria-label="Cerrar" @click="diaSel = null"><X class="size-4" /></button>
        </div>
      </div>
      <ul v-if="itemsDiaSel.length" class="mt-2 divide-y divide-slate-100">
        <li v-for="it in itemsDiaSel" :key="it.clave">
          <button type="button" class="flex w-full items-center gap-3 py-2 text-left hover:bg-slate-50" @click="elegirItem(it)">
            <span class="w-24 shrink-0 text-sm tabular-nums">{{ fmtHora(it.inicio, org.zona) }}–{{ fmtHora(it.fin, org.zona) }}</span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ it.tipo === 'bloqueo' ? `Cerrado: ${it.titulo}` : it.titulo }}
              <span class="font-normal text-slate-500">· {{ it.espacioIds.map(nombreEspacio).join(', ') }}</span></span>
            <InsigniaEstado v-if="it.estado" :estado="it.estado" />
          </button>
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-emerald-700">Día libre: no hay nada reservado.</p>
    </section>
    <p v-else class="text-xs text-slate-500">
      {{ estado.vista === 'mes' ? 'Tocá un día para ver qué hay y reservarlo.' : estado.vista === 'lista' ? '' : 'Tocá un horario libre para reservar. Lo rayado es el tiempo de armado y limpieza.' }}
      Las consultas no ocupan la fecha.
    </p>

    <FormBloqueo v-model="bloqueoAbierto" :fecha="estado.vista === 'mes' ? undefined : estado.fecha" :sucursal-id="sucursal || undefined" @guardado="cargar" />

    <Modal v-model="bloqueoAbiertoDetalle" titulo="Fecha cerrada" ancho="sm">
      <dl v-if="bloqueoSel" class="space-y-2 text-sm">
        <div><dt class="text-xs text-slate-500">Espacio</dt><dd class="font-medium">{{ nombreEspacio(bloqueoSel.espacioIds[0] ?? '') }}</dd></div>
        <div><dt class="text-xs text-slate-500">Período</dt><dd>{{ fmtFechaHora(bloqueoSel.inicio, org.zona) }} a {{ fmtFechaHora(bloqueoSel.fin, org.zona) }}</dd></div>
        <div><dt class="text-xs text-slate-500">Tipo</dt><dd>{{ TIPOS_BLOQUEO[bloqueoSel.tipoBloqueo ?? 'otro'] }}</dd></div>
        <div v-if="bloqueoSel.motivo"><dt class="text-xs text-slate-500">Motivo</dt><dd>{{ bloqueoSel.motivo }}</dd></div>
      </dl>
      <template v-if="org.puede('bloqueos.gestionar')" #pie>
        <button class="btn-peligro" @click="quitarBloqueo"><Trash2 class="size-4" /> Volver a abrir</button>
      </template>
    </Modal>
  </div>
</template>
