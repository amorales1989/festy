<script setup lang="ts">
// Costos del evento (lo tercerizado o comprado para él), lo pagado a cada proveedor y la ganancia.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Banknote, Pencil, Plus, Trash2, TrendingUp, Wand2 } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import SelectorCuenta from '@/components/finanzas/SelectorCuenta.vue'
import { api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtMoneda, hoyISO } from '@/lib/formato'
import { MEDIOS_PAGO } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

interface Costo { id: string; descripcion: string; monto: number; pagado: number; pendiente: number; proveedor_id: string | null; proveedor_nombre: string | null; vencimiento: string | null; reserva_item_id: string | null }
interface Datos { costos: Costo[]; gastos_directos: number; total_evento: number; total_costos: number; pagado: number; ganancia: number }
interface Proveedor { id: string; nombre: string; activo: boolean }

const props = defineProps<{ reservaId: string; tieneServicios: boolean; cancelada: boolean }>()
const org = useOrganizacion()
const { confirmar } = useConfirmar()
const { exito, info, error: notificarError } = useNotificaciones()
const datos = ref<Datos | null>(null)
const proveedores = ref<Proveedor[]>([])
const puedeGestionar = computed(() => org.puede('gastos.gestionar') && !props.cancelada)

async function cargar() {
  try { datos.value = await api.get<Datos>(`/reservas/${props.reservaId}/costos`) } catch (e) { notificarError(e) }
}
onMounted(cargar)
watch(() => props.reservaId, cargar)
async function cargarProveedores() {
  if (!proveedores.value.length) proveedores.value = (await api.get<Proveedor[]>(rutaOrg(org.id, 'proveedores')).catch(() => [])).filter((p) => p.activo)
}
const margen = computed(() => (datos.value && Number(datos.value.total_evento) > 0 ? Math.round((Number(datos.value.ganancia) * 1000) / Number(datos.value.total_evento)) / 10 : null))

// --- Alta / edición de costo ----------------------------------------------------------
const costoAbierto = ref(false)
const sel = ref<Costo | null>(null)
const fc = reactive({ descripcion: '', monto: null as number | null, proveedor_id: '', vencimiento: '', proveedor_nuevo: '' })
const errorCosto = ref('')
async function abrirCosto(c: Costo | null = null) {
  await cargarProveedores()
  sel.value = c
  Object.assign(fc, { descripcion: c?.descripcion ?? '', monto: c ? Number(c.monto) : null, proveedor_id: c?.proveedor_id ?? '', vencimiento: c?.vencimiento ?? '', proveedor_nuevo: '' })
  errorCosto.value = ''
  costoAbierto.value = true
}
async function guardarCosto() {
  if (fc.descripcion.trim().length < 2 || !fc.monto || fc.monto <= 0) { errorCosto.value = 'Completá qué es y el monto.'; return }
  try {
    let proveedorId = fc.proveedor_id
    if (proveedorId === 'nuevo') {
      if (fc.proveedor_nuevo.trim().length < 2) { errorCosto.value = 'Ingresá el nombre del proveedor.'; return }
      const p = await api.post<Proveedor>(rutaOrg(org.id, 'proveedores'), { nombre: fc.proveedor_nuevo.trim() })
      proveedores.value = [...proveedores.value, p]
      proveedorId = p.id
    }
    const cuerpo = { reserva_id: props.reservaId, descripcion: fc.descripcion.trim(), monto: fc.monto, proveedor_id: proveedorId || null, vencimiento: fc.vencimiento || null }
    if (sel.value) await api.put(rutaOrg(org.id, `costos/${sel.value.id}`), cuerpo)
    else await api.post(rutaOrg(org.id, 'costos'), cuerpo)
    costoAbierto.value = false
    void cargar()
  } catch (e) { errorCosto.value = traducirError(e) }
}
async function borrarCosto(c: Costo) {
  const msj = Number(c.pagado) > 0 ? ` Lo ya pagado (${fmtMoneda(c.pagado)}) queda como gasto del evento.` : ''
  if (!(await confirmar({ titulo: 'Quitar costo', mensaje: `¿Quitar “${c.descripcion}”?${msj}`, confirmar: 'Quitar', peligro: true }))) return
  try { await eliminarRegistro('costos_evento', c.id); void cargar() } catch (e) { notificarError(e) }
}
async function desdeCatalogo() {
  try {
    const { creados } = await api.post<{ creados: number }>(`/reservas/${props.reservaId}/costos/catalogo`)
    if (creados) exito(creados === 1 ? 'Se agregó 1 costo desde el catálogo.' : `Se agregaron ${creados} costos desde el catálogo.`)
    else info('No hay servicios con costo cargado en el catálogo (o ya se agregaron).')
    void cargar()
  } catch (e) { notificarError(e) }
}

