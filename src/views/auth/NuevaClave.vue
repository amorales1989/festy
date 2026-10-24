<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LayoutAuth from '@/layouts/LayoutAuth.vue'
import Campo from '@/components/ui/Campo.vue'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { useSesion } from '@/stores/sesion'
import { useNotificaciones } from '@/composables/useNotificaciones'

const router = useRouter()
const route = useRoute()
const validando = ref(false)

// El enlace del mail trae un código de un solo uso (token_hash): se valida acá, así
// funciona aunque el mail se abra en otro dispositivo que donde se pidió.
onMounted(async () => {
  const tokenHash = typeof route.query.token_hash === 'string' ? route.query.token_hash : ''
  if (!tokenHash) return
  validando.value = true
  const { error: e } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
  validando.value = false
  if (e) error.value = 'El enlace no es válido o ya venció. Pedí uno nuevo.'
  else await sesion.cargarPerfil()
  await router.replace({ query: {} })
})
const sesion = useSesion()
const clave = ref('')
const repetir = ref('')
const error = ref('')
const ocupado = ref(false)
const valido = computed(() => clave.value.length >= 8 && clave.value === repetir.value)
// Cuenta de demostración compartida: la base no deja cambiarle la contraseña (migración 13).
const esDemo = computed(() => sesion.usuario?.app_metadata?.demo === true)

async function guardar() {
  error.value = ''
  ocupado.value = true
  const { error: e } = await supabase.auth.updateUser({ password: clave.value })
  ocupado.value = false
  if (e) {
    error.value = traducirError(e)
    return
  }
  useNotificaciones().exito('Actualizamos tu contraseña.')
  await router.replace('/')
}
</script>

<template>
  <LayoutAuth titulo="Elegí una nueva contraseña">
    <p v-if="validando" class="text-sm text-slate-500">Validando el enlace…</p>
    <p v-else-if="!sesion.autenticado" class="text-sm text-slate-600">
      El enlace no es válido o ya venció. <RouterLink to="/recuperar" class="enlace">Pedí uno nuevo</RouterLink>.
    </p>
    <p v-else-if="esDemo" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
      Esta es la cuenta de demostración: su contraseña no se puede cambiar. <RouterLink to="/" class="enlace">Volver al inicio</RouterLink>
    </p>
    <form v-else class="space-y-4" @submit.prevent="guardar">
      <Campo etiqueta="Nueva contraseña" para="clave" ayuda="Mínimo 8 caracteres.">
        <input id="clave" v-model="clave" type="password" autocomplete="new-password" class="entrada" />
      </Campo>
      <Campo etiqueta="Repetila" para="repetir" :error="repetir && repetir !== clave ? 'Las contraseñas no coinciden.' : ''">
        <input id="repetir" v-model="repetir" type="password" autocomplete="new-password" class="entrada" />
      </Campo>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
      <button class="btn-primario w-full" :disabled="ocupado || !valido">Guardar contraseña</button>
      <button type="button" class="enlace block w-full text-center text-sm" @click="router.back()">Cancelar</button>
    </form>
  </LayoutAuth>
</template>
