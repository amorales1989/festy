<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Pencil, Plus, Receipt, Trash2 } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import PestanasPlata from '@/components/finanzas/PestanasPlata.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import Cargando from '@/components/ui/Cargando.vue'
import type { Fila } from '@/lib/supabase'
import { api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtMoneda, hoyISO, sumarDiasISO } from '@/lib/formato'
import { CATEGORIAS_GASTO, MEDIOS_PAGO } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

const org = useOrganizacion()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()
const filtro = reactive({ desde: sumarDiasISO(hoyISO(org.zona), -30), hasta: hoyISO(org.zona), categoria: '' })
const gastos = ref<Fila<'gastos'>[]>([])
const cargando = ref(true)
const error = ref('')

async function cargar() {
  cargando.value = true
  try {
    gastos.value = await api.get<Fila<'gastos'>[]>(rutaOrg(org.id, 'gastos'), { desde: filtro.desde, hasta: filtro.hasta, categoria: filtro.categoria || undefined })
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
watch(() => ({ ...filtro }), cargar)
onMounted(cargar)
const total = computed(() => gastos.value.reduce((s, g) => s + Number(g.monto), 0))

const abierto = ref(false)
const editando = ref<Fila<'gastos'> | null>(null)
const f = reactive({ fecha: '', categoria: 'otro', descripcion: '', proveedor: '', monto: null as number | null, medio: 'efectivo', sucursal_id: '' })
const errorForm = ref('')
function abrir(g: Fila<'gastos'> | null = null) {
  editando.value = g
  Object.assign(f, g ? { fecha: g.fecha, categoria: g.categoria, descripcion: g.descripcion, proveedor: g.proveedor ?? '', monto: Number(g.monto), medio: g.medio, sucursal_id: g.sucursal_id ?? '' }
    : { fecha: hoyISO(org.zona), categoria: 'otro', descripcion: '', proveedor: '', monto: null, medio: 'efectivo', sucursal_id: org.sucursalesActivas.length === 1 ? org.sucursalesActivas[0]!.id : '' })
  errorForm.value = ''
  abierto.value = true
}
async function guardar() {
  if (!f.fecha || f.descripcion.trim().length < 2 || !f.monto || f.monto <= 0) { errorForm.value = 'Completá fecha, descripción y un monto mayor a 0.'; return }
  const datos = { fecha: f.fecha, categoria: f.categoria, descripcion: f.descripcion.trim(), proveedor: f.proveedor.trim() || null, monto: f.monto, medio: f.medio, sucursal_id: f.sucursal_id || null }
  try {
    if (editando.value) await api.put(rutaOrg(org.id, `gastos/${editando.value.id}`), datos)
    else await api.post(rutaOrg(org.id, 'gastos'), datos)
    exito('Gasto guardado.')
    abierto.value = false
    void cargar()
  } catch (e) { errorForm.value = traducirError(e) }
}
async function borrar(g: Fila<'gastos'>) {
  if (!(await confirmar({ titulo: 'Eliminar gasto', mensaje: `¿Eliminar “${g.descripcion}” por ${fmtMoneda(g.monto)}?`, confirmar: 'Eliminar', peligro: true }))) return
  try {
    await eliminarRegistro('gastos', g.id)
    void cargar()
  } catch (e) { notificarError(e) }
}
</script>

<template>
  <div class="space-y-4">
    <PestanasPlata />
    <div class="flex flex-wrap items-center justify-end gap-3">
      <button v-if="org.puede('gastos.gestionar')" class="btn-primario" @click="abrir()"><Plus class="size-4" /> Nuevo gasto</button>
    </div>
    <div class="flex flex-wrap items-end gap-2">
      <div class="w-36"><CampoFecha v-model="filtro.desde" /></div>
      <div class="w-36"><CampoFecha v-model="filtro.hasta" /></div>
      <select v-model="filtro.categoria" class="entrada w-auto" aria-label="Categoría"><option value="">Todas las categorías</option>
        <option v-for="(c, k) in CATEGORIAS_GASTO" :key="k" :value="k">{{ c }}</option></select>
      <span class="ml-auto rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">Total: {{ fmtMoneda(total) }}</span>
    </div>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <div class="tarjeta overflow-x-auto">
      <Cargando v-if="cargando && !gastos.length" />
      <EstadoVacio v-else-if="!gastos.length" :icono="Receipt" titulo="No hay gastos en el período" />
      <table v-else class="tabla">
        <thead class="bg-slate-50"><tr><th>Fecha</th><th>Descripción</th><th class="hidden sm:table-cell">Categoría</th><th class="hidden md:table-cell">Medio</th><th class="text-right">Monto</th><th /></tr></thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="g in gastos" :key="g.id">
            <td class="whitespace-nowrap">{{ fmtFecha(g.fecha, org.zona) }}</td>
            <td>{{ g.descripcion }}<span v-if="g.proveedor" class="block text-xs text-slate-500">{{ g.proveedor }}</span></td>
            <td class="hidden sm:table-cell">{{ CATEGORIAS_GASTO[g.categoria] }}</td>
            <td class="hidden md:table-cell">{{ MEDIOS_PAGO[g.medio] }}</td>
            <td class="text-right tabular-nums">{{ fmtMoneda(g.monto) }}</td>
            <td class="whitespace-nowrap text-right">
              <template v-if="org.puede('gastos.gestionar')">
                <button class="btn-fantasma p-1.5" aria-label="Editar" @click="abrir(g)"><Pencil class="size-4" /></button>
                <button class="btn-fantasma p-1.5 text-rose-600" aria-label="Eliminar" @click="borrar(g)"><Trash2 class="size-4" /></button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Modal v-model="abierto" :titulo="editando ? 'Editar gasto' : 'Nuevo gasto'">
      <form id="form-gasto" class="grid gap-3 sm:grid-cols-2" @submit.prevent="guardar">
        <Campo etiqueta="Descripción" para="g-desc" requerido class="sm:col-span-2"><input id="g-desc" v-model="f.descripcion" class="entrada" /></Campo>
        <Campo etiqueta="Monto" para="g-monto" requerido><CampoMoneda id="g-monto" v-model="f.monto" /></Campo>
        <Campo etiqueta="Fecha" para="g-fecha" requerido><CampoFecha id="g-fecha" v-model="f.fecha" /></Campo>
        <Campo etiqueta="Categoría" para="g-cat"><select id="g-cat" v-model="f.categoria" class="entrada"><option v-for="(c, k) in CATEGORIAS_GASTO" :key="k" :value="k">{{ c }}</option></select></Campo>
        <Campo etiqueta="Medio de pago" para="g-medio"><select id="g-medio" v-model="f.medio" class="entrada"><option v-for="(m, k) in MEDIOS_PAGO" :key="k" :value="k">{{ m }}</option></select></Campo>
        <Campo etiqueta="Proveedor" para="g-prov"><input id="g-prov" v-model="f.proveedor" class="entrada" /></Campo>
        <Campo v-if="org.sucursalesActivas.length > 1" etiqueta="Sede" para="g-suc">
          <select id="g-suc" v-model="f.sucursal_id" class="entrada"><option value="">General</option><option v-for="s in org.sucursalesActivas" :key="s.id" :value="s.id">{{ s.nombre }}</option></select>
        </Campo>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ errorForm }}</p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="abierto = false">Cancelar</button>
        <button type="submit" form="form-gasto" class="btn-primario">Guardar</button>
      </template>
    </Modal>
  </div>
</template>
