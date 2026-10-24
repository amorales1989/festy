<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useOrganizacion } from '@/stores/organizacion'
const org = useOrganizacion()
const route = useRoute()
const pestanas = computed(() => [
  { nombre: 'cobros', etiqueta: 'Cobros', visible: org.puede('pagos.ver') },
  { nombre: 'caja', etiqueta: 'Caja', visible: org.puede('caja.ver') },
  { nombre: 'garantias', etiqueta: 'Garantías', visible: org.puede('pagos.ver') },
  { nombre: 'gastos', etiqueta: 'Gastos', visible: org.puede('gastos.ver') && org.tieneFuncion('gastos') },
  { nombre: 'proveedores', etiqueta: 'Proveedores', visible: org.puede('gastos.ver') },
  { nombre: 'rentabilidad', etiqueta: 'Rentabilidad', visible: org.puede('gastos.ver') && org.puede('pagos.ver') },
].filter((p) => p.visible))
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="titulo-pagina">Finanzas</h1>
    <nav class="-mx-1 flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5" aria-label="Secciones">
      <RouterLink v-for="p in pestanas" :key="p.nombre" :to="{ name: p.nombre }" :aria-current="route.name === p.nombre ? 'page' : undefined"
                  :class="['shrink-0 rounded-md px-3 py-1.5 text-sm font-medium sm:px-4', route.name === p.nombre ? 'bg-white shadow-sm' : 'text-slate-600']">
        {{ p.etiqueta }}</RouterLink>
    </nav>
  </div>
</template>
