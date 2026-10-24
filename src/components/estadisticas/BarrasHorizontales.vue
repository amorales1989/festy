<script setup lang="ts">
// Barras horizontales de una sola serie (magnitud por categoría). Etiqueta y valor
// siempre visibles en texto, así que la lista es también su propia tabla.
import { computed } from 'vue'

export interface FilaBarra { clave: string; etiqueta: string; valor: number; detalle?: string }
const props = withDefaults(defineProps<{ filas: FilaBarra[]; formato?: (v: number) => string; vacio?: string; tono?: 'serie' | 'ordinal' }>(), {
  formato: (v: number) => v.toLocaleString('es-AR'), vacio: 'Sin datos en el período.', tono: 'serie',
})
const maximo = computed(() => Math.max(0, ...props.filas.map((f) => f.valor)))
const ancho = (v: number) => (maximo.value > 0 ? Math.max(v > 0 ? 1.5 : 0, (v / maximo.value) * 100) : 0)
// Embudo (ordinal): un solo tono, de más oscuro a más claro, sin bajar de 2:1 contra el fondo.
const ORDINAL = ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef']
const color = (i: number) => (props.tono === 'ordinal' ? ORDINAL[Math.min(i, ORDINAL.length - 1)] : 'var(--serie-1)')
</script>

<template>
  <p v-if="!filas.length" class="py-6 text-center text-sm text-slate-500">{{ vacio }}</p>
  <ul v-else class="space-y-2.5">
    <li v-for="(f, i) in filas" :key="f.clave" class="group" :title="`${f.etiqueta}: ${formato(f.valor)}${f.detalle ? ` · ${f.detalle}` : ''}`">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="min-w-0 truncate text-slate-700">{{ f.etiqueta }}</span>
        <span class="shrink-0 font-semibold tabular-nums text-slate-900">{{ formato(f.valor) }}<span v-if="f.detalle" class="ml-1.5 text-xs font-normal text-slate-500">{{ f.detalle }}</span></span>
      </div>
      <div class="mt-1 h-2 rounded-full bg-slate-100" aria-hidden="true">
        <div class="h-2 rounded-full transition-[width] group-hover:opacity-80" :style="{ width: `${ancho(f.valor)}%`, background: color(i) }" />
      </div>
    </li>
  </ul>
</template>
