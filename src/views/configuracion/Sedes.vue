<script setup lang="ts">
// Salones (el lugar físico, con su dirección) y los espacios que se reservan en
// cada uno. La marca no se muestra: el alta usa la de la empresa. Lo técnico
// (tiempos, horarios, garantía) queda en "Más opciones" y el inventario es opcional.
import { computed, reactive, ref } from 'vue'
import { Building2, ChevronDown, MapPin, Package, Pencil, Plus, Power, Trash2, Users } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import CampoHora from '@/components/ui/CampoHora.vue'
import Ayuda from '@/components/ui/Ayuda.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import type { Fila } from '@/lib/supabase'
import { activar, api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { fmtMoneda } from '@/lib/formato'
import { traducirError } from '@/lib/errores'
import { CATEGORIAS_RECURSO, DIAS_SEMANA, TIPOS_ESPACIO } from '@/lib/catalogos'
import { useOrganizacion, type Espacio, type Sucursal } from '@/stores/organizacion'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

const org = useOrganizacion()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()
const puede = computed(() => org.puede('sedes.gestionar'))
const errorForm = ref('')
const guardando = ref(false)
const variasMarcas = computed(() => org.salones.length > 1)
const nombreMarca = (id: string) => org.salones.find((s) => s.id === id)?.nombre ?? ''
const espaciosDe = (sucursalId: string) => org.espacios.filter((e) => e.sucursal_id === sucursalId)
const direccion = (s: Sucursal) => [s.direccion, s.localidad, s.provincia].filter(Boolean).join(', ')

async function ejecutar(fn: () => Promise<void>, mensaje: string, cerrar: () => void) {
  errorForm.value = ''
  guardando.value = true
  try {
    await fn()
    await org.cargarSedes()
    exito(mensaje)
    cerrar()
  } catch (e) {
    errorForm.value = traducirError(e)
  } finally {
    guardando.value = false
  }
}

// --- Salón (lugar físico) --------------------------------------------------------
const salonAbierto = ref(false)
const salonSel = ref<Sucursal | null>(null)
const fSalon = reactive({ nombre: '', direccion: '', localidad: '', provincia: '', telefono: '', capacidad_maxima: null as number | null, salon_id: '' })
function abrirSalon(s: Sucursal | null = null) {
  salonSel.value = s
  Object.assign(fSalon, { nombre: s?.nombre ?? '', direccion: s?.direccion ?? '', localidad: s?.localidad ?? '', provincia: s?.provincia ?? '',
    telefono: s?.telefono ?? '', capacidad_maxima: null, salon_id: s?.salon_id ?? '' })
  errorForm.value = ''
  salonAbierto.value = true
}
function guardarSalon() {
  if (fSalon.nombre.trim().length < 2) { errorForm.value = 'Ingresá el nombre del salón.'; return }
  const datos = { nombre: fSalon.nombre.trim(), direccion: fSalon.direccion.trim() || null, localidad: fSalon.localidad.trim() || null,
    provincia: fSalon.provincia.trim() || null, telefono: fSalon.telefono.trim() || null }
  if (!salonSel.value && (!fSalon.capacidad_maxima || fSalon.capacidad_maxima < 1)) { errorForm.value = 'Indicá para cuántas personas es.'; return }
  void ejecutar(async () => {
    if (salonSel.value) await api.put(rutaOrg(org.id, `sucursales/${salonSel.value.id}`), { ...datos, salon_id: fSalon.salon_id })
    else await api.post(rutaOrg(org.id, 'salones/nuevo'), { ...datos, capacidad_maxima: fSalon.capacidad_maxima })
  }, salonSel.value ? 'Salón guardado.' : 'Salón creado. Ya podés reservarlo.', () => { salonAbierto.value = false })
}

// --- Espacios ----------------------------------------------------------------------
interface HorarioDia { abierto: boolean; desde: string; hasta: string }
const espAbierto = ref(false)
const espSel = ref<Espacio | null>(null)
const masOpciones = ref(false)
const fEsp = reactive({
  sucursal_id: '', nombre: '', tipo: 'salon', descripcion: '', capacidad_maxima: null as number | null, capacidad_minima: null as number | null,
  garantia_sugerida: null as number | null, color: '#7c3aed',
  preparacion_min: 0, montaje_min: 60, desmontaje_min: 60, limpieza_min: 60, duracion_minima_min: 60, duracion_sugerida_min: 300,
  horarios: [] as HorarioDia[],
})
async function abrirEspacio(sucursalId: string, e: Espacio | null = null) {
  espSel.value = e
  masOpciones.value = false
  Object.assign(fEsp, e ? {
    sucursal_id: e.sucursal_id, nombre: e.nombre, tipo: e.tipo, descripcion: e.descripcion ?? '', capacidad_maxima: e.capacidad_maxima, capacidad_minima: e.capacidad_minima,
    garantia_sugerida: Number(e.garantia_sugerida) || null, color: e.color,
    preparacion_min: e.preparacion_min, montaje_min: e.montaje_min, desmontaje_min: e.desmontaje_min, limpieza_min: e.limpieza_min,
    duracion_minima_min: e.duracion_minima_min, duracion_sugerida_min: e.duracion_sugerida_min,
  } : { sucursal_id: sucursalId, nombre: '', tipo: 'quincho', descripcion: '', capacidad_maxima: null, capacidad_minima: null, garantia_sugerida: null, color: '#0ea5e9',
    preparacion_min: 0, montaje_min: 60, desmontaje_min: 60, limpieza_min: 60, duracion_minima_min: 60, duracion_sugerida_min: 300 })
  fEsp.horarios = DIAS_SEMANA.map(() => ({ abierto: false, desde: '10:00', hasta: '04:00' }))
  if (e) {
    const data = await api.get<Fila<'espacio_horarios'>[]>(`/espacios/${e.id}/horarios`)
    for (const h of data) fEsp.horarios[h.dia_semana] = { abierto: true, desde: h.hora_desde.slice(0, 5), hasta: h.hora_hasta.slice(0, 5) }
  }
  errorForm.value = ''
  espAbierto.value = true
}
function guardarEspacio() {
  if (fEsp.nombre.trim().length < 2) { errorForm.value = 'Ingresá un nombre (ej.: Quincho, Jardín).'; return }
  if (!fEsp.capacidad_maxima || fEsp.capacidad_maxima < 1) { errorForm.value = 'Indicá para cuántas personas es.'; return }
  if (fEsp.capacidad_minima && fEsp.capacidad_minima > fEsp.capacidad_maxima) { masOpciones.value = true; errorForm.value = 'El mínimo de invitados no puede superar la capacidad.'; return }
  const { horarios, ...resto } = fEsp
  const datos = { ...resto, nombre: resto.nombre.trim(), descripcion: resto.descripcion.trim() || null, capacidad_maxima: resto.capacidad_maxima!,
    capacidad_minima: resto.capacidad_minima || null, garantia_sugerida: resto.garantia_sugerida ?? 0 }
  void ejecutar(async () => {
    const cuerpo = {
      datos,
      horarios: horarios.map((h, dia) => ({ ...h, dia })).filter((h) => h.abierto).map((h) => ({ dia_semana: h.dia, hora_desde: h.desde, hora_hasta: h.hasta })),
    }
    if (espSel.value) await api.put(rutaOrg(org.id, `espacios/${espSel.value.id}`), cuerpo)
    else await api.post(rutaOrg(org.id, 'espacios'), cuerpo)
  }, 'Espacio guardado.', () => { espAbierto.value = false })
}
function copiarHorarioATodos() {
  const base = fEsp.horarios.find((h) => h.abierto)
  if (base) fEsp.horarios = fEsp.horarios.map(() => ({ ...base }))
}

async function alternarActivo(tabla: 'sucursales' | 'espacios', fila: { id: string; activo: boolean; nombre: string }) {
  if (fila.activo && !(await confirmar({ titulo: 'Desactivar', mensaje: `“${fila.nombre}” dejará de aparecer para nuevas reservas. Las reservas existentes se mantienen.`, confirmar: 'Desactivar' }))) return
  try {
    await activar(tabla, fila.id, !fila.activo)
    await org.cargarSedes()
  } catch (e) { notificarError(e) }
}
async function eliminar(tabla: 'sucursales' | 'espacios', fila: { id: string; nombre: string }) {
  if (!(await confirmar({ titulo: 'Eliminar', peligro: true, confirmar: 'Eliminar',
    mensaje: `Se elimina “${fila.nombre}”${tabla === 'sucursales' ? ' con sus espacios' : ''}. Si tiene reservas no se puede eliminar: desactivalo.` }))) return
  try {
    await eliminarRegistro(tabla, fila.id)
    await org.cargarSedes()
    exito('Eliminado.')
  } catch (e) { notificarError(e) }
}

// --- Inventario (opcional) ---------------------------------------------------------
const recursos = ref<Fila<'recursos'>[]>([])
const recAbierto = ref(false)
const recSel = ref<Fila<'recursos'> | null>(null)
const fRec = reactive({ sucursal_id: '', nombre: '', categoria: 'mobiliario', cantidad: 1, notas: '' })
async function cargarRecursos() {
  recursos.value = await api.get<Fila<'recursos'>[]>(rutaOrg(org.id, 'recursos')).catch(() => [])
}
void cargarRecursos()
const recursosDe = (sucursalId: string) => recursos.value.filter((r) => r.sucursal_id === sucursalId)
function abrirRecurso(sucursalId: string, r: Fila<'recursos'> | null = null) {
  recSel.value = r
  Object.assign(fRec, r ? { sucursal_id: r.sucursal_id, nombre: r.nombre, categoria: r.categoria, cantidad: r.cantidad, notas: r.notas ?? '' } : { sucursal_id: sucursalId, nombre: '', categoria: 'mobiliario', cantidad: 1, notas: '' })
  errorForm.value = ''
  recAbierto.value = true
}
function guardarRecurso() {
  if (fRec.nombre.trim().length < 2) { errorForm.value = 'Ingresá un nombre.'; return }
  const datos = { ...fRec, nombre: fRec.nombre.trim(), notas: fRec.notas.trim() || null }
  void ejecutar(async () => {
    if (recSel.value) await api.put(rutaOrg(org.id, `recursos/${recSel.value.id}`), datos)
    else await api.post(rutaOrg(org.id, 'recursos'), datos)
    await cargarRecursos()
  }, 'Guardado en el inventario.', () => { recAbierto.value = false })
}
async function borrarRecurso(r: Fila<'recursos'>) {
  if (!(await confirmar({ titulo: 'Quitar del inventario', mensaje: `¿Quitar “${r.nombre}”?`, confirmar: 'Quitar', peligro: true }))) return
  try {
    await eliminarRegistro('recursos', r.id)
    await cargarRecursos()
  } catch (e) { notificarError(e) }
}

const capacidad = (e: Espacio) => (e.capacidad_minima ? `${e.capacidad_minima} a ${e.capacidad_maxima}` : `hasta ${e.capacidad_maxima}`)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-slate-600">Tus salones y lo que se reserva en cada uno.
        <Ayuda texto="Salón: el lugar, con su dirección. Si tiene varios ambientes que se alquilan por separado (quincho, jardín, salón chico), agregalos como espacios." /></p>
      <button v-if="puede && org.sucursales.length" class="btn-primario" @click="abrirSalon()"><Plus class="size-4" /> Nuevo salón</button>
    </div>

    <EstadoVacio v-if="!org.sucursales.length" :icono="Building2" titulo="Todavía no cargaste tu salón" descripcion="Con el nombre, la dirección y la capacidad ya podés empezar a reservar.">
      <button v-if="puede" class="btn-primario" @click="abrirSalon()"><Plus class="size-4" /> Cargar mi salón</button>
    </EstadoVacio>

    <div class="grid gap-4 xl:grid-cols-2">
      <section v-for="su in org.sucursales" :key="su.id" :class="['tarjeta flex flex-col', !su.activo && 'opacity-60']">
        <header class="flex flex-wrap items-start justify-between gap-2 p-4">
          <div class="min-w-0">
            <h2 class="flex flex-wrap items-center gap-2 text-lg font-semibold"><Building2 class="size-5 text-marca-600" /> {{ su.nombre }}
              <span v-if="su.es_ejemplo" class="rounded bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700">ejemplo</span>
              <span v-if="!su.activo" class="rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">inactivo</span></h2>
            <p class="mt-0.5 flex items-center gap-1 text-sm text-slate-500"><MapPin class="size-3.5 shrink-0" /> {{ direccion(su) || 'Sin dirección' }}
              <template v-if="variasMarcas"> · {{ nombreMarca(su.salon_id) }}</template></p>
          </div>
          <div v-if="puede" class="flex">
            <button class="btn-fantasma p-1.5" :aria-label="`Editar ${su.nombre}`" @click="abrirSalon(su)"><Pencil class="size-4" /></button>
            <button class="btn-fantasma p-1.5" :aria-label="su.activo ? `Desactivar ${su.nombre}` : `Activar ${su.nombre}`" @click="alternarActivo('sucursales', su)"><Power class="size-4" /></button>
            <button class="btn-fantasma p-1.5 text-rose-600" :aria-label="`Eliminar ${su.nombre}`" @click="eliminar('sucursales', su)"><Trash2 class="size-4" /></button>
          </div>
        </header>

        <div class="flex-1 px-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Se reserva</p>
          <ul class="mt-2 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
            <li v-for="e in espaciosDe(su.id)" :key="e.id" :class="['flex items-center gap-3 px-3 py-2', !e.activo && 'opacity-60']">
              <span class="size-2.5 shrink-0 rounded-full" :style="{ background: e.color }" />
              <span class="min-w-0 flex-1"><span class="text-sm font-medium">{{ e.nombre }}</span>
                <span class="block text-xs text-slate-500"><Users class="mr-0.5 inline size-3" />{{ capacidad(e) }} personas
                  <template v-if="Number(e.garantia_sugerida) > 0"> · garantía {{ fmtMoneda(e.garantia_sugerida, true) }}</template><template v-if="!e.activo"> · inactivo</template></span></span>
              <span v-if="puede" class="flex">
                <button class="btn-fantasma p-1" :aria-label="`Editar ${e.nombre}`" @click="abrirEspacio(su.id, e)"><Pencil class="size-3.5" /></button>
                <button class="btn-fantasma p-1" :aria-label="e.activo ? `Desactivar ${e.nombre}` : `Activar ${e.nombre}`" @click="alternarActivo('espacios', e)"><Power class="size-3.5" /></button>
                <button v-if="espaciosDe(su.id).length > 1" class="btn-fantasma p-1 text-rose-600" :aria-label="`Eliminar ${e.nombre}`" @click="eliminar('espacios', e)"><Trash2 class="size-3.5" /></button>
              </span>
            </li>
            <li v-if="!espaciosDe(su.id).length" class="px-3 py-2 text-sm text-slate-500">Agregá qué se reserva en este salón.</li>
          </ul>
          <button v-if="puede" class="enlace mt-2 inline-flex items-center gap-1 text-sm" @click="abrirEspacio(su.id)"><Plus class="size-3.5" /> Agregar otro espacio (quincho, jardín…)</button>
        </div>

        <details class="group mt-3 border-t border-slate-100 px-4 py-3">
          <summary class="flex cursor-pointer list-none items-center gap-2 text-sm text-slate-600">
            <Package class="size-4" /> Inventario <span class="text-slate-400">(opcional{{ recursosDe(su.id).length ? ` · ${recursosDe(su.id).length}` : '' }})</span>
            <ChevronDown class="ml-auto size-4 transition group-open:rotate-180" /></summary>
          <ul v-if="recursosDe(su.id).length" class="mt-2 flex flex-wrap gap-2">
            <li v-for="r in recursosDe(su.id)" :key="r.id" class="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs">
              {{ r.nombre }} × {{ r.cantidad }} <span class="text-slate-400">({{ CATEGORIAS_RECURSO[r.categoria] }})</span>
              <template v-if="puede">
                <button class="rounded-full p-0.5 hover:bg-slate-200" :aria-label="`Editar ${r.nombre}`" @click="abrirRecurso(su.id, r)"><Pencil class="size-3" /></button>
                <button class="rounded-full p-0.5 text-rose-600 hover:bg-slate-200" :aria-label="`Quitar ${r.nombre}`" @click="borrarRecurso(r)"><Trash2 class="size-3" /></button>
              </template>
            </li>
          </ul>
          <p v-else class="mt-2 text-xs text-slate-500">Mesas, sillas, vajilla, equipos… solo si querés llevar la cuenta.</p>
          <button v-if="puede" class="enlace mt-2 text-sm" @click="abrirRecurso(su.id)">+ Agregar al inventario</button>
        </details>
      </section>
    </div>

    <!-- Salón -->
    <Modal v-model="salonAbierto" :titulo="salonSel ? 'Editar salón' : 'Nuevo salón'">
      <form id="f-salon" class="grid gap-3 sm:grid-cols-2" @submit.prevent="guardarSalon">
        <Campo etiqueta="Nombre del salón" para="s-nombre" requerido class="sm:col-span-2"><input id="s-nombre" v-model="fSalon.nombre" class="entrada" placeholder="Ej.: Quinta Los Álamos" /></Campo>
        <Campo v-if="!salonSel" etiqueta="¿Para cuántas personas?" para="s-cap" requerido ayuda="Capacidad máxima.">
          <input id="s-cap" v-model.number="fSalon.capacidad_maxima" type="number" min="1" class="entrada" placeholder="Ej.: 150" /></Campo>
        <Campo etiqueta="Teléfono" para="s-tel" :class="salonSel && 'sm:col-span-2'"><input id="s-tel" v-model="fSalon.telefono" type="tel" class="entrada" /></Campo>
        <Campo etiqueta="Dirección" para="s-dir" class="sm:col-span-2"><input id="s-dir" v-model="fSalon.direccion" class="entrada" placeholder="Calle y número" /></Campo>
        <Campo etiqueta="Localidad" para="s-loc"><input id="s-loc" v-model="fSalon.localidad" class="entrada" /></Campo>
        <Campo etiqueta="Provincia" para="s-prov"><input id="s-prov" v-model="fSalon.provincia" class="entrada" /></Campo>
        <Campo v-if="salonSel && variasMarcas" etiqueta="Marca" para="s-marca" class="sm:col-span-2">
          <select id="s-marca" v-model="fSalon.salon_id" class="entrada"><option v-for="m in org.salones" :key="m.id" :value="m.id">{{ m.nombre }}</option></select></Campo>
        <p v-if="!salonSel" class="text-xs text-slate-500 sm:col-span-2">Si el salón tiene varios ambientes que se alquilan por separado, después agregás cada uno como espacio.</p>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ errorForm }}</p>
      </form>
      <template #pie><button class="btn-secundario" @click="salonAbierto = false">Cancelar</button>
        <button type="submit" form="f-salon" class="btn-primario" :disabled="guardando">{{ salonSel ? 'Guardar' : 'Crear salón' }}</button></template>
    </Modal>

    <!-- Espacio -->
    <Modal v-model="espAbierto" :titulo="espSel ? 'Editar espacio' : 'Agregar espacio'">
      <form id="f-esp" class="space-y-4" @submit.prevent="guardarEspacio">
        <div class="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre" para="e-nombre" requerido><input id="e-nombre" v-model="fEsp.nombre" class="entrada" placeholder="Ej.: Quincho" /></Campo>
          <Campo etiqueta="¿Para cuántas personas?" para="e-cap" requerido><input id="e-cap" v-model.number="fEsp.capacidad_maxima" type="number" min="1" class="entrada" /></Campo>
          <Campo etiqueta="Tipo" para="e-tipo"><select id="e-tipo" v-model="fEsp.tipo" class="entrada"><option v-for="(t, k) in TIPOS_ESPACIO" :key="k" :value="k">{{ t }}</option></select></Campo>
          <Campo etiqueta="Color en la agenda" para="e-color"><input id="e-color" v-model="fEsp.color" type="color" class="h-9 w-full cursor-pointer rounded-lg ring-1 ring-slate-300" /></Campo>
        </div>
        <div>
          <button type="button" class="inline-flex items-center gap-1 text-sm font-medium text-marca-700" :aria-expanded="masOpciones" @click="masOpciones = !masOpciones">
            <ChevronDown :class="['size-4 transition', masOpciones && 'rotate-180']" /> Más opciones</button>
          <p v-if="!masOpciones" class="ml-5 text-xs text-slate-500">Mínimo de invitados, garantía, armado y limpieza, horarios.</p>
        </div>
        <div v-show="masOpciones" class="space-y-4">
          <div class="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Mínimo de invitados" para="e-capmin" ayuda="Se avisa si una reserva tiene menos."><input id="e-capmin" v-model.number="fEsp.capacidad_minima" type="number" min="1" class="entrada" placeholder="Sin mínimo" /></Campo>
            <Campo etiqueta="Garantía sugerida" para="e-gar" ayuda="Depósito reintegrable que se propone."><CampoMoneda id="e-gar" v-model="fEsp.garantia_sugerida" placeholder="Sin garantía" /></Campo>
            <Campo etiqueta="Duración mínima (min)" para="e-dmin"><input id="e-dmin" v-model.number="fEsp.duracion_minima_min" type="number" min="15" step="15" class="entrada" /></Campo>
          </div>
          <fieldset class="rounded-lg bg-slate-50 p-3">
            <legend class="px-1 text-sm font-medium text-slate-700">Armado y limpieza (minutos) <Ayuda texto="Se suman antes y después de cada evento: el espacio queda ocupado durante ese tiempo." /></legend>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Campo etiqueta="Preparación" para="e-prep"><input id="e-prep" v-model.number="fEsp.preparacion_min" type="number" min="0" step="15" class="entrada" /></Campo>
              <Campo etiqueta="Montaje" para="e-mont"><input id="e-mont" v-model.number="fEsp.montaje_min" type="number" min="0" step="15" class="entrada" /></Campo>
              <Campo etiqueta="Desmontaje" para="e-desm"><input id="e-desm" v-model.number="fEsp.desmontaje_min" type="number" min="0" step="15" class="entrada" /></Campo>
              <Campo etiqueta="Limpieza" para="e-limp"><input id="e-limp" v-model.number="fEsp.limpieza_min" type="number" min="0" step="15" class="entrada" /></Campo>
            </div>
          </fieldset>
          <fieldset>
            <legend class="flex w-full items-center justify-between text-sm font-medium text-slate-700">
              <span>Horario de atención <Ayuda texto="Sin días marcados = sin restricción. Si la hora de cierre es anterior a la de apertura, pasa la medianoche. Fuera de horario se avisa, no se impide." /></span>
              <button type="button" class="enlace text-xs" @click="copiarHorarioATodos">Copiar el primero a todos</button>
            </legend>
            <ul class="mt-2 space-y-1.5">
              <li v-for="(h, dia) in fEsp.horarios" :key="dia" class="grid grid-cols-[7rem_1fr_1fr] items-center gap-2 text-sm">
                <label class="flex items-center gap-2"><input v-model="h.abierto" type="checkbox" class="rounded border-slate-300 text-marca-600" /> {{ DIAS_SEMANA[dia] }}</label>
                <CampoHora v-model="h.desde" :deshabilitado="!h.abierto" :aria-label="`${DIAS_SEMANA[dia]} desde`" />
                <CampoHora v-model="h.hasta" :deshabilitado="!h.abierto" :aria-label="`${DIAS_SEMANA[dia]} hasta`" />
              </li>
            </ul>
          </fieldset>
        </div>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorForm }}</p>
      </form>
      <template #pie><button class="btn-secundario" @click="espAbierto = false">Cancelar</button>
        <button type="submit" form="f-esp" class="btn-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button></template>
    </Modal>

    <!-- Inventario -->
    <Modal v-model="recAbierto" :titulo="recSel ? 'Editar' : 'Agregar al inventario'" ancho="sm">
      <form id="f-rec" class="space-y-3" @submit.prevent="guardarRecurso">
        <Campo etiqueta="Qué es" para="r-nombre" requerido><input id="r-nombre" v-model="fRec.nombre" class="entrada" placeholder="Ej.: Mesas redondas" /></Campo>
        <div class="grid grid-cols-2 gap-3">
          <Campo etiqueta="Categoría" para="r-cat"><select id="r-cat" v-model="fRec.categoria" class="entrada"><option v-for="(c, k) in CATEGORIAS_RECURSO" :key="k" :value="k">{{ c }}</option></select></Campo>
          <Campo etiqueta="Cantidad" para="r-cant"><input id="r-cant" v-model.number="fRec.cantidad" type="number" min="0" class="entrada" /></Campo>
        </div>
        <Campo etiqueta="Notas" para="r-notas"><input id="r-notas" v-model="fRec.notas" class="entrada" /></Campo>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorForm }}</p>
      </form>
      <template #pie><button class="btn-secundario" @click="recAbierto = false">Cancelar</button>
        <button type="submit" form="f-rec" class="btn-primario" :disabled="guardando">Guardar</button></template>
    </Modal>
  </div>
</template>
