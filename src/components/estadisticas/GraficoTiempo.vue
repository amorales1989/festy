<script setup lang="ts">
// Evolución en el tiempo (semanas o meses): columnas para una serie, líneas para
// comparar dos de la misma unidad. Un solo eje Y, cuadrícula tenue, tooltip al
// pasar el mouse (cruz en líneas, por columna en barras) y vista de tabla.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export interface Serie { nombre: string; color: string; valores: number[] }
const props = withDefaults(defineProps<{ etiquetas: string[]; series: Serie[]; tipo?: 'columnas' | 'linea'; formato?: (v: number) => string; formatoEje?: (v: number) => string; titulo: string; enteros?: boolean }>(), {
  tipo: 'columnas', formato: (v: number) => v.toLocaleString('es-AR'), formatoEje: undefined, enteros: false,
})

const contenedor = ref<HTMLDivElement | null>(null)
const ancho = ref(600)
let observador: ResizeObserver | undefined
onMounted(() => {
  observador = new ResizeObserver(([e]) => { if (e) ancho.value = Math.max(280, Math.round(e.contentRect.width)) })
  if (contenedor.value) observador.observe(contenedor.value)
})
onBeforeUnmount(() => observador?.disconnect())

const ALTO = 220
const M = { arriba: 12, derecha: 8, abajo: 26, izquierda: 64 }
const verTabla = ref(false)
const n = computed(() => props.etiquetas.length)
const internoX = computed(() => ancho.value - M.izquierda - M.derecha)
const internoY = ALTO - M.arriba - M.abajo

/** Máximo "lindo" para el eje: 1, 2, 2.5 o 5 × potencia de 10. */
const maxEje = computed(() => {
  const max = Math.max(0, ...props.series.flatMap((s) => s.valores))
  if (max <= 0) return props.enteros ? 4 : 1
  if (props.enteros) return Math.max(4, Math.ceil(max / 4) * 4)  // cantidades: marcas enteras
  const p = 10 ** Math.floor(Math.log10(max))
  for (const f of [1, 2, 2.5, 5, 10]) if (f * p >= max) return f * p
  return 10 * p
})
const marcas = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxEje.value))
const y = (v: number) => M.arriba + internoY - (v / maxEje.value) * internoY
const paso = computed(() => internoX.value / Math.max(1, n.value))
const xCentro = (i: number) => M.izquierda + paso.value * i + paso.value / 2
const anchoColumna = computed(() => Math.max(4, Math.min(48, paso.value - 2 - paso.value * 0.3)))
const etiquetaEje = (v: number) => (props.formatoEje ?? props.formato)(v)
// Si hay muchas semanas/meses, se muestra una de cada k etiquetas.
const cadaK = computed(() => Math.max(1, Math.ceil(n.value / Math.floor(internoX.value / 56))))

/** Columna con las dos esquinas de arriba redondeadas (4 px) apoyada en la base. */
function columna(i: number, v: number) {
  const w = anchoColumna.value, x = xCentro(i) - w / 2, y0 = y(0), y1 = y(v), r = Math.min(4, w / 2, y0 - y1)
  if (y0 - y1 <= 0) return ''
  return `M${x},${y0} L${x},${y1 + r} Q${x},${y1} ${x + r},${y1} L${x + w - r},${y1} Q${x + w},${y1} ${x + w},${y1 + r} L${x + w},${y0} Z`
}
const linea = (s: Serie) => s.valores.map((v, i) => `${i ? 'L' : 'M'}${xCentro(i)},${y(v)}`).join(' ')

const activo = ref<number | null>(null)
const tooltipX = computed(() => (activo.value === null ? 0 : Math.min(xCentro(activo.value) + 12, ancho.value - 190)))
</script>

<template>
  <div>
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div v-if="series.length > 1" class="flex flex-wrap gap-3 text-xs text-slate-600" aria-hidden="true">
        <span v-for="s in series" :key="s.nombre" class="flex items-center gap-1.5"><span class="h-0.5 w-4 rounded" :style="{ background: s.color }" /> {{ s.nombre }}</span>
      </div>
      <span v-else />
      <button type="button" class="text-xs text-slate-500 underline-offset-2 hover:underline" @click="verTabla = !verTabla">{{ verTabla ? 'Ver gráfico' : 'Ver tabla' }}</button>
    </div>
    <div v-show="!verTabla" ref="contenedor" class="relative" @mouseleave="activo = null">
      <svg :width="ancho" :height="ALTO" role="img" :aria-label="titulo" class="block overflow-visible">
        <g>
          <line v-for="m in marcas" :key="m" :x1="M.izquierda" :x2="ancho - M.derecha" :y1="y(m)" :y2="y(m)" stroke="#e2e8f0" :stroke-width="m === 0 ? 1 : 0.75" />
          <text v-for="m in marcas" :key="`t${m}`" :x="M.izquierda - 8" :y="y(m)" dy="0.32em" text-anchor="end" class="fill-slate-400 text-[11px] tabular-nums">{{ etiquetaEje(m) }}</text>
        </g>
        <text v-for="(e, i) in etiquetas" v-show="i % cadaK === 0" :key="`x${i}`" :x="xCentro(i)" :y="ALTO - 8" text-anchor="middle" class="fill-slate-500 text-[11px]">{{ e }}</text>
        <template v-if="tipo === 'columnas'">
          <path v-for="(v, i) in series[0]?.valores ?? []" :key="`c${i}`" :d="columna(i, v)" :fill="series[0]!.color" :opacity="activo === null || activo === i ? 1 : 0.55" />
        </template>
        <template v-else>
          <line v-if="activo !== null" :x1="xCentro(activo)" :x2="xCentro(activo)" :y1="M.arriba" :y2="y(0)" stroke="#94a3b8" stroke-width="1" />
          <path v-for="s in series" :key="s.nombre" :d="linea(s)" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          <template v-if="activo !== null">
            <circle v-for="s in series" :key="`p${s.nombre}`" :cx="xCentro(activo)" :cy="y(s.valores[activo] ?? 0)" r="4.5" :fill="s.color" stroke="#fff" stroke-width="2" />
          </template>
        </template>
        <!-- Zonas de hover más anchas que las marcas -->
        <rect v-for="(_, i) in etiquetas" :key="`h${i}`" :x="M.izquierda + paso * i" :y="M.arriba" :width="paso" :height="internoY" fill="transparent" @mouseenter="activo = i" />
      </svg>
      <div v-if="activo !== null" class="pointer-events-none absolute top-2 z-10 w-44 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200" :style="{ left: `${tooltipX}px` }">
        <p class="mb-1 font-semibold text-slate-900">{{ etiquetas[activo] }}</p>
        <p v-for="s in series" :key="s.nombre" class="flex items-center justify-between gap-2 text-slate-600">
          <span class="flex items-center gap-1.5"><span class="size-2 rounded-full" :style="{ background: s.color }" />{{ s.nombre }}</span>
          <span class="font-medium tabular-nums text-slate-900">{{ formato(s.valores[activo] ?? 0) }}</span>
        </p>
      </div>
    </div>
    <div v-if="verTabla" class="max-h-72 overflow-auto">
      <table class="tabla text-sm">
        <thead class="bg-slate-50"><tr><th>Período</th><th v-for="s in series" :key="s.nombre" class="text-right">{{ s.nombre }}</th></tr></thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="(e, i) in etiquetas" :key="e + i"><td>{{ e }}</td><td v-for="s in series" :key="s.nombre" class="text-right tabular-nums">{{ formato(s.valores[i] ?? 0) }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
