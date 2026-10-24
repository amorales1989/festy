<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, Receipt, Wallet } from 'lucide-vue-next'
import PestanasFinanzas from '@/components/finanzas/PestanasFinanzas.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import Cargando from '@/components/ui/Cargando.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtMoneda, hoyISO, sumarDiasISO } from '@/lib/formato'
import { CONCEPTOS_PAGO, MEDIOS_PAGO } from '@/lib/catalogos'
import { exportarPDF, nombreArchivo } from '@/lib/pdf'
import { comprobanteDePago } from '@/lib/comprobantes'
import { guardarPDF } from '@/lib/compartir'
import { useOrganizacion } from '@/stores/organizacion'

type Ver = 'proximos' | 'vencidos' | 'pagos'
interface CuotaFila { id: string; reserva_id: string; concepto: string; vencimiento: string; pendiente: number; numero?: number; titulo?: string }
interface PagoFila { id: string; numero_comprobante: number; fecha: string; monto: number; medio: string; concepto: string; referencia: string | null; anulado: boolean; reservas: { id: string; numero: number; titulo: string } | null }

const org = useOrganizacion()
const route = useRoute()
const router = useRouter()
const hoy = computed(() => hoyISO(org.zona))
const estado = reactive({
  ver: (['proximos', 'vencidos', 'pagos'].includes(String(route.query.ver)) ? route.query.ver : 'proximos') as Ver,
  desde: typeof route.query.desde === 'string' ? route.query.desde : sumarDiasISO(hoyISO(org.zona), -30),
  hasta: typeof route.query.hasta === 'string' ? route.query.hasta : hoyISO(org.zona),
})
const cuotas = ref<CuotaFila[]>([])
const pagos = ref<PagoFila[]>([])
const cargando = ref(true)
const error = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    if (estado.ver === 'pagos') {
      pagos.value = await api.get<PagoFila[]>(rutaOrg(org.id, 'cobros'), { desde: estado.desde, hasta: estado.hasta })
    } else {
      cuotas.value = (await api.get<typeof cuotas.value>(rutaOrg(org.id, 'cuotas'), { vista: estado.ver, hoy: hoy.value }))
        .map((c) => ({ ...c, pendiente: Number(c.pendiente) }))
    }
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
watch(() => ({ ...estado }), (e) => {
  void router.replace({ query: e.ver === 'pagos' ? { ver: e.ver, desde: e.desde, hasta: e.hasta } : { ver: e.ver } })
  void cargar()
})
onMounted(cargar)

