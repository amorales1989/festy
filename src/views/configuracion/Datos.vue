<script setup lang="ts">
// Importación (CSV), exportación completa, datos de ejemplo y baja de la cuenta.
import { ref } from 'vue'
import Papa from 'papaparse'
import { Download, FileSpreadsheet, Sparkles, TriangleAlert, Upload } from 'lucide-vue-next'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, fmtFechaHora, fmtHora, fmtMoneda, hoyISO } from '@/lib/formato'
import { normalizar } from '@/lib/texto'
import { aCSV, descargar } from '@/lib/csv'
import { exportarPDF, nombreArchivo } from '@/lib/pdf'
import { CATEGORIAS_GASTO, CATEGORIAS_RECURSO, CONCEPTOS_PAGO, ESTADOS_CONTRATO, ESTADOS_RESERVA, MEDIOS_PAGO, TIPOS_BLOQUEO, TIPOS_ESPACIO } from '@/lib/catalogos'
import type { EstadoContrato, EstadoReserva } from '@/lib/supabase'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

type Tipo = 'clientes' | 'reservas'
interface Resultado { importados: number; duplicados?: number; errores: Array<{ fila: number; error: string }> }

const org = useOrganizacion()
const acciones = useAcciones()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()

const COLUMNAS: Record<Tipo, string[]> = {
  clientes: ['nombre', 'telefono', 'email', 'documento', 'direccion', 'tipo', 'notas'],
  reservas: ['cliente', 'telefono', 'email', 'espacio', 'fecha', 'hora_inicio', 'hora_fin', 'estado', 'invitados', 'precio', 'titulo', 'tipo_evento', 'notas'],
}
const EJEMPLOS: Record<Tipo, Array<Record<string, string>>> = {
  clientes: [{ nombre: 'María López', telefono: '+54 9 351 555-1234', email: 'maria@ejemplo.com', documento: '30111222', direccion: '', tipo: 'persona', notas: '' }],
  reservas: [{ cliente: 'María López', telefono: '+54 9 351 555-1234', email: '', espacio: org.espaciosActivos[0]?.nombre ?? 'Salón principal', fecha: '14/11/2026',
    hora_inicio: '21:00', hora_fin: '05:00', estado: 'confirmada', invitados: '120', precio: '2.500.000', titulo: '15 de Sofía', tipo_evento: 'quince', notas: '' }],
}

// --- Importación -------------------------------------------------------------
const tipo = ref<Tipo>('clientes')
const filas = ref<Array<Record<string, string>>>([])
const archivo = ref('')
const faltantes = ref<string[]>([])
const importando = ref(false)
const resultado = ref<Resultado | null>(null)
const errorImport = ref('')

function descargarPlantilla() {
  descargar(`plantilla-${tipo.value}.csv`, aCSV(EJEMPLOS[tipo.value], COLUMNAS[tipo.value].map((c) => ({ clave: c, titulo: c }))))
}
function alElegirArchivo(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  resultado.value = null
  errorImport.value = ''
  if (!f) return
  archivo.value = f.name
  Papa.parse<Record<string, string>>(f, {
    header: true, skipEmptyLines: 'greedy',
    transformHeader: (h) => normalizar(h).replace(/\s+/g, '_'),
    complete: (r) => {
      filas.value = r.data
      const requeridas = tipo.value === 'clientes' ? ['nombre'] : ['cliente', 'espacio', 'fecha']
      faltantes.value = requeridas.filter((c) => !(r.meta.fields ?? []).includes(c))
    },
    error: (err) => { errorImport.value = `No se pudo leer el archivo: ${err.message}` },
  })
}
async function importar() {
  importando.value = true
  errorImport.value = ''
  try {
    resultado.value = await api.post<Resultado>(rutaOrg(org.id, `importar/${tipo.value === 'clientes' ? 'clientes' : 'reservas'}`), { filas: filas.value })
    acciones.cambiosGuardados()
    filas.value = []
    archivo.value = ''
  } catch (e) {
    errorImport.value = traducirError(e)
  } finally {
    importando.value = false
  }
}

// --- Exportación completa (informe PDF) ---------------------------------------------
const exportando = ref(false)
type Filas = Array<Record<string, unknown>>

