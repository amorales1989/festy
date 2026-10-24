<script setup lang="ts">
import { CircleCheck, CircleX, Info, X } from 'lucide-vue-next'
import { useNotificaciones } from '@/composables/useNotificaciones'
const { notificaciones, cerrar } = useNotificaciones()
const iconos = { exito: CircleCheck, error: CircleX, info: Info }
const colores = { exito: 'text-emerald-600', error: 'text-rose-600', info: 'text-sky-600' }
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[calc(1rem+var(--ins-bottom))] sm:items-end" aria-live="polite">
    <TransitionGroup enter-from-class="translate-y-2 opacity-0" leave-to-class="opacity-0" enter-active-class="transition" leave-active-class="transition">
      <div v-for="n in notificaciones" :key="n.id" :role="n.tipo === 'error' ? 'alert' : 'status'"
           class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-white p-3.5 shadow-lg ring-1 ring-slate-200">
        <component :is="iconos[n.tipo]" :class="['mt-0.5 size-5 shrink-0', colores[n.tipo]]" />
        <p class="flex-1 text-sm text-slate-700">{{ n.texto }}</p>
        <button class="text-slate-400 hover:text-slate-600" aria-label="Cerrar aviso" @click="cerrar(n.id)"><X class="size-4" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>
