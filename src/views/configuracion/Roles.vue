<script setup lang="ts">
// Matriz de permisos por rol. Se edita en vivo; la base impide modificar el
// rol Propietario y solo permite cambios a quien tiene roles.gestionar.
import { computed, onMounted, ref } from 'vue'
import { Lock } from 'lucide-vue-next'
import type { Fila } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'

const org = useOrganizacion()
const { error: notificarError } = useNotificaciones()
const roles = ref<Fila<'roles'>[]>([])
const permisos = ref<Fila<'permisos'>[]>([])
const asignados = ref(new Set<string>())
const puede = computed(() => org.puede('roles.gestionar'))

async function cargar() {
  try {
    const m = await api.get<{ roles: Fila<'roles'>[]; permisos: Fila<'permisos'>[]; asignados: Array<{ rol_id: string; permiso: string }> }>(
      rutaOrg(org.id, 'roles/matriz'))
    roles.value = m.roles
    permisos.value = m.permisos
    asignados.value = new Set(m.asignados.map((x) => `${x.rol_id}|${x.permiso}`))
  } catch (e) { notificarError(e) }
}
onMounted(cargar)
const modulos = computed(() => [...new Set(permisos.value.map((p) => p.modulo))])

async function alternar(rol: Fila<'roles'>, permiso: string) {
  const clave = `${rol.id}|${permiso}`
  const tenia = asignados.value.has(clave)
  const copia = new Set(asignados.value)
  if (tenia) copia.delete(clave)
  else copia.add(clave)
  asignados.value = copia
  try {
    await api.put(rutaOrg(org.id, 'roles/permisos'), { rol_id: rol.id, permiso, asignar: !tenia })
  } catch (e) {
    notificarError(e)
    void cargar()
  }
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm text-slate-600">
      Definí qué puede hacer cada rol. Los cambios aplican de inmediato a todos los usuarios con ese rol (al recargar la página).
      <template v-if="!puede"> Tu rol solo permite ver esta matriz.</template>
    </p>
    <div class="tarjeta overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="sticky top-0 bg-slate-50">
          <tr>
            <th class="sticky left-0 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-500">Permiso</th>
            <th v-for="r in roles" :key="r.id" class="px-2 py-2 text-center text-xs font-semibold text-slate-700" :title="r.descripcion ?? ''">
              <span class="inline-flex items-center gap-1">{{ r.nombre }}<Lock v-if="r.clave === 'propietario'" class="size-3 text-slate-400" /></span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="m in modulos" :key="m">
            <tr><td :colspan="roles.length + 1" class="bg-slate-50/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{{ m }}</td></tr>
            <tr v-for="p in permisos.filter((x) => x.modulo === m)" :key="p.clave" class="border-t border-slate-100">
              <td class="sticky left-0 bg-white px-3 py-2">{{ p.descripcion }}</td>
              <td v-for="r in roles" :key="r.id" class="px-2 py-2 text-center">
                <input type="checkbox" :checked="asignados.has(`${r.id}|${p.clave}`)" :disabled="!puede || r.clave === 'propietario'"
                       class="rounded border-slate-300 text-marca-600 disabled:opacity-50" :aria-label="`${r.nombre}: ${p.descripcion}`" @change="alternar(r, p.clave)" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
