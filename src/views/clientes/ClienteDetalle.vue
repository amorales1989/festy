<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, FileText, Mail, MessagesSquare, Pencil, Phone, Plus, Trash2 } from 'lucide-vue-next'
import FormCliente from '@/components/clientes/FormCliente.vue'
import InsigniaEstado from '@/components/ui/InsigniaEstado.vue'
import Cargando from '@/components/ui/Cargando.vue'
import type { Fila } from '@/lib/supabase'
import { api, eliminar as eliminarRegistro } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtMoneda, fmtRango } from '@/lib/formato'
import { ESTADOS_PRESUPUESTO, ORIGENES_CLIENTE } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

const route = useRoute()
const router = useRouter()
const org = useOrganizacion()
const acciones = useAcciones()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()
const cliente = ref<Fila<'clientes'> | null>(null)
const reservas = ref<Fila<'reservas'>[]>([])
const presupuestos = ref<Array<Pick<Fila<'presupuestos'>, 'id' | 'numero' | 'titulo' | 'estado' | 'total' | 'creado_at'>>>([])
const cargando = ref(true)
const error = ref('')
const editar = ref(false)
const id = computed(() => String(route.params.id))

async function cargar() {
  try {
    // Cliente con sus eventos y presupuestos (lo que el rol no puede ver llega vacío).
    const { reservas: res, presupuestos: pre, ...datos } = await api.get<Fila<'clientes'> & {
      reservas: Fila<'reservas'>[]; presupuestos: typeof presupuestos.value
    }>(`/clientes/${id.value}`)
    cliente.value = datos
    presupuestos.value = org.puede('presupuestos.ver') ? pre : []
    reservas.value = org.puede('reservas.ver') ? res : []
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

async function eliminar() {
  const ok = await confirmar({ titulo: 'Eliminar cliente', peligro: true, confirmar: 'Eliminar',
    mensaje: reservas.value.length ? 'Este cliente tiene reservas: no se puede eliminar.' : 'Se elimina el cliente definitivamente.' })
  if (!ok) return
  try {
    await eliminarRegistro('clientes', id.value)
    exito('Cliente eliminado.')
    await router.replace({ name: 'clientes' })
  } catch (e) {
    notificarError(e)
  }
}
const totalContratado = computed(() => reservas.value.filter((r) => r.estado !== 'cancelada' && r.estado !== 'consulta').reduce((s, r) => s + Number(r.precio_total), 0))
</script>

<template>
  <div class="space-y-4">
    <button class="btn-fantasma -ml-2" @click="router.back()"><ArrowLeft class="size-4" /> Volver</button>
    <Cargando v-if="cargando" />
    <p v-else-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <template v-else-if="cliente">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="titulo-pagina">{{ cliente.nombre }}</h1>
          <p class="subtitulo">{{ cliente.tipo === 'empresa' ? 'Empresa' : 'Persona' }}<template v-if="cliente.documento"> · {{ cliente.tipo === 'empresa' ? 'CUIT' : 'DNI' }} {{ cliente.documento }}</template>
            · Cliente desde {{ fmtFecha(cliente.creado_at, org.zona) }}</p>
        </div>
        <div class="flex gap-2">
          <button v-if="org.puede('presupuestos.gestionar')" class="btn-primario" @click="router.push({ name: 'presupuesto-nuevo', query: { cliente: cliente.id } })"><FileText class="size-4" /> Hacer presupuesto</button>
          <button v-if="org.puede('reservas.crear')" class="btn-secundario" @click="acciones.nuevaReserva({ clienteId: cliente.id })"><Plus class="size-4" /> Reservar</button>
          <button v-if="org.puede('entrevistas.gestionar')" class="btn-secundario" @click="acciones.nuevaEntrevista({ clienteId: cliente.id })"><MessagesSquare class="size-4" /> Entrevista</button>
          <button v-if="org.puede('clientes.gestionar')" class="btn-secundario" @click="editar = true"><Pencil class="size-4" /> Editar</button>
          <button v-if="org.puede('clientes.gestionar')" class="btn-fantasma text-rose-600" aria-label="Eliminar cliente" @click="eliminar"><Trash2 class="size-4" /></button>
        </div>
      </div>
      <div class="grid gap-4 lg:grid-cols-3">
        <section class="tarjeta space-y-3 p-4 text-sm">
          <p v-if="cliente.telefono" class="flex items-center gap-2"><Phone class="size-4 text-slate-400" />
            <a :href="`https://wa.me/${cliente.telefono.replace(/\D/g, '')}`" target="_blank" rel="noopener" class="enlace">{{ cliente.telefono }}</a></p>
          <p v-if="cliente.email" class="flex items-center gap-2"><Mail class="size-4 text-slate-400" /><a :href="`mailto:${cliente.email}`" class="enlace">{{ cliente.email }}</a></p>
          <p v-if="cliente.direccion"><span class="text-xs text-slate-500">Dirección</span><br />{{ cliente.direccion }}</p>
          <p v-if="cliente.origen"><span class="text-xs text-slate-500">Origen</span><br />{{ ORIGENES_CLIENTE[cliente.origen] }}</p>
          <p v-if="cliente.notas" class="whitespace-pre-line"><span class="text-xs text-slate-500">Notas</span><br />{{ cliente.notas }}</p>
          <p v-if="org.puede('pagos.ver')"><span class="text-xs text-slate-500">Total contratado</span><br /><span class="font-semibold">{{ fmtMoneda(totalContratado) }}</span></p>
        </section>
        <section v-if="presupuestos.length" class="tarjeta lg:col-span-3">
          <h2 class="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Presupuestos ({{ presupuestos.length }})</h2>
          <ul class="divide-y divide-slate-100">
            <li v-for="p in presupuestos" :key="p.id">
              <RouterLink :to="{ name: 'presupuesto', params: { id: p.id } }" class="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                <span class="text-sm"><span class="font-medium">N° {{ String(p.numero).padStart(4, '0') }}</span> {{ p.titulo }}
                  <span class="block text-xs text-slate-500">{{ fmtFecha(p.creado_at, org.zona) }} · {{ fmtMoneda(p.total) }}</span></span>
                <span :class="['rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ESTADOS_PRESUPUESTO[p.estado]?.clase]">{{ ESTADOS_PRESUPUESTO[p.estado]?.etiqueta }}</span>
              </RouterLink>
            </li>
          </ul>
        </section>
        <section v-if="org.puede('reservas.ver')" class="tarjeta lg:col-span-2">
          <h2 class="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Reservas ({{ reservas.length }})</h2>
          <ul class="divide-y divide-slate-100">
            <li v-for="r in reservas" :key="r.id">
              <RouterLink :to="{ name: 'reserva', params: { id: r.id } }" class="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                <span><span class="block text-sm font-medium">#{{ r.numero }} {{ r.titulo }}</span>
                  <span class="text-xs text-slate-500 first-letter:uppercase">{{ fmtRango(r.inicio, r.fin, org.zona) }}</span></span>
                <InsigniaEstado :estado="r.estado" />
              </RouterLink>
            </li>
            <li v-if="!reservas.length" class="px-4 py-8 text-center text-sm text-slate-500">Sin reservas.</li>
          </ul>
        </section>
      </div>
      <FormCliente v-model="editar" :cliente="cliente" @guardado="cargar" />
    </template>
  </div>
</template>
