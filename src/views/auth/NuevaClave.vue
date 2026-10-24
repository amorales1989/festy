<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import LayoutAuth from '@/layouts/LayoutAuth.vue'
import Campo from '@/components/ui/Campo.vue'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { useSesion } from '@/stores/sesion'
import { useNotificaciones } from '@/composables/useNotificaciones'

const router = useRouter()
const sesion = useSesion()
const clave = ref('')
const repetir = ref('')
const error = ref('')
const ocupado = ref(false)
const valido = computed(() => clave.value.length >= 8 && clave.value === repetir.value)

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
    <p v-if="!sesion.autenticado" class="text-sm text-slate-600">
      El enlace no es válido o ya venció. <RouterLink to="/recuperar" class="enlace">Pedí uno nuevo</RouterLink>.
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
    </form>
  </LayoutAuth>
</template>
