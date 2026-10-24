<script setup lang="ts">
// Caja: saldo de cada cuenta (efectivo, banco, Mercado Pago…) y los movimientos del período.
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowLeftRight, Download, Landmark, Pencil, Plus, Settings2 } from 'lucide-vue-next'
import PestanasFinanzas from '@/components/finanzas/PestanasFinanzas.vue'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import Cargando from '@/components/ui/Cargando.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtMoneda, hoyISO } from '@/lib/formato'
import { MEDIOS_PAGO } from '@/lib/catalogos'
import { exportarPDF, nombreArchivo } from '@/lib/pdf'
import { useCuentas, type Cuenta } from '@/composables/useCuentas'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'

interface CuentaCaja { id: string; nombre: string; tipo: string; activo: boolean; medios: string[]; saldo_inicial: number; saldo: number; ingresos: number; egresos: number }
interface Movimiento { fecha: string; tipo: string; descripcion: string; monto: number; reserva_id: string | null; id: string; cuenta_id: string | null; cuenta: string | null }
interface Resumen {
  cuentas: CuentaCaja[]
  sin_cuenta: number
  periodo: { cobros: number; gastos: number; garantias_cobradas: number; garantias_devueltas: number }
  movimientos: Movimiento[]
}

const TIPOS_CUENTA: Record<string, string> = { efectivo: 'Efectivo', banco: 'Banco', mercadopago: 'Mercado Pago', otro: 'Otra' }
const nombresMedios = (ms: string[]) => (ms.length ? ms.map((m) => MEDIOS_PAGO[m] ?? m).join(', ') : 'sin medios asociados')
const TIPOS_MOV: Record<string, string> = {
  cobro: 'Cobro', gasto: 'Gasto', garantia_cobro: 'Garantía', garantia_devolucion: 'Devolución', transferencia: 'Transferencia',
}

const org = useOrganizacion()
const { exito } = useNotificaciones()
const { cargar: recargarCuentas } = useCuentas()
const hoy = hoyISO(org.zona)
const filtro = reactive({ desde: `${hoy.slice(0, 7)}-01`, hasta: hoy, cuenta: '' })
const datos = ref<Resumen | null>(null)
const cargando = ref(true)
const error = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    datos.value = await api.get<Resumen>(rutaOrg(org.id, 'caja'), { desde: filtro.desde, hasta: filtro.hasta })
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
watch(() => [filtro.desde, filtro.hasta], cargar)
onMounted(cargar)

const cuentasVisibles = computed(() => (datos.value?.cuentas ?? []).filter((c) => c.activo || Number(c.saldo) !== 0))
const saldoTotal = computed(() => cuentasVisibles.value.reduce((s, c) => s + Number(c.saldo), 0) + Number(datos.value?.sin_cuenta ?? 0))
const movimientos = computed(() => (datos.value?.movimientos ?? []).filter((m) => !filtro.cuenta || m.cuenta_id === filtro.cuenta))
const neto = computed(() => {
  const p = datos.value?.periodo
  return p ? Number(p.cobros) + Number(p.garantias_cobradas) - Number(p.gastos) - Number(p.garantias_devueltas) : 0
})

// --- Transferencia entre cuentas -------------------------------------------------
const transfAbierta = ref(false)
const t = reactive({ fecha: hoy, desde_cuenta_id: '', hacia_cuenta_id: '', monto: null as number | null, descripcion: '' })
const errorT = ref('')
function abrirTransferencia() {
  const activas = (datos.value?.cuentas ?? []).filter((c) => c.activo)
  Object.assign(t, { fecha: hoy, desde_cuenta_id: activas[0]?.id ?? '', hacia_cuenta_id: activas[1]?.id ?? '', monto: null, descripcion: '' })
  errorT.value = ''
  transfAbierta.value = true
}
async function transferir() {
  if (!t.desde_cuenta_id || !t.hacia_cuenta_id || t.desde_cuenta_id === t.hacia_cuenta_id) { errorT.value = 'Elegí dos cuentas distintas.'; return }
  if (!t.monto || t.monto <= 0) { errorT.value = 'Ingresá el monto.'; return }
  try {
    await api.post(rutaOrg(org.id, 'transferencias'), { ...t })
    exito('Transferencia registrada.')
    transfAbierta.value = false
    void cargar()
  } catch (e) { errorT.value = traducirError(e) }
}