async function exportarTodo() {
  exportando.value = true
  const z = org.zona
  const sinPermiso = 'Tu rol no tiene acceso a esta información.'
  try {
    // Una sola llamada: cada sección llega en null si el rol no tiene permiso para verla.
    const datos = await api.get<Record<'espacios' | 'horarios' | 'recursos' | 'clientes' | 'reservas' | 'cuotas' | 'pagos' | 'gastos' | 'tareas' | 'bloqueos', Filas | null>>(
      rutaOrg(org.id, 'exportar'))
    const { espacios, horarios, recursos, clientes, reservas, cuotas, pagos, gastos, tareas, bloqueos } = datos
    const evento = (r: unknown) => { const x = r as { numero: number; titulo: string } | null; return x ? `#${x.numero} ${x.titulo}` : '' }
    const nombre = (r: unknown) => (r as { nombre: string } | null)?.nombre ?? ''
    const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const horarioDe = (id: unknown) => (horarios ?? []).filter((h) => h.espacio_id === id)
      .map((h) => `${DIAS[Number(h.dia_semana)]} ${String(h.hora_desde).slice(0, 5)}-${String(h.hora_hasta).slice(0, 5)}`).join(', ') || 'Sin restricción'
    const totalCobrado = (pagos ?? []).filter((p) => !p.anulado).reduce((t, p) => t + Number(p.monto), 0)
    const totalGastos = (gastos ?? []).reduce((t, g) => t + Number(g.monto), 0)

    await exportarPDF(nombreArchivo('informe-completo', org.actual?.nombre ?? '', hoyISO(z)), {
      titulo: 'Informe completo de datos', subtitulo: 'Sedes, clientes, eventos, cobros, gastos y tareas',
      organizacion: org.actual?.nombre ?? '', zona: z, horizontal: true,
      resumen: [
        ['Clientes', clientes ? String(clientes.length) : '—'], ['Eventos', reservas ? String(reservas.length) : '—'],
        ['Total cobrado', pagos ? fmtMoneda(totalCobrado) : '—'], ['Total gastos', gastos ? fmtMoneda(totalGastos) : '—'],
      ],
      secciones: [
        { titulo: 'Espacios', vacio: espacios ? 'Sin espacios.' : sinPermiso,
          columnas: [{ clave: 'nombre', titulo: 'Espacio', ancho: 16 }, { clave: 'sede', titulo: 'Sede', ancho: 14 }, { clave: 'tipo', titulo: 'Tipo', ancho: 9 },
            { clave: 'cap', titulo: 'Capacidad', ancho: 8, alinear: 'right' }, { clave: 'tiempos', titulo: 'Armado / limpieza', ancho: 12 },
            { clave: 'horario', titulo: 'Horario de atención', ancho: 33 }, { clave: 'activo', titulo: 'Activo', ancho: 6 }],
          filas: (espacios ?? []).map((e) => ({ nombre: e.nombre, sede: nombre(e.sucursales), tipo: TIPOS_ESPACIO[String(e.tipo)], cap: e.capacidad_maxima,
            tiempos: `${Number(e.preparacion_min) + Number(e.montaje_min)} / ${Number(e.desmontaje_min) + Number(e.limpieza_min)} min`,
            horario: horarioDe(e.id), activo: e.activo ? 'Sí' : 'No' })) },
        { titulo: 'Recursos', vacio: recursos ? 'Sin recursos cargados.' : sinPermiso,
          columnas: [{ clave: 'nombre', titulo: 'Recurso' }, { clave: 'sede', titulo: 'Sede' }, { clave: 'categoria', titulo: 'Categoría' }, { clave: 'cantidad', titulo: 'Cantidad', alinear: 'right' }],
          filas: (recursos ?? []).map((r) => ({ nombre: r.nombre, sede: nombre(r.sucursales), categoria: CATEGORIAS_RECURSO[String(r.categoria)], cantidad: r.cantidad })) },
        { titulo: 'Clientes', vacio: clientes ? 'Sin clientes.' : sinPermiso,
          columnas: [{ clave: 'nombre', titulo: 'Nombre', ancho: 24 }, { clave: 'documento', titulo: 'DNI / CUIT', ancho: 12 }, { clave: 'telefono', titulo: 'Teléfono', ancho: 15 },
            { clave: 'email', titulo: 'Email', ancho: 24 }, { clave: 'alta', titulo: 'Cliente desde', ancho: 10 }],
          filas: (clientes ?? []).map((c) => ({ ...c, alta: fmtFecha(String(c.creado_at), z) })) },
        { titulo: 'Eventos', vacio: reservas ? 'Sin eventos.' : sinPermiso,
          columnas: [{ clave: 'numero', titulo: '#', ancho: 4, alinear: 'right' }, { clave: 'fecha', titulo: 'Fecha', ancho: 9 }, { clave: 'horario', titulo: 'Horario', ancho: 11 },
            { clave: 'titulo', titulo: 'Evento', ancho: 20 }, { clave: 'cliente', titulo: 'Cliente', ancho: 14 }, { clave: 'espacios', titulo: 'Espacios', ancho: 13 },
            { clave: 'invitados', titulo: 'Invit.', ancho: 5, alinear: 'right' }, { clave: 'estado', titulo: 'Estado', ancho: 12 },
            { clave: 'contrato', titulo: 'Contrato', ancho: 8 }, { clave: 'total', titulo: 'Total', ancho: 11, alinear: 'right' }],
          filas: (reservas ?? []).map((r) => ({ numero: r.numero, fecha: fmtFecha(String(r.inicio), z), horario: `${fmtHora(String(r.inicio), z)} a ${fmtHora(String(r.fin), z)}`,
            titulo: r.titulo, cliente: nombre(r.clientes), espacios: (r.reserva_espacios as Array<{ espacios: { nombre: string } | null }>).map((e) => e.espacios?.nombre).join(', '),
            invitados: r.invitados ?? '', estado: ESTADOS_RESERVA[r.estado as EstadoReserva].etiqueta,
            contrato: ESTADOS_CONTRATO[r.contrato_estado as EstadoContrato], total: fmtMoneda(Number(r.precio_total)) })) },
        { titulo: 'Plan de cuotas', vacio: cuotas ? 'Sin cuotas.' : sinPermiso,
          columnas: [{ clave: 'vencimiento', titulo: 'Vencimiento', ancho: 12 }, { clave: 'evento', titulo: 'Evento', ancho: 45 }, { clave: 'concepto', titulo: 'Concepto', ancho: 20 },
            { clave: 'monto', titulo: 'Monto', ancho: 15, alinear: 'right' }],
          filas: (cuotas ?? []).map((c) => ({ vencimiento: fmtFecha(String(c.vencimiento), z), evento: evento(c.reservas), concepto: c.concepto, monto: fmtMoneda(Number(c.monto)) })) },
        { titulo: 'Cobros', vacio: pagos ? 'Sin cobros.' : sinPermiso,
          columnas: [{ clave: 'fecha', titulo: 'Fecha', ancho: 10 }, { clave: 'evento', titulo: 'Evento', ancho: 38 }, { clave: 'concepto', titulo: 'Concepto', ancho: 13 },
            { clave: 'medio', titulo: 'Medio', ancho: 14 }, { clave: 'referencia', titulo: 'Referencia', ancho: 12 }, { clave: 'monto', titulo: 'Monto', ancho: 13, alinear: 'right' }],
          filas: (pagos ?? []).map((p) => ({ fecha: fmtFecha(String(p.fecha), z), evento: evento(p.reservas), concepto: CONCEPTOS_PAGO[String(p.concepto)] + (p.anulado ? ' (anulado)' : ''),
            medio: MEDIOS_PAGO[String(p.medio)], referencia: p.referencia, monto: p.anulado ? `(${fmtMoneda(Number(p.monto))})` : fmtMoneda(Number(p.monto)) })),
          pie: pagos?.length ? { evento: 'Total (sin anulados)', monto: fmtMoneda(totalCobrado) } : undefined },
        { titulo: 'Gastos', vacio: gastos ? 'Sin gastos.' : sinPermiso,
          columnas: [{ clave: 'fecha', titulo: 'Fecha', ancho: 10 }, { clave: 'categoria', titulo: 'Categoría', ancho: 16 }, { clave: 'descripcion', titulo: 'Descripción', ancho: 32 },
            { clave: 'proveedor', titulo: 'Proveedor', ancho: 16 }, { clave: 'medio', titulo: 'Medio', ancho: 13 }, { clave: 'monto', titulo: 'Monto', ancho: 13, alinear: 'right' }],
          filas: (gastos ?? []).map((g) => ({ fecha: fmtFecha(String(g.fecha), z), categoria: CATEGORIAS_GASTO[String(g.categoria)], descripcion: g.descripcion,
            proveedor: g.proveedor, medio: MEDIOS_PAGO[String(g.medio)], monto: fmtMoneda(Number(g.monto)) })),
          pie: gastos?.length ? { descripcion: 'Total', monto: fmtMoneda(totalGastos) } : undefined },
        { titulo: 'Tareas', vacio: tareas ? 'Sin tareas.' : sinPermiso,
          columnas: [{ clave: 'titulo', titulo: 'Tarea', ancho: 40 }, { clave: 'vence', titulo: 'Vence', ancho: 10 }, { clave: 'estado', titulo: 'Estado', ancho: 10 },
            { clave: 'prioridad', titulo: 'Prioridad', ancho: 9 }, { clave: 'evento', titulo: 'Evento', ancho: 31 }],
          filas: (tareas ?? []).map((t) => ({ titulo: t.titulo, vence: t.vence_el ? fmtFecha(String(t.vence_el), z) : '',
            estado: ({ pendiente: 'Pendiente', en_curso: 'En curso', hecha: 'Hecha' } as Record<string, string>)[String(t.estado)],
            prioridad: ({ baja: 'Baja', media: 'Media', alta: 'Alta' } as Record<string, string>)[String(t.prioridad)], evento: evento(t.reservas) })) },
        { titulo: 'Fechas cerradas', vacio: bloqueos ? 'Sin fechas cerradas.' : sinPermiso,
          columnas: [{ clave: 'espacio', titulo: 'Espacio' }, { clave: 'desde', titulo: 'Desde' }, { clave: 'hasta', titulo: 'Hasta' }, { clave: 'motivo', titulo: 'Motivo' }],
          filas: (bloqueos ?? []).map((b) => ({ espacio: nombre(b.espacios), desde: fmtFechaHora(String(b.inicio), z), hasta: fmtFechaHora(String(b.fin), z),
            motivo: [TIPOS_BLOQUEO[String(b.tipo)], b.motivo].filter(Boolean).join(': ') })) },
      ],
    })
    exito('Informe descargado.')
  } catch (e) {
    notificarError(e)
  } finally {
    exportando.value = false
  }
}

