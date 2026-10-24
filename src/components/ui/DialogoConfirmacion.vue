<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TriangleAlert } from 'lucide-vue-next'
import Modal from './Modal.vue'
import { useConfirmar } from '@/composables/useConfirmar'

const { pendiente, responder } = useConfirmar()
const texto = ref('')
const abierto = computed({
  get: () => !!pendiente.value,
  set: (v) => { if (!v) responder(null) },
})
watch(pendiente, () => { texto.value = '' })
const habilitado = computed(() => {
  const p = pendiente.value
  if (p?.textoRequerido) return texto.value.trim() === p.textoRequerido
  if (p?.etiquetaTexto) return texto.value.trim().length > 0
  return true
})
function aceptar() {
  if (habilitado.value) responder(pendiente.value?.etiquetaTexto ? texto.value.trim() : '')
}
</script>

<template>
  <Modal v-model="abierto" :titulo="pendiente?.titulo ?? ''" ancho="sm">
    <div class="flex gap-3">
      <div v-if="pendiente?.peligro" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
        <TriangleAlert class="size-5 text-rose-600" />
      </div>
      <div class="space-y-3 text-sm text-slate-600">
        <p class="whitespace-pre-line">{{ pendiente?.mensaje }}</p>
        <div v-if="pendiente?.textoRequerido">
          <label class="mb-1 block text-xs font-medium text-slate-700">
            Escribí <strong>{{ pendiente.textoRequerido }}</strong> para confirmar
          </label>
          <input v-model="texto" class="entrada" autocomplete="off" @keydown.enter="aceptar" />
        </div>
        <div v-else-if="pendiente?.etiquetaTexto">
          <label for="dialogo-texto" class="mb-1 block text-xs font-medium text-slate-700">{{ pendiente.etiquetaTexto }}</label>
          <input id="dialogo-texto" v-model="texto" class="entrada" autocomplete="off" @keydown.enter="aceptar" />
        </div>
      </div>
    </div>
    <template #pie>
      <button type="button" class="btn-secundario" @click="responder(null)">Volver</button>
      <button type="button" :class="pendiente?.peligro ? 'btn-peligro' : 'btn-primario'" :disabled="!habilitado" @click="aceptar">
        {{ pendiente?.confirmar ?? 'Confirmar' }}
      </button>
    </template>
  </Modal>
</template>
