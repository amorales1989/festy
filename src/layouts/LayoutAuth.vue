<script setup lang="ts">
defineProps<{ titulo: string; subtitulo?: string }>()
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-marca-50 via-white to-amber-50 px-4 pt-[calc(2.5rem+var(--ins-top))] pb-[calc(2.5rem+var(--ins-bottom))]">
    <div class="mb-6 flex items-center gap-2">
      <img src="/favicon.svg" alt="" class="size-9" />
      <span class="text-2xl font-bold tracking-tight text-slate-900">Festy</span>
    </div>
    <main class="tarjeta w-full max-w-md p-6 sm:p-8">
      <h1 class="text-lg font-semibold text-slate-900">{{ titulo }}</h1>
      <p v-if="subtitulo" class="mt-1 text-sm text-slate-500">{{ subtitulo }}</p>
      <div class="mt-6"><slot /></div>
    </main>
    <div class="mt-6 text-center text-sm text-slate-500"><slot name="pie" /></div>
  </div>
</template>
