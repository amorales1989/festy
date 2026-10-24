<script setup lang="ts">
// Hora en formato 24 h (HH:MM), independiente del idioma del sistema: el
// <input type="time"> nativo muestra "p.m." en muchos equipos configurados en es-AR.
import { ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })
defineProps<{ id?: string; deshabilitado?: boolean }>()
const modelo = defineModel<string>({ default: '' })
const texto = ref('')
const invalida = ref(false)
const OPCIONES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const lista = `horas-${Math.random().toString(36).slice(2, 8)}`

function normalizar(v: string): string | null {
  const m = /^(\d{1,2}):?(\d{2})$/.exec(v.trim())
  if (!m) return null
  const h = Number(m[1]), mi = Number(m[2])
  return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : null
}
watch(modelo, (v) => { if (normalizar(texto.value) !== v) texto.value = v ?? '' }, { immediate: true })

function alEscribir(e: Event) {
  let v = (e.target as HTMLInputElement).value.replace(/[^\d:]/g, '')
  if (/^\d{2}$/.test(v) && texto.value.length < v.length) v += ':'
  texto.value = v.slice(0, 5)
  const n = normalizar(texto.value)
  invalida.value = !!texto.value && !n && texto.value.length >= 4
  if (n) modelo.value = n
}
function alSalir() {
  const n = normalizar(texto.value)
  invalida.value = !!texto.value && !n
  if (n) texto.value = n
}
</script>

<template>
  <div>
    <input :id="id" :value="texto" type="text" inputmode="numeric" placeholder="HH:MM" autocomplete="off" :list="lista"
           :disabled="deshabilitado" :class="['entrada tabular-nums', invalida && 'entrada-error']" :aria-invalid="invalida"
           v-bind="$attrs" @input="alEscribir" @blur="alSalir" />
    <datalist :id="lista"><option v-for="o in OPCIONES" :key="o" :value="o" /></datalist>
    <p v-if="invalida" class="mt-1 text-xs text-rose-600">Hora inválida (24 h, ej.: 21:30).</p>
  </div>
</template>
