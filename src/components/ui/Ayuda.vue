<script setup lang="ts">
import { useId } from 'vue'
import { CircleHelp } from 'lucide-vue-next'
defineProps<{ texto: string }>()
const id = useId()
</script>

<template>
  <span class="group relative inline-flex align-middle">
    <button type="button" class="text-slate-400 hover:text-marca-600" aria-label="Más información" :aria-describedby="id"><CircleHelp class="size-4" /></button>
    <span :id="id" role="tooltip"
          class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal text-white opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:opacity-100">
      {{ texto }}
    </span>
  </span>
</template>
