<script setup lang="ts">
// Estadísticas de la empresa: resumen del período con comparación contra el
// período anterior de igual duración, evolución y desgloses.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ChartColumnBig, Download, Minus, TrendingDown, TrendingUp } from 'lucide-vue-next'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import Cargando from '@/components/ui/Cargando.vue'
import BarrasHorizontales, { type FilaBarra } from '@/components/estadisticas/BarrasHorizontales.vue'
import GraficoTiempo from '@/components/estadisticas/GraficoTiempo.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fechaDeISO, fmtFecha, fmtMoneda, hoyISO, sumarDiasISO } from '@/lib/formato'
import { CATEGORIAS_GASTO, MEDIOS_PAGO, ORIGENES_CLIENTE, TIPOS_EVENTO } from '@/lib/catalogos'
import { exportarPDF, nombreArchivo } from '@/lib/pdf'
import { useOrganizacion } from '@/stores/organizacion'

type Num = number | null
interface Datos {
  periodo: { desde: string; hasta: string; dias: number }
  anterior: { desde: string; hasta: string }
  agrupacion: 'semana' | 'mes'
  resumen: {
    eventos: number; eventos_ant: number; invitados: number; invitados_promedio: Num; consultas: number; consultas_ant: number
    cerradas: number; cerradas_ant: number; canceladas: number; pedidos_web: number; anticipacion_dias: Num; clientes_nuevos: number
    presupuestos_creados: number; presupuestos_aceptados: number; facturado: Num; facturado_ant: Num; ticket_promedio: Num
    ticket_promedio_ant: Num; cobrado: Num; cobrado_ant: Num; gastos: Num; gastos_ant: Num; costos_eventos: Num; ganancia_eventos: Num; por_cobrar: Num
  }
  series: Array<{ desde: string; hasta: string; eventos: number; facturado: Num; cobrado: Num; gastos: Num }>
  embudo: { consultas: number; retenidas: number; senadas: number; confirmadas: number }
  por_tipo: Array<{ tipo: string; eventos: number; facturado: Num }>
  por_espacio: Array<{ espacio: string; eventos: number; dias_ocupados: number; ocupacion: number; facturado: Num }>
  por_dia_semana: Array<{ dia: number; eventos: number }>
  origen_clientes: Array<{ origen: string; clientes: number }>
  medios_pago: Array<{ medio: string; monto: number }> | null
  gastos_categoria: Array<{ categoria: string; monto: number }> | null
  top_clientes: Array<{ cliente: string; id: string; eventos: number; facturado: Num }>
}

