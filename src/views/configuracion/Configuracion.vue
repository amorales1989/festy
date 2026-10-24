<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useOrganizacion } from '@/stores/organizacion'

const org = useOrganizacion()
const route = useRoute()
const secciones = computed(() => [
  { nombre: 'config-organizacion', etiqueta: 'Organización', visible: true },
  { nombre: 'config-sedes', etiqueta: 'Sedes y espacios', visible: true },
  { nombre: 'config-feriados', etiqueta: 'Feriados', visible: true },
  { nombre: 'config-usuarios', etiqueta: 'Usuarios', visible: org.puede('usuarios.gestionar') },
  { nombre: 'config-roles', etiqueta: 'Roles y permisos', visible: true },
  { nombre: 'config-auditoria', etiqueta: 'Auditoría', visible: org.puede('auditoria.ver') },
  { nombre: 'config-datos', etiqueta: 'Datos y cuenta', visible: true },
].filter((s) => s.visible))
</script>

<template>
  <div class="space-y-4">
    <h1 class="titulo-pagina">Ajustes</h1>
    <nav class="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Secciones de configuración">
      <ul class="flex min-w-max gap-1 border-b border-slate-200">
        <li v-for="s in secciones" :key="s.nombre">
          <RouterLink :to="{ name: s.nombre }" :aria-current="route.name === s.nombre ? 'page' : undefined"
                      :class="['block border-b-2 px-3 py-2 text-sm font-medium', route.name === s.nombre ? 'border-marca-600 text-marca-700' : 'border-transparent text-slate-600 hover:text-slate-900']">
            {{ s.etiqueta }}
          </RouterLink>
        </li>
      </ul>
    </nav>
    <RouterView />
  </div>
</template>
