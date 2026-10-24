<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useOrganizacion } from '@/stores/organizacion'
const org = useOrganizacion()
const route = useRoute()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="titulo-pagina">Plata</h1>
    <nav class="flex rounded-lg bg-slate-100 p-0.5" aria-label="Secciones">
      <RouterLink v-if="org.puede('pagos.ver')" :to="{ name: 'cobros' }" :aria-current="route.name === 'cobros' ? 'page' : undefined"
                  :class="['rounded-md px-4 py-1.5 text-sm font-medium', route.name === 'cobros' ? 'bg-white shadow-sm' : 'text-slate-600']">Cobros</RouterLink>
      <RouterLink v-if="org.puede('pagos.ver')" :to="{ name: 'garantias' }" :aria-current="route.name === 'garantias' ? 'page' : undefined"
                  :class="['rounded-md px-4 py-1.5 text-sm font-medium', route.name === 'garantias' ? 'bg-white shadow-sm' : 'text-slate-600']">Garantías</RouterLink>
      <RouterLink v-if="org.puede('gastos.ver') && org.tieneFuncion('gastos')" :to="{ name: 'gastos' }" :aria-current="route.name === 'gastos' ? 'page' : undefined"
                  :class="['rounded-md px-4 py-1.5 text-sm font-medium', route.name === 'gastos' ? 'bg-white shadow-sm' : 'text-slate-600']">Gastos</RouterLink>
    </nav>
  </div>
</template>
