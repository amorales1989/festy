<script setup lang="ts">
withDefaults(defineProps<{ filas?: number }>(), { filas: 3 })
</script>

<template>
  <div class="space-y-3 p-4" role="status" aria-label="Cargando">
    <div v-for="i in filas" :key="i" class="h-10 animate-pulse rounded-lg bg-slate-100" />
    <span class="sr-only">Cargando…</span>
  </div>
</template>
