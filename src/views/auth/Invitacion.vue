<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LayoutAuth from '@/layouts/LayoutAuth.vue'
import Campo from '@/components/ui/Campo.vue'
import { api, ErrorApi } from '@/lib/api'
import { supabase } from '@/lib/supabase'
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

// Sin registro público: el invitado crea su cuenta acá, con el email de la invitación.
const nueva = reactive({ nombre: '', clave: '', repetir: '' })
const yaTieneCuenta = ref(false)
const claveValida = computed(() => nueva.clave.length >= 8 && nueva.clave === nueva.repetir)
async function crearCuenta() {
  error.value = ''
  if (nueva.nombre.trim().length < 2) { error.value = 'Ingresá tu nombre.'; return }
  if (!claveValida.value) { error.value = 'La contraseña debe tener al menos 8 caracteres y coincidir en los dos campos.'; return }
  ocupado.value = true
  try {
    await api.post(`/invitaciones/${encodeURIComponent(token)}/cuenta`, { nombre: nueva.nombre.trim(), clave: nueva.clave })
    const { error: e } = await supabase.auth.signInWithPassword({ email: datos.value!.email!, password: nueva.clave })
    if (e) throw e
    await sesion.cargarPerfil()
    ocupado.value = false
    await aceptar()
  } catch (e) {
    if (e instanceof ErrorApi && e.status === 409) yaTieneCuenta.value = true
    error.value = traducirError(e)
    ocupado.value = false
  }
}

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
      <template v-else>
        <form v-if="!yaTieneCuenta" class="space-y-3" @submit.prevent="crearCuenta">
          <p>Creá tu cuenta para entrar. Tu usuario va a ser <strong>{{ datos.email }}</strong>.</p>
          <Campo etiqueta="Tu nombre" para="inv-nombre"><input id="inv-nombre" v-model="nueva.nombre" class="entrada" autocomplete="name" /></Campo>
          <Campo etiqueta="Contraseña" para="inv-clave" ayuda="Mínimo 8 caracteres."><input id="inv-clave" v-model="nueva.clave" type="password" class="entrada" autocomplete="new-password" /></Campo>
          <Campo etiqueta="Repetí la contraseña" para="inv-repetir" :error="nueva.repetir && nueva.repetir !== nueva.clave ? 'Las contraseñas no coinciden.' : ''">
            <input id="inv-repetir" v-model="nueva.repetir" type="password" class="entrada" autocomplete="new-password" /></Campo>
          <button class="btn-primario w-full" :disabled="ocupado">{{ ocupado ? 'Creando tu cuenta…' : 'Crear cuenta y unirme' }}</button>
        </form>
        <RouterLink :to="{ path: '/ingresar', query: { volver: route.fullPath } }" :class="yaTieneCuenta ? 'btn-primario w-full' : 'enlace block text-center'">
          {{ yaTieneCuenta ? 'Ingresar para aceptar' : 'Ya tengo cuenta: ingresar' }}</RouterLink>
      </template>
    </div>
    <p v-if="error" class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
  </LayoutAuth>
</template>
