<script setup lang="ts">
// Pedidos de fecha que llegaron por la página web y todavía nadie atendió:
// con el teléfono a mano para llamar o escribir por WhatsApp.
import { computed, onMounted, ref, watch } from 'vue'
import { Check, ExternalLink, Globe, MessageCircle, Phone } from 'lucide-vue-next'
import { api, rutaOrg } from '@/lib/api'
import { aLocal, fmtDiaLargo, tiempoRelativo } from '@/lib/formato'
import { TIPOS_EVENTO } from '@/lib/catalogos'
import { telefonoWhatsApp } from '@/lib/compartir'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'
import { useNotificaciones } from '@/composables/useNotificaciones'

interface Pedido {
  id: string; numero: number; inicio: string; fin: string; invitados: number | null; tipo_evento: string
  nombre: string; telefono: string | null; email: string | null; mensaje: string | null; recibido_at: string; espacio: string | null
}

const org = useOrganizacion()
const acciones = useAcciones()
const { exito, error: notificarError } = useNotificaciones()
const pedidos = ref<Pedido[]>([])

async function cargar() {
  pedidos.value = await api.get<Pedido[]>(rutaOrg(org.id, 'pedidos-web')).catch(() => [])
}
onMounted(cargar)
watch(() => acciones.version, cargar)

const fecha = (p: Pedido) => fmtDiaLargo(aLocal(p.inicio, org.zona).fecha)
const horario = (p: Pedido) => `${aLocal(p.inicio, org.zona).hora} a ${aLocal(p.fin, org.zona).hora}`
const wa = (p: Pedido) => telefonoWhatsApp(p.telefono)
const llamar = (p: Pedido) => {
  const w = wa(p)
  return w ? `tel:+${w}` : `tel:${(p.telefono ?? '').replace(/[^\d+]/g, '')}`
}
const enlaceWhatsApp = (p: Pedido) => {
  const texto = `Hola ${p.nombre.split(' ')[0]}! Te escribo de ${org.actual?.nombre ?? ''} por tu pedido para el ${fecha(p)}`
    + `${p.espacio ? ` en ${p.espacio}` : ''}. ¿Te puedo contar disponibilidad y precios?`
  return `https://wa.me/${wa(p)}?text=${encodeURIComponent(texto)}`
}
const puedeMarcar = computed(() => org.puede('reservas.editar'))

async function atendido(p: Pedido) {
  try {
    await api.post(`/reservas/${p.id}/pedido-web/atendido`)
    pedidos.value = pedidos.value.filter((x) => x.id !== p.id)
    exito('Listo. La consulta sigue en Eventos.')
  } catch (e) { notificarError(e) }
}
</script>

<template>
  <section v-if="pedidos.length" class="rounded-xl bg-sky-50 p-4 ring-1 ring-sky-200" aria-labelledby="titulo-pedidos-web">
    <h2 id="titulo-pedidos-web" class="flex items-center gap-2 font-semibold text-sky-950">
      <Globe class="size-5 text-sky-700" />
      {{ pedidos.length === 1 ? 'Nuevo pedido desde tu página' : `${pedidos.length} pedidos nuevos desde tu página` }}
    </h2>
    <p class="mt-0.5 text-sm text-sky-900">Contactalos para confirmar disponibilidad. El pedido no bloquea la fecha hasta que lo pases a retenida o señada.</p>
    <ul class="mt-3 grid gap-3 xl:grid-cols-2">
      <li v-for="p in pedidos" :key="p.id" class="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-sky-100">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-lg font-semibold text-slate-900">{{ p.nombre }}</p>
            <p class="text-sm text-slate-700">
              <strong>{{ fecha(p) }}</strong> · {{ horario(p) }}<template v-if="p.espacio"> · {{ p.espacio }}</template>
            </p>
            <p class="text-sm text-slate-500">{{ TIPOS_EVENTO[p.tipo_evento] ?? 'Evento' }}<template v-if="p.invitados"> · {{ p.invitados }} invitados</template>
              · llegó {{ tiempoRelativo(p.recibido_at, org.zona) }}</p>
          </div>
          <a v-if="p.telefono" :href="llamar(p)" class="text-xl font-semibold tabular-nums text-slate-900 hover:underline" :aria-label="`Llamar a ${p.nombre}`">{{ p.telefono }}</a>
        </div>
        <p v-if="p.mensaje" class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 italic">“{{ p.mensaje }}”</p>
        <p v-if="p.email" class="text-sm text-slate-500">{{ p.email }}</p>
        <div class="flex flex-wrap gap-2">
          <a v-if="wa(p)" :href="enlaceWhatsApp(p)" target="_blank" rel="noopener"
             class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <MessageCircle class="size-4" /> WhatsApp</a>
          <a v-if="p.telefono" :href="llamar(p)" class="btn-secundario"><Phone class="size-4" /> Llamar</a>
          <RouterLink :to="{ name: 'reserva', params: { id: p.id } }" class="btn-secundario"><ExternalLink class="size-4" /> Ver consulta #{{ p.numero }}</RouterLink>
          <button v-if="puedeMarcar" class="btn-fantasma ml-auto" @click="atendido(p)"><Check class="size-4" /> Ya lo contacté</button>
        </div>
      </li>
    </ul>
  </section>
</template>