// --- Pago a proveedor -------------------------------------------------------------------
const pagoAbierto = ref(false)
const aPagar = ref<Costo | null>(null)
const fp = reactive({ fecha: '', monto: null as number | null, medio: 'transferencia', cuenta_id: '' })
const errorPago = ref('')
function abrirPago(c: Costo) {
  aPagar.value = c
  Object.assign(fp, { fecha: hoyISO(org.zona), monto: Number(c.pendiente), medio: 'transferencia', cuenta_id: '' })
  errorPago.value = ''
  pagoAbierto.value = true
}
async function pagar() {
  if (!fp.monto || fp.monto <= 0) { errorPago.value = 'Ingresá el monto.'; return }
  try {
    await api.post(`/costos/${aPagar.value!.id}/pagos`, { ...fp })
    exito('Pago registrado. Quedó en Gastos y en la Caja.')
    pagoAbierto.value = false
    void cargar()
  } catch (e) { errorPago.value = traducirError(e) }
}
</script>

<template>
  <section class="tarjeta p-4 lg:col-span-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 text-sm font-semibold"><TrendingUp class="size-4 text-marca-600" /> Costos y proveedores</h2>
      <div v-if="puedeGestionar" class="flex flex-wrap gap-2">
        <button v-if="tieneServicios" class="btn-fantasma btn-chico" @click="desdeCatalogo"><Wand2 class="size-4" /> Desde el catálogo</button>
        <button class="btn-secundario btn-chico" @click="abrirCosto()"><Plus class="size-4" /> Agregar costo</button>
      </div>
    </div>
    <template v-if="datos">
      <ul v-if="datos.costos.length" class="mt-2 divide-y divide-slate-100 text-sm">
        <li v-for="c in datos.costos" :key="c.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
          <span class="min-w-0 flex-1">{{ c.descripcion }}
            <span class="block text-xs text-slate-500">{{ c.proveedor_nombre ?? 'Sin proveedor' }} ·
              <span v-if="Number(c.pendiente) <= 0" class="text-emerald-700">pagado</span>
              <span v-else-if="Number(c.pagado) > 0">pagado {{ fmtMoneda(c.pagado) }}, falta <span class="font-medium text-amber-800">{{ fmtMoneda(c.pendiente) }}</span></span>
              <span v-else class="text-amber-800">sin pagar</span></span></span>
          <span class="tabular-nums">{{ fmtMoneda(c.monto) }}</span>
          <span v-if="puedeGestionar" class="flex items-center">
            <button v-if="Number(c.pendiente) > 0" class="btn-fantasma btn-chico" @click="abrirPago(c)"><Banknote class="size-4" /> Pagar</button>
            <button class="btn-fantasma p-1.5" :aria-label="`Editar ${c.descripcion}`" @click="abrirCosto(c)"><Pencil class="size-4" /></button>
            <button class="btn-fantasma p-1.5 text-slate-400 hover:text-rose-600" :aria-label="`Quitar ${c.descripcion}`" @click="borrarCosto(c)"><Trash2 class="size-4" /></button>
          </span>
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-slate-500">Todavía no cargaste costos. Agregá lo que pagás por este evento (catering, DJ, decoración…) para ver cuánto te deja.</p>
      <dl class="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
        <div><dt class="text-xs text-slate-500">Facturado</dt><dd class="font-semibold tabular-nums">{{ fmtMoneda(datos.total_evento) }}</dd></div>
        <div><dt class="text-xs text-slate-500">Costos<template v-if="Number(datos.gastos_directos) > 0"> (incl. gastos)</template></dt><dd class="font-semibold tabular-nums">{{ fmtMoneda(datos.total_costos) }}</dd></div>
        <div><dt class="text-xs text-slate-500">Ganancia</dt><dd :class="['font-semibold tabular-nums', Number(datos.ganancia) < 0 ? 'text-rose-700' : 'text-emerald-700']">{{ fmtMoneda(datos.ganancia) }}</dd></div>
        <div><dt class="text-xs text-slate-500">Margen</dt><dd class="font-semibold tabular-nums">{{ margen === null ? '—' : `${margen.toLocaleString('es-AR')} %` }}</dd></div>
      </dl>
    </template>

    <Modal v-model="costoAbierto" :titulo="sel ? 'Editar costo' : 'Agregar costo'" ancho="sm">
      <form id="form-costo" class="space-y-3" @submit.prevent="guardarCosto">
        <Campo etiqueta="Qué es" para="co-desc" requerido><input id="co-desc" v-model="fc.descripcion" class="entrada" placeholder="Ej.: catering 120 cubiertos" /></Campo>
        <Campo etiqueta="Monto" para="co-monto" requerido><CampoMoneda id="co-monto" v-model="fc.monto" /></Campo>
        <Campo etiqueta="Proveedor" para="co-prov">
          <select id="co-prov" v-model="fc.proveedor_id" class="entrada"><option value="">Sin proveedor</option>
            <option v-for="p in proveedores" :key="p.id" :value="p.id">{{ p.nombre }}</option><option value="nuevo">+ Nuevo proveedor…</option></select>
        </Campo>
        <Campo v-if="fc.proveedor_id === 'nuevo'" etiqueta="Nombre del proveedor" para="co-nuevo"><input id="co-nuevo" v-model="fc.proveedor_nuevo" class="entrada" /></Campo>
        <Campo etiqueta="Vence el pago" para="co-venc"><CampoFecha id="co-venc" v-model="fc.vencimiento" /></Campo>
        <p v-if="errorCosto" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorCosto }}</p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="costoAbierto = false">Cancelar</button>
        <button type="submit" form="form-costo" class="btn-primario">Guardar</button>
      </template>
    </Modal>

    <Modal v-model="pagoAbierto" titulo="Pagar al proveedor" ancho="sm" :descripcion="aPagar ? `${aPagar.descripcion} · falta ${fmtMoneda(aPagar.pendiente)}` : ''">
      <form id="form-pago-costo" class="space-y-3" @submit.prevent="pagar">
        <div class="grid grid-cols-2 gap-3">
          <Campo etiqueta="Monto" para="pc-monto" requerido><CampoMoneda id="pc-monto" v-model="fp.monto" /></Campo>
          <Campo etiqueta="Fecha" para="pc-fecha" requerido><CampoFecha id="pc-fecha" v-model="fp.fecha" /></Campo>
        </div>
        <Campo etiqueta="Medio" para="pc-medio"><select id="pc-medio" v-model="fp.medio" class="entrada"><option v-for="(m, k) in MEDIOS_PAGO" :key="k" :value="k">{{ m }}</option></select></Campo>
        <Campo etiqueta="Sale de la cuenta" para="pc-cuenta"><SelectorCuenta id="pc-cuenta" v-model="fp.cuenta_id" :medio="fp.medio" /></Campo>
        <p v-if="errorPago" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorPago }}</p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="pagoAbierto = false">Cancelar</button>
        <button type="submit" form="form-pago-costo" class="btn-primario">Registrar pago</button>
      </template>
    </Modal>
  </section>
</template>
