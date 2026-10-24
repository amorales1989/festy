<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LayoutAuth from '@/layouts/LayoutAuth.vue'
import Campo from '@/components/ui/Campo.vue'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { useOrganizacion } from '@/stores/organizacion'

// El registro público está cerrado en producción: las cuentas las crea la administración.
const REGISTRO_PUBLICO = import.meta.env.VITE_REGISTRO_PUBLICO === 'true'

const route = useRoute()
const router = useRouter()
const email = ref('')
const clave = ref('')
const error = ref('')
const ocupado = ref(false)

async function ingresar() {
  error.value = ''
  ocupado.value = true
  const { error: e } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: clave.value })
  ocupado.value = false
  if (e) {
    error.value = traducirError(e)
    return
  }
  useOrganizacion().reiniciar()
  await router.replace(typeof route.query.volver === 'string' ? route.query.volver : '/')
}
</script>

<template>
  <LayoutAuth titulo="Ingresá a tu cuenta" subtitulo="Gestioná tus salones, reservas y cobros.">
    <form class="space-y-4" novalidate @submit.prevent="ingresar">
      <Campo etiqueta="Email" para="email">
        <input id="email" v-model="email" type="email" autocomplete="email" required class="entrada" />
      </Campo>
      <Campo etiqueta="Contraseña" para="clave">
        <input id="clave" v-model="clave" type="password" autocomplete="current-password" required class="entrada" />
      </Campo>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
      <button type="submit" class="btn-primario w-full" :disabled="ocupado || !email || !clave">
        {{ ocupado ? 'Ingresando…' : 'Ingresar' }}
      </button>
      <div class="text-center">
        <RouterLink to="/recuperar" class="enlace text-sm">¿Olvidaste tu contraseña?</RouterLink>
      </div>
    </form>
    <template #pie>
      <template v-if="REGISTRO_PUBLICO">
        ¿No tenés cuenta?
        <RouterLink :to="{ path: '/registro', query: route.query }" class="enlace">Creá una</RouterLink>
      </template>
      <template v-else>¿Todavía no tenés cuenta? Pedísela a quien administra tu salón o a Festy.</template>
    </template>
  </LayoutAuth>
</template>
