<script setup lang="ts">
// Grilla horaria para vistas semanal (columnas = días) y diaria (columnas =
// espacios). Muestra el evento y, en tono suave, el tiempo de montaje/limpieza.
import { computed, onMounted, ref } from 'vue'
import { fmtHora } from '@/lib/formato'
import { ESTADOS_RESERVA } from '@/lib/catalogos'
import { diasDelItem, minutosEnDia, type Columna, type ItemAgenda } from './agenda'

const props = defineProps<{ columnas: Columna[]; items: ItemAgenda[]; zona: string; hoy: string; puedeCrear: boolean }>()
const emit = defineEmits<{ elegirItem: [ItemAgenda]; nuevaEn: [dia: string, hora: string, espacioId?: string] }>()

const ALTO_HORA = 44
const HORAS = Array.from({ length: 24 }, (_, h) => h)
const contenedor = ref<HTMLElement | null>(null)
onMounted(() => { contenedor.value?.scrollTo({ top: 8 * ALTO_HORA }) })

interface Bloque { item: ItemAgenda; top: number; alto: number; ocTop: number; ocAlto: number; carril: number; carriles: number }

function bloquesDe(col: Columna): Bloque[] {
  const lista = props.items.filter((it) => it.tipo !== 'feriado'
    && diasDelItem({ ...it, inicio: it.ocupaInicio ?? it.inicio, fin: it.ocupaFin ?? it.fin }, props.zona).includes(col.dia)
    && (!col.espacioId || it.espacioIds.includes(col.espacioId)))
  const recortar = (m: number) => Math.min(Math.max(m, 0), 1440)
  const bloques: Bloque[] = lista.map((item) => {
    const i = recortar(minutosEnDia(item.inicio, col.dia, props.zona))
    const f = recortar(minutosEnDia(item.fin, col.dia, props.zona))
    const oi = recortar(minutosEnDia(item.ocupaInicio ?? item.inicio, col.dia, props.zona))
    const of = recortar(minutosEnDia(item.ocupaFin ?? item.fin, col.dia, props.zona))
    return { item, top: (i / 60) * ALTO_HORA, alto: Math.max(((f - i) / 60) * ALTO_HORA, f > i ? 18 : 0),
             ocTop: (oi / 60) * ALTO_HORA, ocAlto: ((of - oi) / 60) * ALTO_HORA, carril: 0, carriles: 1 }
  }).sort((a, b) => a.ocTop - b.ocTop)
  // asignación de carriles para superposiciones visibles (p. ej. consultas sobre el mismo horario)
  const finCarril: number[] = []
  for (const b of bloques) {
    let c = finCarril.findIndex((fin) => fin <= b.ocTop)
    if (c < 0) { c = finCarril.length; finCarril.push(0) }
    finCarril[c] = b.ocTop + b.ocAlto
    b.carril = c
  }
  for (const b of bloques) b.carriles = finCarril.length
  return bloques
}
const bloques = computed(() => new Map(props.columnas.map((c) => [c.clave, bloquesDe(c)])))
const feriados = computed(() => new Map(props.items.filter((i) => i.tipo === 'feriado').flatMap((f) => diasDelItem(f, props.zona).map((d) => [d, f.titulo]))))

function alClic(col: Columna, e: MouseEvent) {
  if (!props.puedeCrear || col.dia < props.hoy) return
  const y = e.offsetY
  const minutos = Math.floor(y / ALTO_HORA * 2) * 30
  const hora = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
  emit('nuevaEn', col.dia, hora, col.espacioId)
}
function clases(it: ItemAgenda) {
  if (it.tipo === 'entrevista') return 'bg-indigo-50 text-indigo-800 ring-indigo-200'
  if (it.tipo === 'bloqueo') return 'bg-slate-200 text-slate-700 ring-slate-300'
  return ESTADOS_RESERVA[it.estado!].clase
}
const ahoraMin = computed(() => {
  const col = props.columnas.find((c) => c.dia === props.hoy)
  return col ? minutosEnDia(new Date().toISOString(), props.hoy, props.zona) : null
})
</script>

