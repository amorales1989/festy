<script setup lang="ts">
// Proveedores: a quién se le terceriza (catering, DJ, decoración…), cuánto se comprometió y cuánto falta pagar.
import { computed, onMounted, reactive, ref } from 'vue'
import { MessageCircle, Pencil, Plus, Trash2, Truck } from 'lucide-vue-next'
import PestanasPlata from '@/components/finanzas/PestanasPlata.vue'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import Cargando from '@/components/ui/Cargando.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import type { Fila } from '@/lib/supabase'
import { activar, api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtMoneda } from '@/lib/formato'
import { telefonoWhatsApp } from '@/lib/compartir'
import { useOrganizacion } from '@/stores/organizacion'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

type Proveedor = Fila<'proveedores'> & { comprometido: number; pagado: number }

const org = useOrganizacion()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()
const proveedores = ref<Proveedor[]>([])
const cargando = ref(true)
const error = ref('')
const verInactivos = ref(false)

async function cargar() {
  cargando.value = true
  try {
    proveedores.value = await api.get<Proveedor[]>(rutaOrg(org.id, 'proveedores'))
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)
const visibles = computed(() => proveedores.value.filter((p) => verInactivos.value || p.activo))
const totalPendiente = computed(() => proveedores.value.reduce((s, p) => s + Math.max(0, Number(p.comprometido) - Number(p.pagado)), 0))

const abierto = ref(false)
const sel = ref<Proveedor | null>(null)
const f = reactive({ nombre: '', rubro: '', telefono: '', email: '', notas: '' })
const errorForm = ref('')
function abrir(p: Proveedor | null = null) {
  sel.value = p
  Object.assign(f, { nombre: p?.nombre ?? '', rubro: p?.rubro ?? '', telefono: p?.telefono ?? '', email: p?.email ?? '', notas: p?.notas ?? '' })
  errorForm.value = ''
  abierto.value = true
}
async function guardar() {
  if (f.nombre.trim().length < 2) { errorForm.value = 'Ingresá el nombre.'; return }
  try {
    if (sel.value) await api.put(rutaOrg(org.id, `proveedores/${sel.value.id}`), f)
    else await api.post(rutaOrg(org.id, 'proveedores'), f)
    exito('Proveedor guardado.')
    abierto.value = false
    void cargar()
  } catch (e) { errorForm.value = traducirError(e) }
}
async function alternar(p: Proveedor) {
  try { await activar('proveedores', p.id, !p.activo); void cargar() } catch (e) { notificarError(e) }
}
async function borrar(p: Proveedor) {
  if (!(await confirmar({ titulo: 'Eliminar proveedor', mensaje: `¿Eliminar a “${p.nombre}”? Los costos y pagos cargados se mantienen, sin proveedor.`, confirmar: 'Eliminar', peligro: true }))) return
  try { await eliminarRegistro('proveedores', p.id); void cargar() } catch (e) { notificarError(e) }
}
</script>

<template>
  <div class="space-y-4">
    <PestanasPlata />
    <div class="flex flex-wrap items-center gap-3">
      <p class="text-sm text-slate-600">Cargá los costos de cada evento desde su ficha, en «Costos y proveedores».</p>
      <label class="ml-auto flex items-center gap-1.5 text-sm text-slate-600"><input v-model="verInactivos" type="checkbox" /> Ver inactivos</label>
      <button v-if="org.puede('gastos.gestionar')" class="btn-primario" @click="abrir()"><Plus class="size-4" /> Nuevo proveedor</button>
    </div>
    <p v-if="totalPendiente > 0" class="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">Falta pagar a proveedores: <strong class="tabular-nums">{{ fmtMoneda(totalPendiente) }}</strong></p>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <div class="tarjeta overflow-x-auto">
      <Cargando v-if="cargando && !proveedores.length" />
      <EstadoVacio v-else-if="!visibles.length" :icono="Truck" titulo="Todavía no cargaste proveedores" descripcion="Catering, DJ, decoración, fotografía: cargalos para saber cuánto les debés." />
      <table v-else class="tabla">
        <thead class="bg-slate-50"><tr><th>Proveedor</th><th class="text-right">Comprometido</th><th class="hidden text-right sm:table-cell">Pagado</th><th class="text-right">Falta pagar</th><th /></tr></thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="p in visibles" :key="p.id" :class="!p.activo && 'text-slate-400'">
            <td><span class="font-medium">{{ p.nombre }}</span><span class="block text-xs text-slate-500">{{ [p.rubro, p.telefono].filter(Boolean).join(' · ') }}{{ p.activo ? '' : ' · inactivo' }}</span></td>
            <td class="text-right tabular-nums">{{ fmtMoneda(p.comprometido) }}</td>
            <td class="hidden text-right tabular-nums sm:table-cell">{{ fmtMoneda(p.pagado) }}</td>
            <td :class="['text-right tabular-nums', Number(p.comprometido) - Number(p.pagado) > 0 && 'font-semibold text-amber-800']">{{ fmtMoneda(Math.max(0, Number(p.comprometido) - Number(p.pagado))) }}</td>
            <td class="whitespace-nowrap text-right">
              <a v-if="telefonoWhatsApp(p.telefono)" :href="`https://wa.me/${telefonoWhatsApp(p.telefono)}`" target="_blank" rel="noopener" class="btn-fantasma inline-flex p-1.5" :aria-label="`WhatsApp a ${p.nombre}`"><MessageCircle class="size-4" /></a>
              <template v-if="org.puede('gastos.gestionar')">
                <button class="btn-fantasma p-1.5" aria-label="Editar" @click="abrir(p)"><Pencil class="size-4" /></button>
                <button class="btn-fantasma btn-chico" @click="alternar(p)">{{ p.activo ? 'Desactivar' : 'Activar' }}</button>
                <button class="btn-fantasma p-1.5 text-rose-600" aria-label="Eliminar" @click="borrar(p)"><Trash2 class="size-4" /></button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Modal v-model="abierto" :titulo="sel ? 'Editar proveedor' : 'Nuevo proveedor'">
      <form id="form-prov" class="grid gap-3 sm:grid-cols-2" @submit.prevent="guardar">
        <Campo etiqueta="Nombre" para="p-nombre" requerido><input id="p-nombre" v-model="f.nombre" class="entrada" /></Campo>
        <Campo etiqueta="Rubro" para="p-rubro"><input id="p-rubro" v-model="f.rubro" class="entrada" placeholder="Catering, música, decoración…" /></Campo>
        <Campo etiqueta="Teléfono" para="p-tel"><input id="p-tel" v-model="f.telefono" class="entrada" inputmode="tel" /></Campo>
        <Campo etiqueta="Email" para="p-email"><input id="p-email" v-model="f.email" type="email" class="entrada" /></Campo>
        <Campo etiqueta="Notas" para="p-notas" class="sm:col-span-2"><textarea id="p-notas" v-model="f.notas" rows="2" class="entrada" /></Campo>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ errorForm }}</p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="abierto = false">Cancelar</button>
        <button type="submit" form="form-prov" class="btn-primario">Guardar</button>
      </template>
    </Modal>
  </div>
</template>