const org = useOrganizacion()
const hoy = hoyISO(org.zona)
const finDeMes = (iso: string) => { const [a, m] = iso.split('-').map(Number) as [number, number]; return `${iso.slice(0, 7)}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}` }
const inicioMesPasado = (() => { const [a, m] = hoy.split('-').map(Number) as [number, number]; const d = new Date(a, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })()
const anio = Number(hoy.slice(0, 4))
const PERIODOS = {
  mes: { etiqueta: 'Este mes', desde: `${hoy.slice(0, 7)}-01`, hasta: finDeMes(hoy) },
  mes_pasado: { etiqueta: 'Mes pasado', desde: inicioMesPasado, hasta: finDeMes(inicioMesPasado) },
  anio: { etiqueta: `Año ${anio}`, desde: `${anio}-01-01`, hasta: `${anio}-12-31` },
  anio_pasado: { etiqueta: `Año ${anio - 1}`, desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31` },
  doce: { etiqueta: 'Últimos 12 meses', desde: sumarDiasISO(hoy, -364), hasta: hoy },
} as const
type ClavePeriodo = keyof typeof PERIODOS | 'personalizado'
const periodo = ref<ClavePeriodo>('mes')
const rango = reactive({ desde: PERIODOS.mes.desde, hasta: PERIODOS.mes.hasta })
watch(periodo, (p) => { if (p !== 'personalizado') Object.assign(rango, { desde: PERIODOS[p].desde, hasta: PERIODOS[p].hasta }) })

const datos = ref<Datos | null>(null)
const cargando = ref(true)
const error = ref('')
async function cargar() {
  if (!rango.desde || !rango.hasta || rango.hasta < rango.desde) return
  cargando.value = true
  error.value = ''
  try {
    datos.value = await api.get<Datos>(rutaOrg(org.id, 'estadisticas'), { desde: rango.desde, hasta: rango.hasta })
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
watch(() => ({ ...rango }), cargar)
onMounted(cargar)

// --- Formatos -------------------------------------------------------------------------
const compacto = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })
const plata = (v: number) => fmtMoneda(v, true)
const plataEje = (v: number) => (v === 0 ? '$ 0' : `$ ${compacto.format(v)}`)
const pct = (a: number, b: number) => (b > 0 ? Math.round((a * 1000) / b) / 10 : 0)
const r = computed(() => datos.value?.resumen)
const conPlata = computed(() => r.value?.facturado !== null && r.value?.facturado !== undefined)
const conGastos = computed(() => r.value?.gastos !== null && r.value?.gastos !== undefined)
const textoAnterior = computed(() => datos.value ? `${fmtFecha(datos.value.anterior.desde, org.zona)} al ${fmtFecha(datos.value.anterior.hasta, org.zona)}` : '')

interface Variacion { texto: string; tono: 'bien' | 'mal' | 'neutro'; icono: typeof TrendingUp }
/** Variación contra el período anterior. `invertido`: subir es malo (gastos). */
function variacion(actual: Num | undefined, anterior: Num | undefined, invertido = false): Variacion | null {
  if (actual === null || actual === undefined || anterior === null || anterior === undefined) return null
  if (anterior === 0) return actual === 0 ? { texto: 'igual que antes', tono: 'neutro', icono: Minus } : { texto: 'sin datos antes', tono: 'neutro', icono: Minus }
  const d = Math.round(((actual - anterior) * 100) / anterior)
  if (d === 0) return { texto: 'igual que antes', tono: 'neutro', icono: Minus }
  const sube = d > 0
  return { texto: `${sube ? '+' : ''}${d} % vs anterior`, tono: sube !== invertido ? 'bien' : 'mal', icono: sube ? TrendingUp : TrendingDown }
}
const TONOS = { bien: 'text-emerald-700', mal: 'text-rose-700', neutro: 'text-slate-500' }

interface Indicador { titulo: string; valor: string; detalle?: string; variacion?: Variacion | null }
const indicadores = computed<Indicador[]>(() => {
  const x = r.value
  if (!x) return []
  const lista: Indicador[] = [
    { titulo: 'Eventos', valor: String(x.eventos), detalle: 'señados, confirmados o realizados', variacion: variacion(x.eventos, x.eventos_ant) },
  ]
  if (conPlata.value) {
    lista.push(
      { titulo: 'Facturado', valor: plata(x.facturado!), detalle: 'total de esos eventos', variacion: variacion(x.facturado, x.facturado_ant) },
      { titulo: 'Cobrado', valor: plata(x.cobrado!), detalle: 'ingresos del período', variacion: variacion(x.cobrado, x.cobrado_ant) },
    )
  }
  if (conGastos.value) lista.push({ titulo: 'Gastos', valor: plata(x.gastos!), detalle: 'egresos del período', variacion: variacion(x.gastos, x.gastos_ant, true) })
  if (x.ganancia_eventos !== null) {
    lista.push({ titulo: 'Ganancia de los eventos', valor: plata(x.ganancia_eventos),
      detalle: x.facturado ? `margen ${pct(x.ganancia_eventos, x.facturado!).toLocaleString('es-AR')} % · costos ${plata(x.costos_eventos ?? 0)}` : 'facturado − costos de proveedores' })
  }
  if (conPlata.value) {
    lista.push(
      { titulo: 'Ticket promedio', valor: x.ticket_promedio ? plata(x.ticket_promedio) : '—', detalle: 'por evento', variacion: variacion(x.ticket_promedio, x.ticket_promedio_ant) },
      { titulo: 'Por cobrar', valor: plata(x.por_cobrar ?? 0), detalle: 'saldo pendiente de todos los eventos, hoy' },
    )
  }
  lista.push(
    { titulo: 'Consultas recibidas', valor: String(x.consultas), detalle: x.pedidos_web ? `${x.pedidos_web} desde tu página web` : 'creadas en el período', variacion: variacion(x.consultas, x.consultas_ant) },
    { titulo: 'Conversión', valor: `${pct(x.cerradas, x.consultas).toLocaleString('es-AR')} %`, detalle: `${x.cerradas} de ${x.consultas} consultas señaron o confirmaron`,
      variacion: x.consultas_ant ? variacion(pct(x.cerradas, x.consultas), pct(x.cerradas_ant, x.consultas_ant)) : null },
    { titulo: 'Invitados', valor: x.invitados.toLocaleString('es-AR'), detalle: x.invitados_promedio ? `${x.invitados_promedio} por evento en promedio` : undefined },
    { titulo: 'Anticipación', valor: x.anticipacion_dias !== null ? `${x.anticipacion_dias} días` : '—', detalle: 'entre la consulta y el evento' },
    { titulo: 'Clientes nuevos', valor: String(x.clientes_nuevos), detalle: 'cargados en el período' },
    { titulo: 'Presupuestos', valor: String(x.presupuestos_creados), detalle: x.presupuestos_creados ? `${x.presupuestos_aceptados} aceptados (${pct(x.presupuestos_aceptados, x.presupuestos_creados).toLocaleString('es-AR')} %)` : 'creados en el período' },
    { titulo: 'Cancelaciones', valor: String(x.canceladas), detalle: 'de las consultas del período' },
  )
  return lista
})

// --- Series ----------------------------------------------------------------------------
const SERIE_1 = '#2a78d6'
const SERIE_2 = '#eb6834'
const etiquetasTiempo = computed(() => {
  const d = datos.value
  if (!d) return []
  const variosAnios = d.periodo.desde.slice(0, 4) !== d.periodo.hasta.slice(0, 4)
  return d.series.map((s) => d.agrupacion === 'mes'
    ? fechaDeISO(s.desde).toLocaleDateString('es-AR', { month: 'short', ...(variosAnios ? { year: '2-digit' } : {}) }).replace('.', '')
    : `${s.desde.slice(8, 10)}/${s.desde.slice(5, 7)}`)
})
const nombreTramo = computed(() => (datos.value?.agrupacion === 'mes' ? 'mes' : 'semana'))

// --- Desgloses -------------------------------------------------------------------------
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const filasEmbudo = computed<FilaBarra[]>(() => {
  const e = datos.value?.embudo
  if (!e || !e.consultas) return []
  return [
    { clave: 'c', etiqueta: 'Consultas recibidas', valor: e.consultas },
    { clave: 'r', etiqueta: 'Retuvieron la fecha', valor: e.retenidas, detalle: `${pct(e.retenidas, e.consultas).toLocaleString('es-AR')} %` },
    { clave: 's', etiqueta: 'Señaron', valor: e.senadas, detalle: `${pct(e.senadas, e.consultas).toLocaleString('es-AR')} %` },
    { clave: 'f', etiqueta: 'Confirmaron', valor: e.confirmadas, detalle: `${pct(e.confirmadas, e.consultas).toLocaleString('es-AR')} %` },
  ]
})
const filasTipo = computed<FilaBarra[]>(() => (datos.value?.por_tipo ?? []).map((t) => ({
  clave: t.tipo, etiqueta: TIPOS_EVENTO[t.tipo] ?? t.tipo, valor: t.eventos, detalle: t.facturado !== null ? plata(t.facturado) : undefined })))
const filasEspacio = computed<FilaBarra[]>(() => (datos.value?.por_espacio ?? []).map((e) => ({
  clave: e.espacio, etiqueta: e.espacio, valor: e.ocupacion, detalle: `${e.eventos} ${e.eventos === 1 ? 'evento' : 'eventos'}${e.facturado !== null ? ` · ${plata(e.facturado)}` : ''}` })))
const filasDia = computed<FilaBarra[]>(() => (datos.value?.por_dia_semana ?? []).map((d) => ({ clave: String(d.dia), etiqueta: DIAS[d.dia - 1]!, valor: d.eventos })))
const filasOrigen = computed<FilaBarra[]>(() => (datos.value?.origen_clientes ?? []).map((o) => ({
  clave: o.origen, etiqueta: o.origen === 'sin_dato' ? 'Sin dato' : (ORIGENES_CLIENTE[o.origen] ?? o.origen), valor: o.clientes })))
const filasMedios = computed<FilaBarra[]>(() => (datos.value?.medios_pago ?? []).map((m) => ({ clave: m.medio, etiqueta: MEDIOS_PAGO[m.medio] ?? m.medio, valor: Number(m.monto) })))
const filasGastos = computed<FilaBarra[]>(() => (datos.value?.gastos_categoria ?? []).map((g) => ({ clave: g.categoria, etiqueta: CATEGORIAS_GASTO[g.categoria] ?? g.categoria, valor: Number(g.monto) })))
const fmtPct = (v: number) => `${v.toLocaleString('es-AR')} %`

// --- PDF ------------------------------------------------------------------------------
async function exportar() {
  const d = datos.value
  if (!d) return
  const z = org.zona
  const filasA = (f: FilaBarra[], formato: (v: number) => string) => f.map((x) => ({ etiqueta: x.etiqueta, valor: formato(x.valor), detalle: x.detalle ?? '' }))
  const col = (titulo: string) => [{ clave: 'etiqueta', titulo }, { clave: 'valor', titulo: 'Valor', alinear: 'right' as const }, { clave: 'detalle', titulo: 'Detalle' }]
  await exportarPDF(nombreArchivo('estadisticas', org.actual?.nombre ?? '', hoy), {
    titulo: 'Estadísticas', subtitulo: `Del ${fmtFecha(d.periodo.desde, z)} al ${fmtFecha(d.periodo.hasta, z)} · comparado con ${textoAnterior.value}`,
    organizacion: org.actual?.nombre ?? '', zona: z,
    secciones: [
      { titulo: 'Resumen', columnas: [{ clave: 'titulo', titulo: 'Indicador' }, { clave: 'valor', titulo: 'Valor', alinear: 'right' }, { clave: 'detalle', titulo: 'Detalle' }, { clave: 'variacion', titulo: 'Variación' }],
        filas: indicadores.value.map((i) => ({ titulo: i.titulo, valor: i.valor, detalle: i.detalle ?? '', variacion: i.variacion?.texto ?? '' })) },
      { titulo: `Por ${nombreTramo.value}`, columnas: [{ clave: 'tramo', titulo: nombreTramo.value === 'mes' ? 'Mes' : 'Semana' }, { clave: 'eventos', titulo: 'Eventos', alinear: 'right' },
          ...(conPlata.value ? [{ clave: 'facturado', titulo: 'Facturado', alinear: 'right' as const }, { clave: 'cobrado', titulo: 'Cobrado', alinear: 'right' as const }] : []),
          ...(conGastos.value ? [{ clave: 'gastos', titulo: 'Gastos', alinear: 'right' as const }] : [])],
        filas: d.series.map((s, i) => ({ tramo: etiquetasTiempo.value[i], eventos: s.eventos, facturado: plata(s.facturado ?? 0), cobrado: plata(s.cobrado ?? 0), gastos: plata(s.gastos ?? 0) })) },
      { titulo: 'Embudo de consultas', columnas: col('Etapa'), filas: filasA(filasEmbudo.value, String), vacio: 'Sin consultas en el período.' },
      { titulo: 'Por tipo de evento', columnas: col('Tipo'), filas: filasA(filasTipo.value, String), vacio: 'Sin eventos.' },
      { titulo: 'Ocupación por espacio', columnas: col('Espacio'), filas: filasA(filasEspacio.value, fmtPct), vacio: 'Sin eventos.' },
      { titulo: 'Eventos por día de la semana', columnas: col('Día'), filas: filasA(filasDia.value, String) },
      { titulo: 'Origen de los clientes nuevos', columnas: col('Origen'), filas: filasA(filasOrigen.value, String), vacio: 'Sin clientes nuevos.' },
      ...(conPlata.value ? [{ titulo: 'Cobros por medio de pago', columnas: col('Medio'), filas: filasA(filasMedios.value, plata), vacio: 'Sin cobros.' }] : []),
      ...(conGastos.value ? [{ titulo: 'Gastos por categoría', columnas: col('Categoría'), filas: filasA(filasGastos.value, plata), vacio: 'Sin gastos.' }] : []),
      { titulo: 'Mejores clientes', columnas: [{ clave: 'cliente', titulo: 'Cliente' }, { clave: 'eventos', titulo: 'Eventos', alinear: 'right' },
          ...(conPlata.value ? [{ clave: 'facturado', titulo: 'Facturado', alinear: 'right' as const }] : [])],
        filas: d.top_clientes.map((c) => ({ cliente: c.cliente, eventos: c.eventos, facturado: plata(c.facturado ?? 0) })), vacio: 'Sin eventos.' },
    ],
  })
}
</script>

<template>
  <div class="space-y-5" :style="{ '--serie-1': SERIE_1 }">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="titulo-pagina">Estadísticas</h1>
        <p v-if="datos" class="text-sm text-slate-500">Del {{ fmtFecha(datos.periodo.desde, org.zona) }} al {{ fmtFecha(datos.periodo.hasta, org.zona) }} · comparado con {{ textoAnterior }}</p>
      </div>
      <button v-if="org.puede('datos.exportar')" class="btn-secundario" :disabled="!datos" @click="exportar"><Download class="size-4" /> PDF</button>
    </div>

    <div class="flex flex-wrap items-end gap-2">
      <nav class="flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5" aria-label="Período">
        <button v-for="(p, k) in { ...PERIODOS, personalizado: { etiqueta: 'Personalizado' } }" :key="k" type="button"
                :class="['shrink-0 rounded-md px-3 py-1.5 text-sm font-medium', periodo === k ? 'bg-white shadow-sm' : 'text-slate-600']"
                :aria-pressed="periodo === k" @click="periodo = k as ClavePeriodo">{{ p.etiqueta }}</button>
      </nav>
      <template v-if="periodo === 'personalizado'">
        <div class="w-36"><CampoFecha v-model="rango.desde" /></div>
        <div class="w-36"><CampoFecha v-model="rango.hasta" /></div>
      </template>
    </div>

    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <Cargando v-if="cargando && !datos" />
    <template v-else-if="datos">
      <section aria-label="Resumen" :class="['grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4', cargando && 'opacity-60']">
        <div v-for="i in indicadores" :key="i.titulo" class="tarjeta min-w-0 p-3 sm:p-4">
          <p class="text-sm text-slate-500">{{ i.titulo }}</p>
          <p class="mt-1 truncate text-lg font-semibold tabular-nums text-slate-900 sm:text-2xl">{{ i.valor }}</p>
          <p v-if="i.variacion" :class="['mt-1 flex items-center gap-1 text-xs font-medium', TONOS[i.variacion.tono]]">
            <component :is="i.variacion.icono" class="size-3.5" aria-hidden="true" /> {{ i.variacion.texto }}</p>
          <p v-if="i.detalle" class="mt-0.5 text-xs text-slate-500">{{ i.detalle }}</p>
        </div>
      </section>

      <div class="grid gap-4 xl:grid-cols-2">
        <section v-if="conPlata || conGastos" class="tarjeta p-4">
          <h2 class="font-semibold">Cobrado y gastos por {{ nombreTramo }}</h2>
          <GraficoTiempo class="mt-2" tipo="linea" :titulo="`Cobrado y gastos por ${nombreTramo}`" :etiquetas="etiquetasTiempo" :formato="plata" :formato-eje="plataEje"
                         :series="[...(conPlata ? [{ nombre: 'Cobrado', color: SERIE_1, valores: datos.series.map((s) => Number(s.cobrado ?? 0)) }] : []),
                                   ...(conGastos ? [{ nombre: 'Gastos', color: SERIE_2, valores: datos.series.map((s) => Number(s.gastos ?? 0)) }] : [])]" />
        </section>
        <section class="tarjeta p-4">
          <h2 class="font-semibold">{{ conPlata ? 'Facturado' : 'Eventos' }} por {{ nombreTramo }}</h2>
          <p class="text-xs text-slate-500">Según la fecha del evento.</p>
          <GraficoTiempo class="mt-2" :titulo="`${conPlata ? 'Facturado' : 'Eventos'} por ${nombreTramo}`" :etiquetas="etiquetasTiempo"
                         :formato="conPlata ? plata : (v: number) => String(v)" :formato-eje="conPlata ? plataEje : (v: number) => String(Math.round(v))"
                         :series="[conPlata ? { nombre: 'Facturado', color: SERIE_1, valores: datos.series.map((s) => Number(s.facturado ?? 0)) }
                                            : { nombre: 'Eventos', color: SERIE_1, valores: datos.series.map((s) => s.eventos) }]" />
        </section>
      </div>

      <div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <section class="tarjeta p-4">
          <h2 class="mb-3 font-semibold">Embudo de consultas</h2>
          <BarrasHorizontales :filas="filasEmbudo" tono="ordinal" vacio="No entraron consultas en el período." />
        </section>
        <section class="tarjeta p-4">
          <h2 class="mb-3 font-semibold">Eventos por tipo</h2>
          <BarrasHorizontales :filas="filasTipo" vacio="No hay eventos en el período." />
        </section>
        <section class="tarjeta p-4">
          <h2 class="font-semibold">Ocupación por espacio</h2>
          <p class="mb-3 text-xs text-slate-500">Días con eventos sobre los {{ datos.periodo.dias }} días del período.</p>
          <BarrasHorizontales :filas="filasEspacio" :formato="fmtPct" vacio="No hay eventos en el período." />
        </section>
        <section class="tarjeta p-4">
          <h2 class="mb-3 font-semibold">Eventos por día de la semana</h2>
          <BarrasHorizontales :filas="filasDia" />
        </section>
        <section class="tarjeta p-4">
          <h2 class="mb-3 font-semibold">¿Cómo te conocieron?</h2>
          <BarrasHorizontales :filas="filasOrigen" vacio="No se cargaron clientes nuevos en el período." />
        </section>
        <section v-if="conPlata" class="tarjeta p-4">
          <h2 class="mb-3 font-semibold">Cobros por medio de pago</h2>
          <BarrasHorizontales :filas="filasMedios" :formato="plata" vacio="No hubo cobros en el período." />
        </section>
        <section v-if="conGastos" class="tarjeta p-4">
          <h2 class="mb-3 font-semibold">Gastos por categoría</h2>
          <BarrasHorizontales :filas="filasGastos" :formato="plata" vacio="No hubo gastos en el período." />
        </section>
        <section class="tarjeta p-4 md:col-span-2 2xl:col-span-1">
          <h2 class="mb-3 font-semibold">Mejores clientes</h2>
          <p v-if="!datos.top_clientes.length" class="py-6 text-center text-sm text-slate-500">No hay eventos en el período.</p>
          <ol v-else class="divide-y divide-slate-100 text-sm">
            <li v-for="(c, i) in datos.top_clientes" :key="c.id" class="flex items-center gap-3 py-2">
              <span class="w-5 text-right text-xs text-slate-400">{{ i + 1 }}</span>
              <RouterLink :to="{ name: 'cliente', params: { id: c.id } }" class="enlace min-w-0 flex-1 truncate">{{ c.cliente }}</RouterLink>
              <span class="text-xs text-slate-500">{{ c.eventos }} {{ c.eventos === 1 ? 'evento' : 'eventos' }}</span>
              <span v-if="c.facturado !== null" class="w-28 text-right font-semibold tabular-nums">{{ plata(c.facturado) }}</span>
            </li>
          </ol>
        </section>
      </div>
      <p class="flex items-center gap-1.5 text-xs text-slate-500"><ChartColumnBig class="size-3.5" /> Los eventos se cuentan por su fecha (señados, confirmados o realizados); cobros y gastos, por la fecha en que se registraron.</p>
    </template>
  </div>
</template>
