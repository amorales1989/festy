<script setup lang="ts">
// Fecha en formato DD/MM/AAAA, independiente del idioma del navegador.
// El modelo es 'yyyy-MM-dd' (o '' si está vacío).
import { ref, watch } from 'vue'
import { CalendarDays } from 'lucide-vue-next'
import { parsearFechaAR } from '@/lib/formato'

const props = defineProps<{ id?: string; requerido?: boolean; deshabilitado?: boolean; min?: string }>()
const modelo = defineModel<string>({ default: '' })
const emit = defineEmits<{ invalida: [boolean] }>()
const texto = ref('')
const invalida = ref(false)
const nativo = ref<HTMLInputElement | null>(null)

function aTexto(iso: string) {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
watch(modelo, (v) => { if (parsearFechaAR(texto.value) !== v) texto.value = aTexto(v) }, { immediate: true })

function alEscribir(e: Event) {
  let v = (e.target as HTMLInputElement).value.replace(/[^\d/]/g, '')
  if (/^\d{2}$/.test(v) || /^\d{2}\/\d{2}$/.test(v)) v += '/'
  texto.value = v.slice(0, 10)
  const iso = parsearFechaAR(texto.value)
  invalida.value = texto.value.length > 0 && !iso
  emit('invalida', invalida.value)
  if (iso) modelo.value = iso
  else if (!texto.value) modelo.value = ''
}
function alSalir() {
  invalida.value = texto.value.length > 0 && !parsearFechaAR(texto.value)
  emit('invalida', invalida.value)
}
function abrirSelector() {
  try { nativo.value?.showPicker() } catch { nativo.value?.focus() }
}
function alElegir(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (v) { modelo.value = v; texto.value = aTexto(v); invalida.value = false; emit('invalida', false) }
}
void props
</script>

<template>
  <div class="relative">
    <input :id="id" :value="texto" type="text" inputmode="numeric" placeholder="DD/MM/AAAA" autocomplete="off"
           :required="requerido" :disabled="deshabilitado" :class="['entrada pr-10', invalida && 'entrada-error']"
           :aria-invalid="invalida" @input="alEscribir" @blur="alSalir" />
    <button type="button" class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-marca-600"
            :disabled="deshabilitado" aria-label="Elegir fecha en el calendario" tabindex="-1" @click="abrirSelector">
      <CalendarDays class="size-4" />
    </button>
    <input ref="nativo" type="date" class="pointer-events-none absolute bottom-0 right-0 size-0 opacity-0" tabindex="-1"
           aria-hidden="true" :value="modelo" :min="min" @change="alElegir" />
    <p v-if="invalida" class="mt-1 text-xs text-rose-600">Fecha inválida. Usá el formato DD/MM/AAAA.</p>
  </div>
</template>
