<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LayoutAuth from '@/layouts/LayoutAuth.vue'
import Campo from '@/components/ui/Campo.vue'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { useOrganizacion } from '@/stores/organizacion'

const route = useRoute()
const router = useRouter()
const nombre = ref('')
const email = ref('')
const clave = ref('')
const acepta = ref(false)
const error = ref('')
const ocupado = ref(false)
const pendienteConfirmacion = ref(false)

const errores = computed(() => ({
  nombre: nombre.value && nombre.value.trim().length < 2 ? 'Ingresá tu nombre.' : '',
  email: email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim()) ? 'El email no es válido.' : '',
  clave: clave.value && clave.value.length < 8 ? 'Mínimo 8 caracteres.' : '',
}))
const valido = computed(() => nombre.value.trim().length >= 2 && !errores.value.email && email.value && clave.value.length >= 8 && acepta.value)

async function registrar() {
  if (!valido.value) return
  error.value = ''
  ocupado.value = true
  const volver = typeof route.query.volver === 'string' ? route.query.volver : '/'
  const { data, error: e } = await supabase.auth.signUp({
    email: email.value.trim(),
    password: clave.value,
    options: { data: { nombre: nombre.value.trim() }, emailRedirectTo: `${location.origin}${volver}` },
  })
  ocupado.value = false
  if (e) {
    error.value = traducirError(e)
    return
  }
  if (!data.session) {
    pendienteConfirmacion.value = true
    return
  }
  useOrganizacion().reiniciar()
  await router.replace(volver)
}
</script>

<template>
  <LayoutAuth titulo="Creá tu cuenta" subtitulo="Gestioná tu salón de eventos en un solo lugar.">
    <div v-if="pendienteConfirmacion" class="space-y-3 text-sm text-slate-600" role="status">
      <p>Te enviamos un email a <strong>{{ email }}</strong> para confirmar tu cuenta.</p>
      <p>Abrí el enlace del mensaje para continuar. Si no lo ves, revisá la carpeta de spam.</p>
    </div>
    <form v-else class="space-y-4" novalidate @submit.prevent="registrar">
      <Campo etiqueta="Tu nombre" para="nombre" :error="errores.nombre" requerido>
        <input id="nombre" v-model="nombre" autocomplete="name" class="entrada" />
      </Campo>
      <Campo etiqueta="Email" para="email" :error="errores.email" requerido>
        <input id="email" v-model="email" type="email" autocomplete="email" class="entrada" />
      </Campo>
      <Campo etiqueta="Contraseña" para="clave" :error="errores.clave" ayuda="Mínimo 8 caracteres." requerido>
        <input id="clave" v-model="clave" type="password" autocomplete="new-password" class="entrada" />
      </Campo>
      <label class="flex items-start gap-2 text-sm text-slate-600">
        <input v-model="acepta" type="checkbox" class="mt-0.5 rounded border-slate-300 text-marca-600" />
        <span>Acepto los términos del servicio y la política de privacidad.</span>
      </label>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
      <button type="submit" class="btn-primario w-full" :disabled="ocupado || !valido">
        {{ ocupado ? 'Creando cuenta…' : 'Crear cuenta' }}
      </button>
    </form>
    <template #pie>
      ¿Ya tenés cuenta? <RouterLink :to="{ path: '/ingresar', query: route.query }" class="enlace">Ingresá</RouterLink>
    </template>
  </LayoutAuth>
</template>
