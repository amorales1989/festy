<script setup lang="ts">
import { computed } from 'vue'
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { fechaDeISO, fmtHora } from '@/lib/formato'
import { ESTADOS_RESERVA, ESTADOS_BLOQUEANTES } from '@/lib/catalogos'
import { diasDelItem, type ItemAgenda } from './agenda'

const props = defineProps<{ mes: string; hoy: string; items: ItemAgenda[]; zona: string; espacioIds: string[]; puedeCrear: boolean; seleccionado?: string }>()
const emit = defineEmits<{ elegirItem: [ItemAgenda]; elegirDia: [string]; nuevaEn: [string] }>()

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const semanas = computed(() => {
  const base = fechaDeISO(props.mes)
  const ini = startOfWeek(startOfMonth(base), { weekStartsOn: 1 })
  const fin = endOfWeek(endOfMonth(base), { weekStartsOn: 1 })
  const dias: string[] = []
  for (let d = ini; d <= fin; d = addDays(d, 1)) dias.push(format(d, 'yyyy-MM-dd'))
  return Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7))
})

const porDia = computed(() => {
  const mapa = new Map<string, ItemAgenda[]>()
  for (const it of props.items) for (const d of diasDelItem(it, props.zona, true)) {
    if (!mapa.has(d)) mapa.set(d, [])
    mapa.get(d)!.push(it)
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.inicio.localeCompare(b.inicio))
  return mapa
})

/** Espacios sin reserva bloqueante ni bloqueo ese día. */
function libres(dia: string): number {
  const ocupados = new Set<string>()
  for (const it of porDia.value.get(dia) ?? []) {
    if (it.tipo === 'bloqueo' || (it.tipo === 'reserva' && ESTADOS_BLOQUEANTES.includes(it.estado!))) it.espacioIds.forEach((e) => ocupados.add(e))
  }
  return props.espacioIds.filter((e) => !ocupados.has(e)).length
}

const mesActual = computed(() => props.mes.slice(0, 7))
function clasesItem(it: ItemAgenda) {
  if (it.tipo === 'entrevista') return 'bg-indigo-50 text-indigo-800 ring-indigo-200'
  if (it.tipo === 'bloqueo') return 'bg-slate-200 text-slate-700 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,.6)_4px,rgba(255,255,255,.6)_8px)]'
  return ESTADOS_RESERVA[it.estado!].clase
}
</script>

<template>
  <div class="overflow-hidden rounded-xl ring-1 ring-slate-200">
    <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
      <div v-for="d in DIAS" :key="d" class="py-2">{{ d }}</div>
    </div>
    <div v-for="(semana, i) in semanas" :key="i" class="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
      <div v-for="dia in semana" :key="dia"
           :class="['group relative min-h-24 cursor-pointer border-r border-slate-100 p-1 last:border-r-0 hover:bg-marca-50/40 sm:min-h-28 sm:p-1.5',
                    dia.slice(0, 7) !== mesActual ? 'bg-slate-50/70' : 'bg-white', dia < hoy && 'opacity-75', seleccionado === dia && 'ring-2 ring-inset ring-marca-500']"
           @click="emit('elegirDia', dia)">
        <div class="flex items-center justify-between gap-1">
          <button type="button" :class="['flex size-7 items-center justify-center rounded-full text-xs font-medium',
                         dia === hoy ? 'bg-marca-600 text-white' : 'text-slate-700 hover:bg-slate-100']"
                  :aria-label="`Ver el día ${dia.split('-').reverse().join('/')}`" @click.stop="emit('elegirDia', dia)">
            {{ Number(dia.slice(8)) }}
          </button>
          <span v-if="espacioIds.length && dia >= hoy && dia.slice(0, 7) === mesActual"
                :class="['hidden rounded px-1 text-[10px] font-medium sm:inline', libres(dia) ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700']"
                :title="`${libres(dia)} de ${espacioIds.length} espacios libres`">
            {{ libres(dia) ? `${libres(dia)} libre${libres(dia) > 1 ? 's' : ''}` : 'Completo' }}
          </span>
        </div>
        <ul class="mt-1 space-y-0.5">
          <template v-for="(it, n) in porDia.get(dia) ?? []" :key="it.clave">
            <li v-if="it.tipo === 'feriado'" class="truncate rounded bg-rose-50 px-1 text-[10px] font-medium text-rose-700" :title="it.titulo">Feriado · {{ it.titulo }}</li>
            <li v-else-if="n < 3">
              <button type="button" :class="['block w-full truncate rounded px-1 py-0.5 text-left text-[11px] ring-1 ring-inset', clasesItem(it)]"
                      :title="`${it.titulo} · ${fmtHora(it.inicio, zona)}`" @click.stop="emit('elegirItem', it)">
                <template v-if="it.tipo === 'bloqueo'">Cerrado · {{ it.titulo }}</template>
                <template v-else><span class="hidden font-semibold sm:inline">{{ fmtHora(it.inicio, zona) }}</span> {{ it.titulo }}</template>
              </button>
            </li>
          </template>
          <li v-if="(porDia.get(dia)?.filter((x) => x.tipo !== 'feriado').length ?? 0) > 3">
            <button type="button" class="px-1 text-[11px] font-medium text-marca-700 hover:underline" @click.stop="emit('elegirDia', dia)">
              +{{ (porDia.get(dia)?.filter((x) => x.tipo !== 'feriado').length ?? 0) - 3 }} más
            </button>
          </li>
        </ul>
        <button v-if="puedeCrear && dia >= hoy" type="button"
                class="absolute bottom-1 right-1 hidden rounded bg-marca-600 px-1.5 text-xs font-semibold text-white group-hover:block focus:block"
                :aria-label="`Nueva reserva el ${dia.split('-').reverse().join('/')}`" @click.stop="emit('nuevaEn', dia)">+</button>
      </div>
    </div>
  </div>
</template>
