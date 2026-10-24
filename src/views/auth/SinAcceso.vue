<script setup lang="ts">
// Usuario sin empresa usable: suspendida por falta de pago, o sin empresa asignada.
import { useRouter } from 'vue-router'
import { LogOut, RefreshCw } from 'lucide-vue-next'
import LayoutAuth from '@/layouts/LayoutAuth.vue'
import { fmtFecha, ZONA_POR_DEFECTO } from '@/lib/formato'
import { useOrganizacion } from '@/stores/organizacion'
import { useSesion } from '@/stores/sesion'

const org = useOrganizacion()
const sesion = useSesion()
const router = useRouter()

async function reintentar() {
  org.reiniciar()
  await org.cargarOrganizaciones()
  if (org.actual) await router.replace('/')
}
async function salir() {
  await sesion.salir()
  org.reiniciar()
  await router.replace('/ingresar')
}
</script>

<template>
  <LayoutAuth :titulo="org.suspendidas.length ? 'Cuenta suspendida' : 'Sin empresa asignada'">
    <div class="space-y-4 text-sm text-slate-600">
      <template v-if="org.suspendidas.length">
        <div v-for="e in org.suspendidas" :key="e.id" class="rounded-lg bg-rose-50 px-4 py-3 text-rose-900" role="alert">
          <p>La cuenta de <strong>{{ e.nombre }}</strong> está suspendida desde el {{ fmtFecha(e.suspendida_at, ZONA_POR_DEFECTO) }}.</p>
          <p v-if="e.motivo" class="mt-1">Motivo: {{ e.motivo }}</p>
        </div>
        <p>Tus datos están guardados y no se pierden. Comunicate con Festy para regularizar la cuenta; apenas se reactive vas a poder entrar de nuevo.</p>
      </template>
      <p v-else>Tu usuario ({{ sesion.usuario?.email }}) no tiene ninguna empresa asignada. Si trabajás en un salón, pedile a quien lo administra que te invite. Si querés usar Festy en tu salón, comunicate con nosotros.</p>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secundario" @click="reintentar"><RefreshCw class="size-4" /> Volver a intentar</button>
        <button class="btn-fantasma" @click="salir"><LogOut class="size-4" /> Salir</button>
      </div>
    </div>
  </LayoutAuth>
</template>
