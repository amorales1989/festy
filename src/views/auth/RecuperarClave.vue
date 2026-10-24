<script setup lang="ts">
import { ref } from 'vue'
import LayoutAuth from '@/layouts/LayoutAuth.vue'
import Campo from '@/components/ui/Campo.vue'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'

const email = ref('')
const enviado = ref(false)
const error = ref('')
const ocupado = ref(false)

async function enviar() {
  error.value = ''
  ocupado.value = true
  const { error: e } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
    redirectTo: `${location.origin}/nueva-clave`,
  })
  ocupado.value = false
  if (e) error.value = traducirError(e)
  else enviado.value = true
}
</script>

<template>
  <LayoutAuth titulo="Recuperá tu contraseña" subtitulo="Te enviamos un enlace para elegir una nueva.">
    <p v-if="enviado" class="text-sm text-slate-600" role="status">
      Si existe una cuenta con <strong>{{ email }}</strong>, vas a recibir un email con el enlace. Revisá también spam.
    </p>
    <form v-else class="space-y-4" @submit.prevent="enviar">
      <Campo etiqueta="Email" para="email">
        <input id="email" v-model="email" type="email" autocomplete="email" required class="entrada" />
      </Campo>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
      <button class="btn-primario w-full" :disabled="ocupado || !email">{{ ocupado ? 'Enviando…' : 'Enviar enlace' }}</button>
    </form>
    <template #pie><RouterLink to="/ingresar" class="enlace">Volver a ingresar</RouterLink></template>
  </LayoutAuth>
</template>
