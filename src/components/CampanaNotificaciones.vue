<script setup lang="ts">
// Campana de notificaciones (web y app). Se actualiza cada minuto y al volver a la pestaña.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, CalendarCheck, FileText, ListChecks, MessagesSquare, Wallet } from 'lucide-vue-next'
import type { Fila } from '@/lib/supabase'
import { api } from '@/lib/api'
import { tiempoRelativo } from '@/lib/formato'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'

type Notificacion = Fila<'notificaciones'>
const org = useOrganizacion()
const acciones = useAcciones()
const router = useRouter()
const abierta = ref(false)
const lista = ref<Notificacion[]>([])
const sinLeer = ref(0)
const ICONOS: Record<string, typeof Bell> = { pago: Wallet, cuota: Wallet, reserva: CalendarCheck, tentativa: CalendarCheck, entrevista: MessagesSquare, presupuesto: FileText, tarea: ListChecks }
let intervalo: ReturnType<typeof setInterval> | undefined

async function cargar() {
  lista.value = await api.get<Notificacion[]>('/notificaciones').catch(() => lista.value)
  sinLeer.value = lista.value.filter((n) => !n.leida_at).length
}
function alVolver() { if (document.visibilityState === 'visible') void cargar() }
onMounted(() => {
  void cargar()
  intervalo = setInterval(cargar, 60_000)
  document.addEventListener('visibilitychange', alVolver)
})
onBeforeUnmount(() => { clearInterval(intervalo); document.removeEventListener('visibilitychange', alVolver) })

async function abrir(n: Notificacion) {
  abierta.value = false
  if (!n.leida_at) {
    await api.post('/notificaciones/leer', { id: n.id }).catch(() => {})
    void cargar()
  }
  if (n.organizacion_id !== org.id) await org.seleccionar(n.organizacion_id)
  if (n.url) await router.push(n.url)
  acciones.cambiosGuardados()
}
async function marcarTodas() {
  await api.post('/notificaciones/leer').catch(() => {})
  void cargar()
}
defineExpose({ cargar })
</script>

<template>
  <div class="relative">
    <button type="button" class="btn-fantasma relative p-2" :aria-label="sinLeer ? `Notificaciones: ${sinLeer} sin leer` : 'Notificaciones'"
            :aria-expanded="abierta" @click="abierta = !abierta; abierta && cargar()">
      <Bell class="size-5" />
      <span v-if="sinLeer" class="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{{ sinLeer > 9 ? '9+' : sinLeer }}</span>
    </button>
    <div v-if="abierta" class="fixed inset-0 z-40" @click="abierta = false" />
    <div v-if="abierta" class="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200" role="dialog" aria-label="Notificaciones">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <p class="text-sm font-semibold">Notificaciones</p>
        <button v-if="sinLeer" class="enlace text-xs" @click="marcarTodas">Marcar todas como leídas</button>
      </div>
      <ul class="max-h-96 divide-y divide-slate-100 overflow-y-auto">
        <li v-for="n in lista" :key="n.id">
          <button type="button" :class="['flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', !n.leida_at && 'bg-marca-50/50']" @click="abrir(n)">
            <component :is="ICONOS[n.tipo] ?? Bell" :class="['mt-0.5 size-4 shrink-0', n.leida_at ? 'text-slate-400' : 'text-marca-600']" />
            <span class="min-w-0 flex-1">
              <span :class="['block text-sm', !n.leida_at && 'font-semibold']">{{ n.titulo }}</span>
              <span v-if="n.cuerpo" class="block truncate text-xs text-slate-500">{{ n.cuerpo }}</span>
              <span class="block text-[11px] text-slate-400">{{ tiempoRelativo(n.creado_at, org.zona) }}</span>
            </span>
            <span v-if="!n.leida_at" class="mt-1.5 size-2 shrink-0 rounded-full bg-marca-500" />
          </button>
        </li>
        <li v-if="!lista.length" class="px-4 py-8 text-center text-sm text-slate-500">No tenés notificaciones.</li>
      </ul>
    </div>
  </div>
</template>