const totalCuotas = computed(() => cuotas.value.reduce((s, c) => s + c.pendiente, 0))
const totalPagos = computed(() => pagos.value.filter((p) => !p.anulado).reduce((s, p) => s + Number(p.monto), 0))
const porMedio = computed(() => {
  const m = new Map<string, number>()
  for (const p of pagos.value) if (!p.anulado) m.set(p.medio, (m.get(p.medio) ?? 0) + Number(p.monto))
  return [...m.entries()].sort((a, b) => b[1] - a[1])
})
async function comprobante(id: string) {
  try {
    const { doc, archivo } = await comprobanteDePago(id, org.actual!)
    await guardarPDF(doc, archivo, 'Comprobante')
  } catch (e) { error.value = traducirError(e) }
}
const exportando = ref(false)
async function exportar() {
  exportando.value = true
  const nombreOrg = org.actual?.nombre ?? ''
  try {
    if (estado.ver === 'pagos') {
      await exportarPDF(nombreArchivo('cobros', nombreOrg, hoyISO(org.zona)), {
        titulo: 'Cobros registrados', subtitulo: `Del ${fmtFecha(estado.desde, org.zona)} al ${fmtFecha(estado.hasta, org.zona)}`,
        organizacion: nombreOrg, zona: org.zona,
        resumen: [['Total cobrado', fmtMoneda(totalPagos.value)], ...porMedio.value.slice(0, 3).map(([m, v]): [string, string] => [MEDIOS_PAGO[m] ?? m, fmtMoneda(v)])],
        secciones: [{
          columnas: [
            { clave: 'fecha', titulo: 'Fecha', ancho: 12 }, { clave: 'evento', titulo: 'Evento', ancho: 31 },
            { clave: 'concepto', titulo: 'Concepto', ancho: 12 }, { clave: 'medio', titulo: 'Medio', ancho: 16 },
            { clave: 'referencia', titulo: 'Referencia', ancho: 13 }, { clave: 'monto', titulo: 'Monto', ancho: 18, alinear: 'right' },
          ],
          filas: pagos.value.map((p) => ({
            fecha: fmtFecha(p.fecha, org.zona), evento: p.reservas ? `#${p.reservas.numero} ${p.reservas.titulo}` : '',
            concepto: CONCEPTOS_PAGO[p.concepto] + (p.anulado ? ' (anulado)' : ''), medio: MEDIOS_PAGO[p.medio],
            referencia: p.referencia, monto: p.anulado ? `(${fmtMoneda(p.monto)})` : fmtMoneda(p.monto),
          })),
          pie: { evento: 'Total (sin anulados)', monto: fmtMoneda(totalPagos.value) },
          vacio: 'No hay cobros en el período.',
        }],
      })
    } else {
      const vencidos = estado.ver === 'vencidos'
      await exportarPDF(nombreArchivo(vencidos ? 'cuotas-vencidas' : 'cuotas-a-cobrar', nombreOrg, hoyISO(org.zona)), {
        titulo: vencidos ? 'Cuotas vencidas' : 'Cuotas a cobrar', subtitulo: vencidos ? `Al ${fmtFecha(hoy.value, org.zona)}` : 'Próximos 60 días',
        organizacion: nombreOrg, zona: org.zona,
        resumen: [['Total pendiente', fmtMoneda(totalCuotas.value)], ['Cuotas', String(cuotas.value.length)]],
        secciones: [{
          columnas: [
            { clave: 'vencimiento', titulo: 'Vencimiento', ancho: 14 }, { clave: 'evento', titulo: 'Evento', ancho: 44 },
            { clave: 'concepto', titulo: 'Concepto', ancho: 16 }, { clave: 'pendiente', titulo: 'Pendiente', ancho: 18, alinear: 'right' },
          ],
          filas: cuotas.value.map((c) => ({
            vencimiento: fmtFecha(c.vencimiento, org.zona), evento: `#${c.numero} ${c.titulo}`, concepto: c.concepto, pendiente: fmtMoneda(c.pendiente),
          })),
          pie: { evento: 'Total', pendiente: fmtMoneda(totalCuotas.value) },
          vacio: 'No hay cuotas pendientes.',
        }],
      })
    }
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    exportando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <PestanasFinanzas />
    <div class="flex flex-wrap items-center justify-end gap-3">
      <button v-if="org.puede('datos.exportar') && org.tieneFuncion('exportacion')" class="btn-secundario" :disabled="exportando" @click="exportar"><Download class="size-4" /> {{ exportando ? 'Generando…' : 'Exportar PDF' }}</button>
    </div>
    <div class="flex flex-wrap items-end gap-2">
      <div class="flex rounded-lg bg-slate-100 p-0.5" role="tablist">
        <button v-for="(t, k) in { proximos: 'A cobrar (60 días)', vencidos: 'Vencidos', pagos: 'Cobros registrados' }" :key="k" role="tab" :aria-selected="estado.ver === k"
                :class="['rounded-md px-3 py-1.5 text-sm font-medium', estado.ver === k ? 'bg-white shadow-sm' : 'text-slate-600']" @click="estado.ver = k as Ver">{{ t }}</button>
      </div>
      <template v-if="estado.ver === 'pagos'">
        <div class="w-36"><CampoFecha v-model="estado.desde" /></div>
        <div class="w-36"><CampoFecha v-model="estado.hasta" /></div>
      </template>
    </div>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>

    <div v-if="estado.ver === 'pagos' && pagos.length" class="flex flex-wrap gap-2 text-sm">
      <span class="rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">Total: {{ fmtMoneda(totalPagos) }}</span>
      <span v-for="[m, v] in porMedio" :key="m" class="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">{{ MEDIOS_PAGO[m] }}: {{ fmtMoneda(v, true) }}</span>
    </div>
    <div v-else-if="estado.ver !== 'pagos' && cuotas.length" class="text-sm">
      <span :class="['rounded-lg px-3 py-2 font-semibold', estado.ver === 'vencidos' ? 'bg-rose-50 text-rose-800' : 'bg-sky-50 text-sky-800']">Total pendiente: {{ fmtMoneda(totalCuotas) }}</span>
    </div>

    <div class="tarjeta overflow-x-auto">
      <Cargando v-if="cargando" />
      <template v-else-if="estado.ver === 'pagos'">
        <EstadoVacio v-if="!pagos.length" :icono="Wallet" titulo="No hay cobros en el período" />
        <table v-else class="tabla">
          <thead class="bg-slate-50"><tr><th>Fecha</th><th>Evento</th><th>Concepto</th><th>Medio</th><th class="text-right">Monto</th><th class="text-right">Comprobante</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in pagos" :key="p.id" :class="p.anulado && 'opacity-50'">
              <td>{{ fmtFecha(p.fecha, org.zona) }}</td>
              <td><RouterLink v-if="p.reservas" :to="{ name: 'reserva', params: { id: p.reservas.id } }" class="enlace">#{{ p.reservas.numero }} {{ p.reservas.titulo }}</RouterLink></td>
              <td>{{ CONCEPTOS_PAGO[p.concepto] }}<span v-if="p.anulado" class="ml-1 text-xs text-rose-600">(anulado)</span></td>
              <td>{{ MEDIOS_PAGO[p.medio] }}</td>
              <td :class="['text-right tabular-nums', p.anulado && 'line-through']">{{ fmtMoneda(p.monto) }}</td>
              <td class="text-right"><button class="btn-fantasma btn-chico" :title="`Descargar comprobante N° ${p.numero_comprobante}`" @click="comprobante(p.id)"><Receipt class="size-4" /> N° {{ p.numero_comprobante }}</button></td>
            </tr>
          </tbody>
        </table>
      </template>
      <template v-else>
        <EstadoVacio v-if="!cuotas.length" :icono="Wallet" :titulo="estado.ver === 'vencidos' ? 'No hay cuotas vencidas' : 'No hay cuotas a cobrar'"
                     descripcion="Las cuotas se cargan desde el plan de pagos de cada reserva." />
        <table v-else class="tabla">
          <thead class="bg-slate-50"><tr><th>Vencimiento</th><th>Reserva</th><th>Concepto</th><th class="text-right">Pendiente</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="c in cuotas" :key="c.id">
              <td :class="c.vencimiento < hoy && 'font-medium text-rose-600'">{{ fmtFecha(c.vencimiento, org.zona) }}</td>
              <td><RouterLink :to="{ name: 'reserva', params: { id: c.reserva_id } }" class="enlace">#{{ c.numero }} {{ c.titulo }}</RouterLink></td>
              <td>{{ c.concepto }}</td>
              <td class="text-right tabular-nums">{{ fmtMoneda(c.pendiente) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>
  </div>
</template>
