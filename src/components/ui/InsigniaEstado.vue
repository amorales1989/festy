<script setup lang="ts">
import { ESTADOS_RESERVA } from '@/lib/catalogos'
import type { EstadoReserva } from '@/lib/supabase'
defineProps<{ estado: EstadoReserva }>()
</script>

<template>
  <span :class="['inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ESTADOS_RESERVA[estado].clase]"
        :title="ESTADOS_RESERVA[estado].ayuda">
    <span :class="['size-1.5 rounded-full', ESTADOS_RESERVA[estado].punto]" />
    {{ ESTADOS_RESERVA[estado].etiqueta }}
  </span>
</template>
