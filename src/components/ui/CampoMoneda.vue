<script setup lang="ts">
import { ref, watch } from 'vue'
import { parsearMonto } from '@/lib/formato'

defineProps<{ id?: string; requerido?: boolean; placeholder?: string }>()
const modelo = defineModel<number | null>({ default: null })
const texto = ref('')
const formato = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

watch(modelo, (v) => { if (parsearMonto(texto.value) !== v) texto.value = v === null ? '' : formato.format(v) }, { immediate: true })
function alEscribir(e: Event) {
  texto.value = (e.target as HTMLInputElement).value
  modelo.value = parsearMonto(texto.value)
}
function alSalir() {
  if (modelo.value !== null) texto.value = formato.format(modelo.value)
}
</script>

<template>
  <div class="relative">
    <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-400">$</span>
    <input :id="id" :value="texto" type="text" inputmode="decimal" :placeholder="placeholder ?? '0'" :required="requerido"
           class="entrada pl-7 tabular-nums" autocomplete="off" @input="alEscribir" @blur="alSalir" />
  </div>
</template>
