<script setup lang="ts">
// Inicio. Pensado para responder "¿qué tengo que hacer hoy?" de un vistazo:
// eventos de hoy, una lista de pendientes accionables y pocos números clave.
// Todo sale de panel_resumen(), que calcula sobre datos reales con la RLS del usuario.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlarmClock, CalendarCheck, ChevronRight, CircleCheck, FileSignature, Inbox, ListChecks,
  MessagesSquare, ShieldCheck, SlidersHorizontal, Wallet,
} from 'lucide-vue-next'
import { endOfMonth, startOfMonth, addMonths, subDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { api, rutaOrg } from '@/lib/api'
import type { EstadoReserva } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { aFechaISO, ahoraEn, desdeLocal, enZona, fechaDeISO, sumarDiasISO, fmtDiaLargo, fmtFecha, fmtHora, fmtMoneda, tiempoRelativo } from '@/lib/formato'
import InsigniaEstado from '@/components/ui/InsigniaEstado.vue'
import { MODALIDADES_ENTREVISTA } from '@/lib/catalogos'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import ChecklistConfiguracion from './ChecklistConfiguracion.vue'
import { useOrganizacion } from '@/stores/organizacion'
import { useSesion } from '@/stores/sesion'
import { useAcciones } from '@/stores/acciones'

interface ReservaResumen { id: string; numero: number; titulo: string; estado: EstadoReserva; inicio: string; fin: string; invitados?: number | null; espacios?: string | null; cliente?: string | null; vence?: string | null; creado_at?: string }
interface Cobro { cuota_id: string; reserva_id: string; numero: number; titulo: string; vencimiento: string; pendiente: number }
interface Tarea { id: string; titulo: string; vence_el: string | null; prioridad: string; estado: string; mia: boolean; reserva_id: string | null }
interface Resumen {
  hoy: string
  eventos_hoy: ReservaResumen[]
  proximas: ReservaResumen[]
  consultas_nuevas: number
  consultas_abiertas: number
  consultas: ReservaResumen[]
  tentativas: number
  tentativas_por_vencer: ReservaResumen[]
  contratos_pendientes: number
  cobros_proximos: Cobro[] | null
  cobros_proximos_total: number | null
  deuda_vencida: number | null
  deuda_vencida_reservas: number | null
  ingresos: number | null
  gastos: number | null
  ocupacion_pct: number
  espacios_activos: number
  reservas_periodo: number
  fechas_disponibles: Array<{ fecha: string; libres: number; total: number }>
  tareas_pendientes: number | null
  tareas_vencidas: number | null
  tareas: Tarea[]
  permisos: { pagos: boolean; gastos: boolean }
}
interface Pendiente { clave: string; icono: typeof Inbox; color: string; titulo: string; detalle: string; urgente?: boolean; a: object }

const org = useOrganizacion()
const sesion = useSesion()
const acciones = useAcciones()
const route = useRoute()
const router = useRouter()
const datos = ref<Resumen | null>(null)
const cargando = ref(true)
const error = ref('')
const miembros = ref<Array<{ usuario_id: string; nombre: string; email: string }>>([])

type Periodo = 'mes' | 'proximo' | '30' | 'personalizado'
const q = route.query
const filtros = reactive({
  periodo: (['mes', 'proximo', '30', 'personalizado'].includes(String(q.periodo)) ? q.periodo : 'mes') as Periodo,
  desde: typeof q.desde === 'string' ? q.desde : '',
  hasta: typeof q.hasta === 'string' ? q.hasta : '',
  salon: typeof q.salon === 'string' ? q.salon : '',
  sucursal: typeof q.sucursal === 'string' ? q.sucursal : '',
  responsable: typeof q.responsable === 'string' ? q.responsable : '',
})
const verFiltros = ref(Object.keys(q).length > 0)
const filtrosActivos = computed(() => [filtros.periodo !== 'mes', filtros.salon, filtros.sucursal, filtros.responsable].filter(Boolean).length)

const rango = computed(() => {
  const hoy = ahoraEn(org.zona)
  if (filtros.periodo === 'proximo') {
    const m = addMonths(hoy, 1)
    return { desde: aFechaISO(startOfMonth(m)), hasta: aFechaISO(endOfMonth(m)) }
  }
  if (filtros.periodo === '30') return { desde: aFechaISO(subDays(hoy, 29)), hasta: aFechaISO(hoy) }
  if (filtros.periodo === 'personalizado' && filtros.desde && filtros.hasta) return { desde: filtros.desde, hasta: filtros.hasta }
  return { desde: aFechaISO(startOfMonth(hoy)), hasta: aFechaISO(endOfMonth(hoy)) }
})
const nombrePeriodo = computed(() => ({ mes: 'este mes', proximo: 'el mes que viene', '30': 'los últimos 30 días', personalizado: 'el período elegido' })[filtros.periodo])
const sucursalesFiltradas = computed(() => org.sucursales.filter((s) => !filtros.salon || s.salon_id === filtros.salon))

interface EntrevistaHoy { id: string; inicio: string; modalidad: string; contacto_nombre: string | null; motivo: string | null; clientes: { nombre: string } | null }
const entrevistasHoy = ref<EntrevistaHoy[]>([])
async function cargarEntrevistas() {
  if (!org.puede('entrevistas.ver')) return
  const hoy = aFechaISO(ahoraEn(org.zona))
  entrevistasHoy.value = await api.get<EntrevistaHoy[]>(rutaOrg(org.id, 'entrevistas'), {
    desde: desdeLocal(hoy, '00:00', org.zona), hasta: desdeLocal(sumarDiasISO(hoy, 1), '00:00', org.zona), estado: 'programada',
  }).catch(() => [])
}

interface GarantiaPend { id: string; monto: number; estado: string; reservas: { id: string; numero: number; titulo: string; inicio: string; fin: string } | null }
const garantiasPend = ref<GarantiaPend[]>([])
async function cargarGarantias() {
  if (!org.puede('pagos.ver')) return
  const data = await api.get<GarantiaPend[]>(rutaOrg(org.id, 'garantias')).catch(() => [])
  const ahora = Date.now()
  garantiasPend.value = data.filter((g) => g.reservas && ['pendiente', 'cobrada'].includes(g.estado) && (g.estado === 'cobrada'
    ? new Date(g.reservas.fin).getTime() < ahora
    : new Date(g.reservas.inicio).getTime() > ahora && new Date(g.reservas.inicio).getTime() - ahora < 14 * 864e5))
}

async function cargar() {
  void cargarEntrevistas()
  void cargarGarantias()
  cargando.value = true
  error.value = ''
  try {
    datos.value = await api.get<Resumen>(rutaOrg(org.id, 'panel'), {
      desde: rango.value.desde, hasta: rango.value.hasta, salon: filtros.salon, sucursal: filtros.sucursal, responsable: filtros.responsable,
    })
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}

watch(() => ({ ...filtros }), (f) => {
  if (f.sucursal && !sucursalesFiltradas.value.some((s) => s.id === f.sucursal)) filtros.sucursal = ''
  const query: Record<string, string> = {}
  for (const [k, v] of Object.entries(f)) if (v && !(k === 'periodo' && v === 'mes')) query[k] = v
  if (f.periodo !== 'personalizado') { delete query.desde; delete query.hasta }
  void router.replace({ query })
  void cargar()
}, { deep: true })
watch(() => acciones.version, cargar)

onMounted(async () => {
  void cargar()
  const data = await api.get<Array<(typeof miembros.value)[number] & { activo: boolean }>>(rutaOrg(org.id, 'miembros')).catch(() => [])
  miembros.value = data.filter((m) => m.activo)
})
function limpiarFiltros() {
  Object.assign(filtros, { periodo: 'mes', desde: '', hasta: '', salon: '', sucursal: '', responsable: '' })
}

const saludo = computed(() => {
  const h = ahoraEn(org.zona).getHours()
  const nombre = sesion.perfil?.nombre?.split(' ')[0]
  const base = h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
  return nombre ? `${base}, ${nombre}` : base
})

const proximasSinHoy = computed(() => datos.value?.proximas.filter((p) => !datos.value!.eventos_hoy.some((h) => h.id === p.id)).slice(0, 5) ?? [])

// Lista única de cosas para hacer, ordenada por urgencia. Cada ítem dice qué hacer, no solo un número.
const pendientes = computed<Pendiente[]>(() => {
  const d = datos.value
  if (!d) return []
  const lista: Pendiente[] = []
  if ((d.deuda_vencida ?? 0) > 0) {
    lista.push({ clave: 'deuda', icono: AlarmClock, color: 'text-rose-600 bg-rose-50', urgente: true,
      titulo: `Cobrar ${fmtMoneda(d.deuda_vencida, true)} atrasados`,
      detalle: `${d.deuda_vencida_reservas} evento${d.deuda_vencida_reservas === 1 ? '' : 's'} con cuotas vencidas`,
      a: { name: 'cobros', query: { ver: 'vencidos' } } })
  }
  for (const r of d.tentativas_por_vencer) {
    lista.push({ clave: `t${r.id}`, icono: AlarmClock, color: 'text-amber-600 bg-amber-50', urgente: !!r.vence && new Date(r.vence).getTime() - Date.now() < 864e5,
      titulo: `Pedir la seña: ${r.titulo}`,
      detalle: `La fecha retenida se libera ${r.vence ? tiempoRelativo(r.vence, org.zona) : 'pronto'} · evento el ${fmtFecha(r.inicio, org.zona)}`,
      a: { name: 'reserva', params: { id: r.id } } })
  }
  for (const r of d.consultas) {
    lista.push({ clave: `c${r.id}`, icono: Inbox, color: 'text-sky-600 bg-sky-50',
      titulo: `Responder consulta: ${r.titulo}`,
      detalle: `Llegó ${r.creado_at ? tiempoRelativo(r.creado_at, org.zona) : ''} · para el ${fmtFecha(r.inicio, org.zona)}`,
      a: { name: 'reserva', params: { id: r.id } } })
  }
  for (const c of d.cobros_proximos ?? []) {
    lista.push({ clave: `p${c.cuota_id}`, icono: Wallet, color: 'text-emerald-600 bg-emerald-50',
      titulo: `Cobrar ${fmtMoneda(c.pendiente, true)} · ${c.titulo}`,
      detalle: `Vence el ${fmtFecha(c.vencimiento, org.zona)}`,
      a: { name: 'reserva', params: { id: c.reserva_id } } })
  }
  for (const g of garantiasPend.value) {
    const devolver = g.estado === 'cobrada'
    lista.push({ clave: `g${g.id}`, icono: ShieldCheck, color: devolver ? 'text-amber-600 bg-amber-50' : 'text-sky-600 bg-sky-50', urgente: devolver,
      titulo: `${devolver ? 'Devolver' : 'Cobrar'} garantía ${fmtMoneda(g.monto, true)} · ${g.reservas!.titulo}`,
      detalle: devolver ? 'El evento ya terminó: revisá que no haya daños' : `Evento el ${fmtFecha(g.reservas!.inicio, org.zona)}`,
      a: { name: 'reserva', params: { id: g.reservas!.id } } })
  }
  if (d.contratos_pendientes > 0) {
    lista.push({ clave: 'contratos', icono: FileSignature, color: 'text-violet-600 bg-violet-50',
      titulo: `${d.contratos_pendientes} contrato${d.contratos_pendientes === 1 ? '' : 's'} sin firmar`,
      detalle: 'Eventos señados o confirmados que todavía no firmaron',
      a: { name: 'reservas', query: { contrato: 'pendiente' } } })
  }
  for (const t of d.tareas) {
    const vencida = !!t.vence_el && t.vence_el < d.hoy
    lista.push({ clave: `k${t.id}`, icono: ListChecks, color: vencida ? 'text-rose-600 bg-rose-50' : 'text-slate-600 bg-slate-100', urgente: vencida,
      titulo: t.titulo,
      detalle: [t.vence_el ? (vencida ? `Venció el ${fmtFecha(t.vence_el, org.zona)}` : `Para el ${fmtFecha(t.vence_el, org.zona)}`) : 'Tarea', t.mia ? 'asignada a vos' : ''].filter(Boolean).join(' · '),
      a: t.reserva_id ? { name: 'reserva', params: { id: t.reserva_id } } : { name: 'tareas' } })
  }
  return lista.sort((a, b) => Number(!!b.urgente) - Number(!!a.urgente))
})
const verTodosPendientes = ref(false)

const diaCorto = (iso: string) => format(fechaDeISO(iso), 'EEE d/MM', { locale: es })
</script>

<template>
  <div class="space-y-6">
    <!-- Saludo -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="titulo-pagina">{{ saludo }}</h1>
        <p class="subtitulo first-letter:uppercase">{{ datos ? fmtDiaLargo(datos.hoy) : '' }}</p>
      </div>
      <button class="btn-fantasma" :aria-expanded="verFiltros" @click="verFiltros = !verFiltros">
        <SlidersHorizontal class="size-4" /> Filtrar<span v-if="filtrosActivos" class="rounded-full bg-marca-600 px-1.5 text-xs text-white">{{ filtrosActivos }}</span>
      </button>
    </div>

    <section v-if="verFiltros" class="tarjeta flex flex-wrap items-end gap-3 p-3" aria-label="Filtros">
      <label class="text-xs font-medium text-slate-600">Período
        <select v-model="filtros.periodo" class="entrada mt-1 w-40">
          <option value="mes">Este mes</option><option value="proximo">Próximo mes</option>
          <option value="30">Últimos 30 días</option><option value="personalizado">Elegir fechas</option>
        </select>
      </label>
      <template v-if="filtros.periodo === 'personalizado'">
        <label class="w-40 text-xs font-medium text-slate-600">Desde <CampoFecha v-model="filtros.desde" class="mt-1" /></label>
        <label class="w-40 text-xs font-medium text-slate-600">Hasta <CampoFecha v-model="filtros.hasta" class="mt-1" /></label>
      </template>
      <label v-if="org.salones.length > 1" class="text-xs font-medium text-slate-600">Salón
        <select v-model="filtros.salon" class="entrada mt-1 w-44"><option value="">Todos</option>
          <option v-for="s in org.salones" :key="s.id" :value="s.id">{{ s.nombre }}</option></select>
      </label>
      <label v-if="org.sucursales.length > 1" class="text-xs font-medium text-slate-600">Sede
        <select v-model="filtros.sucursal" class="entrada mt-1 w-44"><option value="">Todas</option>
          <option v-for="s in sucursalesFiltradas" :key="s.id" :value="s.id">{{ s.nombre }}</option></select>
      </label>
      <label class="text-xs font-medium text-slate-600">Responsable
        <select v-model="filtros.responsable" class="entrada mt-1 w-44"><option value="">Todos</option>
          <option v-for="m in miembros" :key="m.usuario_id" :value="m.usuario_id">{{ m.nombre || m.email }}</option></select>
      </label>
      <button v-if="filtrosActivos" class="btn-fantasma btn-chico" @click="limpiarFiltros">Quitar filtros</button>
    </section>

    <ChecklistConfiguracion />

    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
      {{ error }} <button class="enlace ml-2" @click="cargar">Reintentar</button>
    </p>
    <div v-if="cargando && !datos" class="grid gap-4 lg:grid-cols-3"><div v-for="i in 3" :key="i" class="tarjeta h-48 animate-pulse bg-slate-100" /></div>

    <template v-if="datos">
      <!-- Hoy -->
      <section aria-labelledby="titulo-hoy">
        <h2 id="titulo-hoy" class="mb-2 text-sm font-semibold text-slate-500">HOY</h2>
        <div v-if="datos.eventos_hoy.length" class="grid gap-3 md:grid-cols-2">
          <RouterLink v-for="r in datos.eventos_hoy" :key="r.id" :to="{ name: 'reserva', params: { id: r.id } }"
                      class="flex items-center gap-4 rounded-xl bg-marca-600 p-4 text-white shadow-sm hover:bg-marca-700">
            <div class="text-center">
              <p class="text-2xl font-bold leading-none">{{ fmtHora(r.inicio, org.zona) }}</p>
              <p class="text-xs opacity-80">a {{ fmtHora(r.fin, org.zona) }}</p>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ r.titulo }}</p>
              <p class="truncate text-sm opacity-90">{{ r.espacios }}<template v-if="r.invitados"> · {{ r.invitados }} invitados</template></p>
            </div>
            <ChevronRight class="size-5 opacity-70" />
          </RouterLink>
        </div>
        <p v-else class="tarjeta px-4 py-4 text-sm text-slate-500">Hoy no hay eventos.</p>
        <div v-if="entrevistasHoy.length" class="mt-3 grid gap-2 md:grid-cols-2">
          <button v-for="e in entrevistasHoy" :key="e.id" type="button" class="flex items-center gap-3 rounded-xl bg-indigo-50 p-3 text-left ring-1 ring-indigo-200 hover:bg-indigo-100"
                  @click="acciones.verEntrevista(e.id)">
            <MessagesSquare class="size-5 shrink-0 text-indigo-600" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-indigo-900">{{ fmtHora(e.inicio, org.zona) }} · Entrevista con {{ e.clientes?.nombre ?? e.contacto_nombre }}</span>
              <span class="block truncate text-xs text-indigo-700">{{ MODALIDADES_ENTREVISTA[e.modalidad] }}<template v-if="e.motivo"> · {{ e.motivo }}</template></span>
            </span>
          </button>
        </div>
      </section>

      <!-- Números clave -->
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen">
        <RouterLink :to="{ name: 'reservas', query: { estado: 'consulta' } }" class="tarjeta p-4 hover:ring-marca-300">
          <p class="text-2xl font-semibold tabular-nums">{{ datos.consultas_abiertas }}</p>
          <p class="text-sm text-slate-500">Consulta{{ datos.consultas_abiertas === 1 ? '' : 's' }} abierta{{ datos.consultas_abiertas === 1 ? '' : 's' }}</p>
        </RouterLink>
        <RouterLink :to="{ name: 'calendario' }" class="tarjeta p-4 hover:ring-marca-300">
          <p class="text-2xl font-semibold tabular-nums">{{ datos.reservas_periodo }}</p>
          <p class="text-sm text-slate-500">Evento{{ datos.reservas_periodo === 1 ? '' : 's' }} {{ nombrePeriodo }}</p>
        </RouterLink>
        <template v-if="datos.permisos.pagos">
          <RouterLink :to="{ name: 'cobros', query: { ver: 'pagos', desde: rango.desde, hasta: rango.hasta } }" class="tarjeta p-4 hover:ring-marca-300">
            <p class="text-2xl font-semibold tabular-nums">{{ fmtMoneda(datos.ingresos, true) }}</p>
            <p class="text-sm text-slate-500">Cobrado {{ nombrePeriodo }}</p>
          </RouterLink>
          <RouterLink :to="{ name: 'cobros', query: { ver: 'proximos' } }" class="tarjeta p-4 hover:ring-marca-300">
            <p class="text-2xl font-semibold tabular-nums">{{ fmtMoneda(datos.cobros_proximos_total, true) }}</p>
            <p class="text-sm text-slate-500">Por cobrar en 14 días</p>
          </RouterLink>
        </template>
        <template v-else>
          <RouterLink :to="{ name: 'tareas' }" class="tarjeta p-4 hover:ring-marca-300">
            <p class="text-2xl font-semibold tabular-nums">{{ datos.tareas_pendientes ?? 0 }}</p>
            <p class="text-sm text-slate-500">Tareas pendientes</p>
          </RouterLink>
          <RouterLink :to="{ name: 'calendario' }" class="tarjeta p-4 hover:ring-marca-300">
            <p class="text-2xl font-semibold tabular-nums">{{ datos.ocupacion_pct.toLocaleString('es-AR') }}%</p>
            <p class="text-sm text-slate-500">Ocupación {{ nombrePeriodo }}</p>
          </RouterLink>
        </template>
      </section>

      <div class="grid gap-6 lg:grid-cols-5">
        <!-- Para hacer -->
        <section class="min-w-0 lg:col-span-3" aria-labelledby="titulo-pendientes">
          <h2 id="titulo-pendientes" class="mb-2 text-sm font-semibold text-slate-500">PARA HACER</h2>
          <div class="tarjeta">
            <ul class="divide-y divide-slate-100">
              <li v-for="p in (verTodosPendientes ? pendientes : pendientes.slice(0, 6))" :key="p.clave">
                <RouterLink :to="p.a" class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <span :class="['flex size-9 shrink-0 items-center justify-center rounded-full', p.color]"><component :is="p.icono" class="size-4" /></span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ p.titulo }}</span>
                    <span :class="['block truncate text-xs', p.urgente ? 'text-rose-600' : 'text-slate-500']">{{ p.detalle }}</span>
                  </span>
                  <ChevronRight class="size-4 shrink-0 text-slate-300" />
                </RouterLink>
              </li>
              <li v-if="!pendientes.length" class="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <CircleCheck class="size-8 text-emerald-500" />
                <p class="text-sm font-medium">Todo al día</p>
                <p class="text-xs text-slate-500">No hay consultas, cobros ni tareas pendientes.</p>
              </li>
            </ul>
            <button v-if="pendientes.length > 6" class="w-full border-t border-slate-100 py-2 text-sm font-medium text-marca-700 hover:bg-slate-50"
                    @click="verTodosPendientes = !verTodosPendientes">
              {{ verTodosPendientes ? 'Ver menos' : `Ver ${pendientes.length - 6} más` }}
            </button>
          </div>
        </section>

        <div class="min-w-0 space-y-6 lg:col-span-2">
          <!-- Próximos eventos -->
          <section aria-labelledby="titulo-proximos">
            <div class="mb-2 flex items-center justify-between">
              <h2 id="titulo-proximos" class="text-sm font-semibold text-slate-500">PRÓXIMOS EVENTOS</h2>
              <RouterLink :to="{ name: 'calendario' }" class="enlace text-xs">Ver agenda</RouterLink>
            </div>
            <ul class="tarjeta divide-y divide-slate-100">
              <li v-for="r in proximasSinHoy" :key="r.id">
                <RouterLink :to="{ name: 'reserva', params: { id: r.id } }" class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <span class="w-11 shrink-0 rounded-lg bg-slate-100 py-1 text-center">
                    <span class="block text-base font-semibold leading-none">{{ fmtFecha(r.inicio, org.zona).slice(0, 2) }}</span>
                    <span class="block text-[10px] uppercase text-slate-500">{{ format(enZona(r.inicio, org.zona), 'MMM', { locale: es }) }}</span>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ r.titulo }}</span>
                    <span class="block truncate text-xs text-slate-500">{{ fmtHora(r.inicio, org.zona) }} · {{ r.cliente }}</span>
                  </span>
                  <InsigniaEstado :estado="r.estado" />
                </RouterLink>
              </li>
              <li v-if="!proximasSinHoy.length" class="px-4 py-8 text-center text-sm text-slate-500">
                No hay eventos próximos.
                <button v-if="org.puede('reservas.crear')" class="enlace ml-1" @click="acciones.nuevaReserva()">Cargar uno</button>
              </li>
            </ul>
          </section>

          <!-- Fechas libres -->
          <section v-if="datos.espacios_activos" aria-labelledby="titulo-libres">
            <h2 id="titulo-libres" class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500"><CalendarCheck class="size-4" /> FINES DE SEMANA LIBRES</h2>
            <div class="flex flex-wrap gap-2">
              <button v-for="d in datos.fechas_disponibles" :key="d.fecha" type="button" :disabled="!org.puede('reservas.crear')"
                      class="rounded-lg bg-white px-3 py-2 text-left text-sm shadow-sm ring-1 ring-slate-200 hover:ring-marca-400 disabled:cursor-default"
                      :title="`${d.libres} de ${d.total} espacios libres`" @click="acciones.nuevaReserva({ fecha: d.fecha })">
                <span class="block font-medium first-letter:uppercase">{{ diaCorto(d.fecha) }}</span>
                <span class="block text-xs text-emerald-700">{{ d.libres === d.total ? 'Todo libre' : `${d.libres} de ${d.total} libres` }}</span>
              </button>
              <p v-if="!datos.fechas_disponibles.length" class="text-sm text-slate-500">No quedan fines de semana libres en los próximos 60 días.</p>
            </div>
          </section>
        </div>
      </div>

    </template>
  </div>
</template>