// --- Configurar cuentas ----------------------------------------------------------
const cuentasAbierto = ref(false)
const editando = ref<Cuenta | null>(null)
const fc = reactive({ nombre: '', tipo: 'efectivo', saldo_inicial: 0 as number | null, medios: [] as string[], activo: true })
const errorC = ref('')
const formCuentaAbierto = ref(false)
function abrirCuenta(c: CuentaCaja | null) {
  editando.value = c as unknown as Cuenta
  Object.assign(fc, c ? { nombre: c.nombre, tipo: c.tipo, saldo_inicial: Number(c.saldo_inicial), medios: [...c.medios], activo: c.activo }
    : { nombre: '', tipo: 'otro', saldo_inicial: 0, medios: [], activo: true })
  errorC.value = ''
  formCuentaAbierto.value = true
}
async function guardarCuenta() {
  if (fc.nombre.trim().length < 2) { errorC.value = 'Ingresá un nombre.'; return }
  try {
    const cuerpo = { ...fc, nombre: fc.nombre.trim(), saldo_inicial: fc.saldo_inicial ?? 0 }
    if (editando.value) await api.put(rutaOrg(org.id, `cuentas/${editando.value.id}`), cuerpo)
    else await api.post(rutaOrg(org.id, 'cuentas'), cuerpo)
    formCuentaAbierto.value = false
    await Promise.all([cargar(), recargarCuentas(true)])
  } catch (e) { errorC.value = traducirError(e) }
}

// --- Exportar ---------------------------------------------------------------------
async function exportar() {
  if (!datos.value) return
  const z = org.zona
  await exportarPDF(nombreArchivo('caja', org.actual?.nombre ?? '', hoy), {
    titulo: 'Caja', subtitulo: `Del ${fmtFecha(filtro.desde, z)} al ${fmtFecha(filtro.hasta, z)}`, organizacion: org.actual?.nombre ?? '', zona: z,
    resumen: [
      ['Saldo total hoy', fmtMoneda(saldoTotal.value)], ['Cobros', fmtMoneda(datos.value.periodo.cobros)],
      ['Gastos', fmtMoneda(datos.value.periodo.gastos)], ['Neto del período', fmtMoneda(neto.value)],
    ],
    secciones: [
      { titulo: 'Saldos por cuenta', columnas: [{ clave: 'nombre', titulo: 'Cuenta' }, { clave: 'ingresos', titulo: 'Ingresos del período', alinear: 'right' },
          { clave: 'egresos', titulo: 'Egresos del período', alinear: 'right' }, { clave: 'saldo', titulo: 'Saldo actual', alinear: 'right' }],
        filas: cuentasVisibles.value.map((c) => ({ nombre: c.nombre, ingresos: fmtMoneda(c.ingresos), egresos: fmtMoneda(c.egresos), saldo: fmtMoneda(c.saldo) })) },
      { titulo: 'Movimientos', vacio: 'Sin movimientos en el período.',
        columnas: [{ clave: 'fecha', titulo: 'Fecha', ancho: 12 }, { clave: 'tipo', titulo: 'Tipo', ancho: 14 }, { clave: 'descripcion', titulo: 'Detalle', ancho: 40 },
          { clave: 'cuenta', titulo: 'Cuenta', ancho: 16 }, { clave: 'monto', titulo: 'Monto', ancho: 18, alinear: 'right' }],
        filas: movimientos.value.map((m) => ({ fecha: fmtFecha(m.fecha, z), tipo: TIPOS_MOV[m.tipo] ?? m.tipo, descripcion: m.descripcion,
          cuenta: m.cuenta ?? 'Sin cuenta', monto: fmtMoneda(m.monto) })) },
    ],
  })
}
</script>