// --- Datos de ejemplo ---------------------------------------------------------
async function cargarEjemplos() {
  try {
    await api.post(rutaOrg(org.id, 'ejemplos'))
    await org.cargarSedes()
    acciones.cambiosGuardados()
    exito('Datos de ejemplo cargados.')
  } catch (e) { notificarError(e) }
}
async function borrarEjemplos() {
  if (!(await confirmar({ titulo: 'Borrar datos de ejemplo', peligro: true, confirmar: 'Borrar',
    mensaje: 'Se eliminan solo los registros marcados como ejemplo. Tus datos reales no se tocan.' }))) return
  try {
    await api.delete(rutaOrg(org.id, 'ejemplos'))
    await org.cargarSedes()
    acciones.cambiosGuardados()
    exito('Datos de ejemplo eliminados.')
  } catch (e) { notificarError(e) }
}

// --- Baja ---------------------------------------------------------------------
async function solicitarBaja() {
  const nombre = org.actual?.nombre ?? ''
  if (!(await confirmar({
    titulo: 'Dar de baja la cuenta', peligro: true, confirmar: 'Solicitar baja', textoRequerido: nombre,
    mensaje: 'Durante 30 días vas a poder seguir usando la cuenta, exportar tus datos y cancelar la baja. Pasado ese plazo se eliminan definitivamente todos los datos de la organización, para todos sus usuarios.',
  }))) return
  try {
    await api.post(rutaOrg(org.id, 'baja'), { confirmacion: nombre })
    await org.refrescarActual()
    exito('Baja solicitada. Descargá tus datos antes de que venza el plazo.')
  } catch (e) { notificarError(e) }
}
async function cancelarBaja() {
  try {
    await api.delete(rutaOrg(org.id, 'baja'))
    await org.refrescarActual()
    exito('Baja cancelada. La cuenta sigue activa.')
  } catch (e) { notificarError(e) }
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <!-- Importar -->
    <section class="tarjeta p-5 lg:col-span-2">
      <h2 class="flex items-center gap-2 font-semibold"><Upload class="size-4 text-marca-600" /> Importar desde planilla (CSV)</h2>
      <p v-if="!org.puede('datos.importar')" class="mt-2 text-sm text-slate-600">Tu rol no permite importar datos.</p>
      <div v-else class="mt-3 space-y-3">
        <p class="text-sm text-slate-600">Exportá tu planilla de Excel o Google Sheets como CSV. La primera fila debe tener los nombres de columna.
          Las fechas van en formato DD/MM/AAAA y los montos como “1.500.000,50”. Las reservas que choquen con otra se informan y no se cargan.</p>
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="tipo" class="entrada w-auto" aria-label="Qué importar" @change="filas = []; archivo = ''; resultado = null">
            <option value="clientes">Clientes</option><option value="reservas">Reservas</option>
          </select>
          <button class="btn-fantasma" @click="descargarPlantilla"><FileSpreadsheet class="size-4" /> Descargar plantilla</button>
          <label class="btn-secundario cursor-pointer">
            <input type="file" accept=".csv,text/csv" class="sr-only" @change="alElegirArchivo" /> Elegir archivo
          </label>
          <span v-if="archivo" class="text-sm text-slate-500">{{ archivo }} · {{ filas.length }} filas</span>
        </div>
        <p class="text-xs text-slate-500">Columnas: {{ COLUMNAS[tipo].join(', ') }}.
          <template v-if="tipo === 'reservas'"> El espacio debe coincidir con el nombre de un espacio cargado. Los clientes que no existan se crean.</template>
          <template v-else> Los clientes con el mismo email o teléfono que uno existente se omiten.</template></p>
        <p v-if="faltantes.length" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Faltan columnas obligatorias: {{ faltantes.join(', ') }}.</p>
        <div v-if="filas.length && !faltantes.length" class="space-y-2">
          <div class="overflow-x-auto rounded-lg ring-1 ring-slate-200">
            <table class="tabla text-xs">
              <thead class="bg-slate-50"><tr><th>#</th><th v-for="c in COLUMNAS[tipo]" :key="c">{{ c }}</th></tr></thead>
              <tbody class="divide-y divide-slate-100"><tr v-for="(f, i) in filas.slice(0, 5)" :key="i"><td>{{ i + 1 }}</td><td v-for="c in COLUMNAS[tipo]" :key="c">{{ f[c] }}</td></tr></tbody>
            </table>
          </div>
          <button class="btn-primario" :disabled="importando" @click="importar">{{ importando ? 'Importando…' : `Importar ${filas.length} ${tipo}` }}</button>
        </div>
        <p v-if="errorImport" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorImport }}</p>
        <div v-if="resultado" class="rounded-lg bg-slate-50 p-3 text-sm" role="status">
          <p class="font-medium text-emerald-700">{{ resultado.importados }} importados<template v-if="resultado.duplicados"> · {{ resultado.duplicados }} duplicados omitidos</template>
            <template v-if="resultado.errores.length"> · <span class="text-rose-700">{{ resultado.errores.length }} con error</span></template></p>
          <ul v-if="resultado.errores.length" class="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs text-rose-700">
            <li v-for="e in resultado.errores" :key="e.fila">Fila {{ e.fila + 1 }}: {{ e.error }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Exportar -->
    <section class="tarjeta p-5">
      <h2 class="flex items-center gap-2 font-semibold"><Download class="size-4 text-marca-600" /> Informe completo en PDF</h2>
      <p class="mt-2 text-sm text-slate-600">Descarga un PDF con todos los datos de la organización: espacios, clientes, eventos, cuotas, cobros, gastos, tareas y fechas cerradas.
        En Eventos, Clientes y Finanzas podés exportar cada listado con sus filtros.</p>
      <button class="btn-secundario mt-3" :disabled="exportando || !org.puede('datos.exportar')" @click="exportarTodo">
        {{ exportando ? 'Generando PDF…' : 'Descargar informe PDF' }}</button>
      <p v-if="!org.puede('datos.exportar')" class="mt-1 text-xs text-slate-500">Tu rol no permite exportar datos.</p>
    </section>

    <!-- Ejemplos -->
    <section v-if="org.puede('sedes.gestionar')" class="tarjeta p-5">
      <h2 class="flex items-center gap-2 font-semibold"><Sparkles class="size-4 text-amber-500" /> Datos de ejemplo</h2>
      <p class="mt-2 text-sm text-slate-600">Cargá reservas, clientes y cobros ficticios (marcados como ejemplo) para probar Festy. Se borran sin afectar tus datos.</p>
      <div class="mt-3 flex gap-2"><button class="btn-secundario" @click="cargarEjemplos">Cargar ejemplos</button>
        <button class="btn-fantasma text-rose-600" @click="borrarEjemplos">Borrar ejemplos</button></div>
    </section>

    <!-- Baja -->
    <section v-if="org.puede('organizacion.eliminar')" class="tarjeta p-5 ring-rose-200 lg:col-span-2">
      <h2 class="flex items-center gap-2 font-semibold text-rose-700"><TriangleAlert class="size-4" /> Baja de la cuenta</h2>
      <template v-if="org.actual?.estado === 'baja_solicitada'">
        <p class="mt-2 text-sm text-slate-600">Solicitaste la baja el {{ fmtFecha(org.actual.baja_solicitada_at, org.zona) }}. Los datos se eliminarán 30 días después.</p>
        <button class="btn-primario mt-3" @click="cancelarBaja">Cancelar la baja</button>
      </template>
      <template v-else>
        <p class="mt-2 text-sm text-slate-600">Elimina la organización y todos sus datos para todos los usuarios, 30 días después de solicitarla. Antes, exportá tus datos.</p>
        <button class="btn-peligro mt-3" @click="solicitarBaja">Solicitar baja</button>
      </template>
    </section>
  </div>
</template>
