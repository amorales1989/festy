<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{ titulo: string; descripcion?: string; icono?: Component }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
    <div v-if="icono" class="mb-3 flex size-12 items-center justify-center rounded-full bg-marca-50">
      <component :is="icono" class="size-6 text-marca-600" />
    </div>
    <h3 class="text-sm font-semibold text-slate-900">{{ titulo }}</h3>
    <p v-if="descripcion" class="mt-1 max-w-sm text-sm text-slate-500">{{ descripcion }}</p>
    <div v-if="$slots.default" class="mt-4"><slot /></div>
  </div>
</template>
