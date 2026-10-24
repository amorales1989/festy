<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useOrganizacion } from '@/stores/organizacion'
const org = useOrganizacion()
const route = useRoute()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="titulo-pagina">Presupuestos</h1>
    <nav class="flex rounded-lg bg-slate-100 p-0.5" aria-label="Secciones">
      <RouterLink :to="{ name: 'presupuestos' }" :aria-current="route.name === 'presupuestos' ? 'page' : undefined"
                  :class="['rounded-md px-4 py-1.5 text-sm font-medium', route.name === 'presupuestos' ? 'bg-white shadow-sm' : 'text-slate-600']">Presupuestos</RouterLink>
      <RouterLink v-if="org.puede('catalogo.gestionar') || org.puede('presupuestos.ver')" :to="{ name: 'catalogo' }" :aria-current="route.name === 'catalogo' ? 'page' : undefined"
                  :class="['rounded-md px-4 py-1.5 text-sm font-medium', route.name === 'catalogo' ? 'bg-white shadow-sm' : 'text-slate-600']">Catálogo de servicios</RouterLink>
    </nav>
  </div>
</template>
