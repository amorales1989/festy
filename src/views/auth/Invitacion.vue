<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LayoutAuth from '@/layouts/LayoutAuth.vue'
import { api } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { useSesion } from '@/stores/sesion'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'

interface DatosInvitacion { valida: boolean; motivo?: string | null; organizacion?: string; rol?: string; email?: string }

const route = useRoute()
const router = useRouter()
const sesion = useSesion()
const token = String(route.params.token)
const datos = ref<DatosInvitacion | null>(null)
const error = ref('')
const ocupado = ref(false)

onMounted(async () => {
  try {
    datos.value = await api.get<DatosInvitacion>(`/invitaciones/${encodeURIComponent(token)}`)
  } catch (e) {
    error.value = traducirError(e)
  }
})

async function aceptar() {
  ocupado.value = true
  let orgId: string
  try {
    orgId = (await api.post<{ organizacion_id: string }>(`/invitaciones/${encodeURIComponent(token)}/aceptar`)).organizacion_id
  } catch (e) {
    error.value = traducirError(e)
    return
  } finally {
    ocupado.value = false
  }
  const org = useOrganizacion()
  org.reiniciar()
  await org.cargarOrganizaciones()
  await org.seleccionar(orgId)
  useNotificaciones().exito(`Te uniste a ${datos.value?.organizacion}.`)
  await router.replace('/')
}
</script>

<template>
  <LayoutAuth titulo="Invitación a Festy">
    <p v-if="!datos && !error" class="text-sm text-slate-500">Verificando invitación…</p>
    <div v-else-if="datos && !datos.valida" class="text-sm text-slate-600">{{ datos.motivo }}</div>
    <div v-else-if="datos" class="space-y-4 text-sm text-slate-600">
      <p>Te invitaron a sumarte a <strong>{{ datos.organizacion }}</strong> con el rol <strong>{{ datos.rol }}</strong>.</p>
      <template v-if="sesion.autenticado">
        <p v-if="sesion.usuario?.email?.toLowerCase() !== datos.email?.toLowerCase()" class="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
          La invitación es para <strong>{{ datos.email }}</strong> y estás con <strong>{{ sesion.usuario?.email }}</strong>.
          <button class="enlace" @click="sesion.salir()">Cambiar de cuenta</button>
        </p>
        <button class="btn-primario w-full" :disabled="ocupado" @click="aceptar">Aceptar invitación</button>
      </template>
      <div v-else class="grid gap-2 sm:grid-cols-2">
        <RouterLink :to="{ path: '/registro', query: { volver: route.fullPath } }" class="btn-primario">Crear cuenta</RouterLink>
        <RouterLink :to="{ path: '/ingresar', query: { volver: route.fullPath } }" class="btn-secundario">Ya tengo cuenta</RouterLink>
      </div>
      <p class="text-xs text-slate-500">Usá el email {{ datos.email }}.</p>
    </div>
    <p v-if="error" class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
  </LayoutAuth>
</template>
