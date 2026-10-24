<script setup lang="ts">
// Elige la cuenta donde entra o sale el dinero. Vacío = la asociada al medio de pago.
import { computed, onMounted } from 'vue'
import { useCuentas } from '@/composables/useCuentas'

const props = defineProps<{ medio: string; id?: string }>()
const modelo = defineModel<string>({ default: '' })
const { activas, cargar, cuentaDeMedio } = useCuentas()
onMounted(() => { void cargar() })
const automatica = computed(() => cuentaDeMedio(props.medio)?.nombre ?? 'sin cuenta')
</script>

<template>
  <select :id="id" v-model="modelo" class="entrada">
    <option value="">Según el medio ({{ automatica }})</option>
    <option v-for="c in activas" :key="c.id" :value="c.id">{{ c.nombre }}</option>
  </select>
</template>
