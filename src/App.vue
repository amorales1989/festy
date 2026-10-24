<script setup lang="ts">
import Notificaciones from '@/components/ui/Notificaciones.vue'
import DialogoConfirmacion from '@/components/ui/DialogoConfirmacion.vue'
</script>

<template>
  <RouterView />
  <Notificaciones />
  <DialogoConfirmacion />
</template>