<template>
  <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
    <div class="overflow-x-auto">
      <div :style="{ minWidth: `${3.5 + columnas.length * 7}rem` }">
        <div class="sticky top-0 z-10 grid border-b border-slate-200 bg-slate-50" :style="{ gridTemplateColumns: `3.5rem repeat(${columnas.length}, minmax(7rem, 1fr))` }">
          <div />
          <div v-for="c in columnas" :key="c.clave" class="border-l border-slate-200 px-2 py-2 text-center">
            <p :class="['text-xs font-semibold', c.dia === hoy && !c.espacioId ? 'text-marca-700' : 'text-slate-700']">
              <span v-if="c.color" class="mr-1 inline-block size-2 rounded-full" :style="{ background: c.color }" />{{ c.etiqueta }}
            </p>
            <p v-if="c.sub" class="text-[11px] text-slate-500">{{ c.sub }}</p>
            <p v-if="feriados.get(c.dia)" class="truncate text-[10px] font-medium text-rose-600" :title="feriados.get(c.dia)">Feriado</p>
          </div>
        </div>
        <div ref="contenedor" class="relative max-h-[65vh] overflow-y-auto">
          <div class="grid" :style="{ gridTemplateColumns: `3.5rem repeat(${columnas.length}, minmax(7rem, 1fr))` }">
            <div>
              <div v-for="h in HORAS" :key="h" :style="{ height: `${ALTO_HORA}px` }" class="relative pr-2 text-right text-[10px] text-slate-400">
                <span class="relative -top-1.5">{{ h === 0 ? '' : `${String(h).padStart(2, '0')}:00` }}</span>
              </div>
            </div>
            <div v-for="c in columnas" :key="c.clave" :class="['relative border-l border-slate-100', c.dia < hoy && 'bg-slate-50/60', puedeCrear && c.dia >= hoy && 'cursor-cell']"
                 :style="{ height: `${24 * ALTO_HORA}px` }" @click.self="alClic(c, $event)">
              <div v-for="h in HORAS" :key="h" class="pointer-events-none border-b border-slate-100" :style="{ height: `${ALTO_HORA}px` }" />
              <div v-if="ahoraMin !== null && c.dia === hoy" class="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-rose-500"
                   :style="{ top: `${(ahoraMin / 60) * ALTO_HORA}px` }" />
              <template v-for="b in bloques.get(c.clave)" :key="b.item.clave">
                <div v-if="b.item.tipo === 'reserva' && b.ocAlto > b.alto" class="pointer-events-none absolute rounded-md bg-slate-400/15 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(100,116,139,.12)_3px,rgba(100,116,139,.12)_6px)]"
                     :style="{ top: `${b.ocTop}px`, height: `${b.ocAlto}px`, left: `calc(${(b.carril / b.carriles) * 100}% + 2px)`, width: `calc(${100 / b.carriles}% - 4px)` }"
                     title="Montaje / limpieza" />
                <button type="button" :class="['absolute flex flex-col items-start justify-start overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ring-1 ring-inset hover:z-10 hover:shadow-md', clases(b.item)]"
                        :style="{ top: `${b.item.tipo === 'reserva' ? b.top : b.ocTop}px`, height: `${b.item.tipo === 'reserva' ? b.alto : b.ocAlto}px`,
                                  left: `calc(${(b.carril / b.carriles) * 100}% + 2px)`, width: `calc(${100 / b.carriles}% - 4px)` }"
                        :title="`${b.item.titulo} · ${fmtHora(b.item.inicio, zona)} a ${fmtHora(b.item.fin, zona)}`" @click="emit('elegirItem', b.item)">
                  <span class="block w-full truncate font-semibold">{{ b.item.tipo === 'bloqueo' ? 'Bloqueado' : `#${b.item.numero} ${b.item.titulo}` }}</span>
                  <span class="block w-full truncate opacity-80">{{ fmtHora(b.item.inicio, zona) }}–{{ fmtHora(b.item.fin, zona) }}<template v-if="b.item.tipo === 'bloqueo' && b.item.motivo"> · {{ b.item.motivo }}</template></span>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
