<script setup lang="ts">
defineProps<{ etiqueta: string; error?: string | null; ayuda?: string; requerido?: boolean; para?: string }>()
</script>

<template>
  <div>
    <label :for="para" class="mb-1 block text-sm font-medium text-slate-700">
      {{ etiqueta }}<span v-if="requerido" class="text-rose-500" aria-hidden="true"> *</span>
    </label>
    <slot />
    <p v-if="error" class="mt-1 text-xs text-rose-600" role="alert">{{ error }}</p>
    <p v-else-if="ayuda" class="mt-1 text-xs text-slate-500">{{ ayuda }}</p>
  </div>
</template>
