<script setup lang="ts">
// Agenda en forma de lista: lo más cómodo en el celular.
import { computed } from 'vue'
import { ChevronRight, Lock, MessagesSquare } from 'lucide-vue-next'
import { fmtDiaLargo, fmtHora } from '@/lib/formato'
import { ESTADOS_RESERVA } from '@/lib/catalogos'
import InsigniaEstado from '@/components/ui/InsigniaEstado.vue'
import { diasDelItem, type ItemAgenda } from './agenda'

const props = defineProps<{ desde: string; hasta: string; hoy: string; items: ItemAgenda[]; zona: string; nombreEspacio: (id: string) => string }>()
const emit = defineEmits<{ elegirItem: [ItemAgenda] }>()

const dias = computed(() => {
  const mapa = new Map<string, ItemAgenda[]>()
  for (const it of props.items) {
    for (const d of diasDelItem(it, props.zona, true)) {
      if (d < props.desde || d > props.hasta) continue
      if (!mapa.has(d)) mapa.set(d, [])
      mapa.get(d)!.push(it)
    }
  }
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, lista]) => ({ dia, feriado: lista.find((i) => i.tipo === 'feriado')?.titulo, items: lista.filter((i) => i.tipo !== 'feriado').sort((a, b) => a.inicio.localeCompare(b.inicio)) }))
    .filter((d) => d.items.length || d.feriado)
})
</script>

<template>
  <div class="space-y-4">
    <section v-for="d in dias" :key="d.dia" :class="d.dia < hoy && 'opacity-60'">
      <h3 class="mb-1.5 flex items-center gap-2 text-sm font-semibold first-letter:uppercase">
        <span v-if="d.dia === hoy" class="rounded bg-marca-600 px-1.5 py-0.5 text-[10px] font-bold text-white">HOY</span>
        {{ fmtDiaLargo(d.dia) }}
        <span v-if="d.feriado" class="text-xs font-normal text-rose-600">· Feriado: {{ d.feriado }}</span>
      </h3>
      <ul v-if="d.items.length" class="tarjeta divide-y divide-slate-100">
        <li v-for="it in d.items" :key="it.clave">
          <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50" @click="emit('elegirItem', it)">
            <span class="w-12 shrink-0 text-sm font-semibold tabular-nums">{{ it.tipo === 'bloqueo' ? '—' : fmtHora(it.inicio, zona) }}</span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5 truncate text-sm font-medium"><span v-if="it.estado" :class="['size-2 shrink-0 rounded-full sm:hidden', ESTADOS_RESERVA[it.estado].punto]" /><Lock v-if="it.tipo === 'bloqueo'" class="size-3.5 text-slate-400" /><MessagesSquare v-if="it.tipo === 'entrevista'" class="size-3.5 shrink-0 text-indigo-500" />{{ it.tipo === 'bloqueo' ? `Cerrado: ${it.titulo}` : it.titulo }}</span>
              <span class="block truncate text-xs text-slate-500">
                hasta {{ fmtHora(it.fin, zona) }}<template v-if="it.espacioIds.length"> · {{ it.espacioIds.map(nombreEspacio).join(', ') }}</template><template v-if="it.invitados"> · {{ it.invitados }} inv.</template>
              </span>
            </span>
            <InsigniaEstado v-if="it.estado" :estado="it.estado" class="hidden sm:inline-flex" />
            <ChevronRight class="size-4 shrink-0 text-slate-300" />
          </button>
        </li>
      </ul>
    </section>
    <p v-if="!dias.length" class="tarjeta p-8 text-center text-sm text-slate-500">No hay eventos este mes.</p>
  </div>
</template>