<template>
  <div class="space-y-4">
    <PestanasFinanzas />
    <div class="flex flex-wrap items-end gap-2">
      <div class="w-36"><CampoFecha v-model="filtro.desde" /></div>
      <div class="w-36"><CampoFecha v-model="filtro.hasta" /></div>
      <div class="ml-auto flex flex-wrap gap-2">
        <button v-if="org.puede('datos.exportar')" class="btn-secundario" :disabled="!datos" @click="exportar"><Download class="size-4" /> PDF</button>
        <template v-if="org.puede('caja.gestionar')">
          <button class="btn-secundario" @click="cuentasAbierto = true"><Settings2 class="size-4" /> Cuentas</button>
          <button class="btn-primario" @click="abrirTransferencia"><ArrowLeftRight class="size-4" /> Transferir</button>
        </template>
      </div>
    </div>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <Cargando v-if="cargando && !datos" />
    <template v-else-if="datos">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button v-for="c in cuentasVisibles" :key="c.id" type="button"
                :class="['tarjeta p-4 text-left transition', filtro.cuenta === c.id ? 'ring-2 ring-marca-500' : 'hover:ring-1 hover:ring-slate-300']"
                :aria-pressed="filtro.cuenta === c.id" @click="filtro.cuenta = filtro.cuenta === c.id ? '' : c.id">
          <p class="flex items-center gap-1.5 text-sm text-slate-500"><Landmark class="size-4" /> {{ c.nombre }}<span v-if="!c.activo" class="text-xs">(inactiva)</span></p>
          <p :class="['mt-1 text-2xl font-semibold tabular-nums', Number(c.saldo) < 0 && 'text-rose-700']">{{ fmtMoneda(c.saldo) }}</p>
          <p class="mt-1 text-xs text-slate-500">
            <span class="text-emerald-700">+{{ fmtMoneda(c.ingresos, true) }}</span> · <span class="text-rose-700">−{{ fmtMoneda(c.egresos, true) }}</span> en el período
          </p>
        </button>
      </div>
      <p v-if="Number(datos.sin_cuenta) !== 0" class="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
        Hay {{ fmtMoneda(datos.sin_cuenta) }} en movimientos sin cuenta (medios de pago que no están asociados a ninguna cuenta). Asociá ese medio a una cuenta en «Cuentas».
      </p>
      <div class="tarjeta grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-5">
        <div><p class="text-slate-500">Cobros</p><p class="font-semibold tabular-nums text-emerald-700">{{ fmtMoneda(datos.periodo.cobros) }}</p></div>
        <div><p class="text-slate-500">Garantías cobradas</p><p class="font-semibold tabular-nums">{{ fmtMoneda(datos.periodo.garantias_cobradas) }}</p></div>
        <div><p class="text-slate-500">Gastos</p><p class="font-semibold tabular-nums text-rose-700">{{ fmtMoneda(datos.periodo.gastos) }}</p></div>
        <div><p class="text-slate-500">Garantías devueltas</p><p class="font-semibold tabular-nums">{{ fmtMoneda(datos.periodo.garantias_devueltas) }}</p></div>
        <div><p class="text-slate-500">Neto del período</p><p :class="['font-semibold tabular-nums', neto < 0 ? 'text-rose-700' : 'text-slate-900']">{{ fmtMoneda(neto) }}</p></div>
      </div>
      <div class="tarjeta overflow-x-auto">
        <EstadoVacio v-if="!movimientos.length" :icono="Landmark" titulo="No hay movimientos en el período" />
        <table v-else class="tabla">
          <thead class="bg-slate-50"><tr><th>Fecha</th><th>Detalle</th><th class="hidden sm:table-cell">Cuenta</th><th class="text-right">Monto</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="m in movimientos" :key="`${m.tipo}-${m.id}-${m.monto}`">
              <td class="whitespace-nowrap">{{ fmtFecha(m.fecha, org.zona) }}</td>
              <td>
                <span class="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{{ TIPOS_MOV[m.tipo] ?? m.tipo }}</span>
                <RouterLink v-if="m.reserva_id" :to="{ name: 'reserva', params: { id: m.reserva_id } }" class="enlace">{{ m.descripcion }}</RouterLink>
                <template v-else>{{ m.descripcion }}</template>
                <span class="block text-xs text-slate-500 sm:hidden">{{ m.cuenta ?? 'Sin cuenta' }}</span>
              </td>
              <td class="hidden sm:table-cell">{{ m.cuenta ?? 'Sin cuenta' }}</td>
              <td :class="['text-right tabular-nums', Number(m.monto) < 0 ? 'text-rose-700' : 'text-emerald-700']">{{ fmtMoneda(m.monto) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <Modal v-model="transfAbierta" titulo="Transferir entre cuentas">
      <form id="form-transf" class="grid gap-3 sm:grid-cols-2" @submit.prevent="transferir">
        <Campo etiqueta="Desde" para="t-desde"><select id="t-desde" v-model="t.desde_cuenta_id" class="entrada">
          <option v-for="c in (datos?.cuentas ?? []).filter((x) => x.activo)" :key="c.id" :value="c.id">{{ c.nombre }}</option></select></Campo>
        <Campo etiqueta="Hacia" para="t-hacia"><select id="t-hacia" v-model="t.hacia_cuenta_id" class="entrada">
          <option v-for="c in (datos?.cuentas ?? []).filter((x) => x.activo)" :key="c.id" :value="c.id">{{ c.nombre }}</option></select></Campo>
        <Campo etiqueta="Monto" para="t-monto" requerido><CampoMoneda id="t-monto" v-model="t.monto" /></Campo>
        <Campo etiqueta="Fecha" para="t-fecha" requerido><CampoFecha id="t-fecha" v-model="t.fecha" /></Campo>
        <Campo etiqueta="Detalle" para="t-desc" class="sm:col-span-2"><input id="t-desc" v-model="t.descripcion" class="entrada" placeholder="Ej.: depósito del efectivo del fin de semana" /></Campo>
        <p v-if="errorT" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ errorT }}</p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="transfAbierta = false">Cancelar</button>
        <button type="submit" form="form-transf" class="btn-primario">Registrar</button>
      </template>
    </Modal>

    <Modal v-model="cuentasAbierto" titulo="Cuentas">
      <p class="text-sm text-slate-600">Cada cobro, gasto o garantía va a la cuenta que elijas al registrarlo; si no elegís, a la que tiene asociado su medio de pago.</p>
      <ul class="mt-3 divide-y divide-slate-100">
        <li v-for="c in datos?.cuentas ?? []" :key="c.id" class="flex items-center justify-between gap-2 py-2">
          <span><span :class="['font-medium', !c.activo && 'text-slate-400']">{{ c.nombre }}</span>
            <span class="block text-xs text-slate-500">{{ TIPOS_CUENTA[c.tipo] }} · {{ nombresMedios(c.medios) }}{{ c.activo ? '' : ' · inactiva' }}</span></span>
          <button class="btn-fantasma p-1.5" :aria-label="`Editar ${c.nombre}`" @click="abrirCuenta(c)"><Pencil class="size-4" /></button>
        </li>
      </ul>
      <template #pie>
        <button class="btn-secundario" @click="abrirCuenta(null)"><Plus class="size-4" /> Nueva cuenta</button>
        <button class="btn-primario" @click="cuentasAbierto = false">Listo</button>
      </template>
    </Modal>

    <Modal v-model="formCuentaAbierto" :titulo="editando ? 'Editar cuenta' : 'Nueva cuenta'">
      <form id="form-cuenta" class="grid gap-3 sm:grid-cols-2" @submit.prevent="guardarCuenta">
        <Campo etiqueta="Nombre" para="c-nombre" requerido><input id="c-nombre" v-model="fc.nombre" class="entrada" placeholder="Ej.: Banco Galicia" /></Campo>
        <Campo etiqueta="Tipo" para="c-tipo"><select id="c-tipo" v-model="fc.tipo" class="entrada"><option v-for="(n, k) in TIPOS_CUENTA" :key="k" :value="k">{{ n }}</option></select></Campo>
        <Campo etiqueta="Saldo inicial" para="c-saldo" ayuda="Lo que había en la cuenta al empezar a usar Festy."><CampoMoneda id="c-saldo" v-model="fc.saldo_inicial" /></Campo>
        <fieldset class="sm:col-span-2">
          <legend class="mb-1 text-sm font-medium text-slate-700">Medios de pago que van a esta cuenta</legend>
          <div class="flex flex-wrap gap-2">
            <label v-for="(m, k) in MEDIOS_PAGO" :key="k" class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <input v-model="fc.medios" type="checkbox" :value="k" /> {{ m }}</label>
          </div>
        </fieldset>
        <label v-if="editando" class="flex items-center gap-2 text-sm sm:col-span-2"><input v-model="fc.activo" type="checkbox" /> Cuenta activa</label>
        <p v-if="errorC" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ errorC }}</p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="formCuentaAbierto = false">Cancelar</button>
        <button type="submit" form="form-cuenta" class="btn-primario">Guardar</button>
      </template>
    </Modal>
  </div>
</template>
