<script setup lang="ts">
// Salones (marcas) → sedes (sucursales) → espacios, con horarios y recursos.
import { computed, reactive, ref } from 'vue'
import { Building2, Clock, MapPin, Pencil, Plus, Power, Trash2 } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import CampoHora from '@/components/ui/CampoHora.vue'
import Ayuda from '@/components/ui/Ayuda.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import type { Fila } from '@/lib/supabase'
import { activar, api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { fmtMoneda } from '@/lib/formato'
import { esLimitePlan, traducirError } from '@/lib/errores'
import { CATEGORIAS_RECURSO, DIAS_SEMANA, TIPOS_ESPACIO } from '@/lib/catalogos'
import { useOrganizacion, type Espacio, type Salon, type Sucursal } from '@/stores/organizacion'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

const org = useOrganizacion()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()
const puede = computed(() => org.puede('sedes.gestionar'))
const errorForm = ref('')
const limitePlan = ref(false)
const guardando = ref(false)

async function ejecutar(fn: () => Promise<void>, mensaje: string, cerrar: () => void) {
  errorForm.value = ''
  limitePlan.value = false
  guardando.value = true
  try {
    await fn()
    await org.cargarSedes()
    exito(mensaje)
    cerrar()
  } catch (e) {
    errorForm.value = traducirError(e)
    limitePlan.value = esLimitePlan(e)
  } finally {
    guardando.value = false
  }
}

// --- Salones ---------------------------------------------------------------
const salonAbierto = ref(false)
const salonSel = ref<Salon | null>(null)
const fSalon = reactive({ nombre: '', descripcion: '' })
function abrirSalon(s: Salon | null = null) {
  salonSel.value = s
  Object.assign(fSalon, { nombre: s?.nombre ?? '', descripcion: s?.descripcion ?? '' })
  errorForm.value = ''
  salonAbierto.value = true
}
function guardarSalon() {
  if (fSalon.nombre.trim().length < 2) { errorForm.value = 'Ingresá un nombre.'; return }
  const datos = { nombre: fSalon.nombre.trim(), descripcion: fSalon.descripcion.trim() || null }
  void ejecutar(async () => {
    if (salonSel.value) await api.put(rutaOrg(org.id, `salones/${salonSel.value.id}`), datos)
    else await api.post(rutaOrg(org.id, 'salones'), datos)
  }, 'Salón guardado.', () => { salonAbierto.value = false })
}

// --- Sucursales --------------------------------------------------------------
const sucAbierta = ref(false)
const sucSel = ref<Sucursal | null>(null)
const fSuc = reactive({ salon_id: '', nombre: '', direccion: '', localidad: '', provincia: '', telefono: '' })
function abrirSucursal(salonId: string, s: Sucursal | null = null) {
  sucSel.value = s
  Object.assign(fSuc, { salon_id: s?.salon_id ?? salonId, nombre: s?.nombre ?? '', direccion: s?.direccion ?? '', localidad: s?.localidad ?? '', provincia: s?.provincia ?? '', telefono: s?.telefono ?? '' })
  errorForm.value = ''
  sucAbierta.value = true
}
function guardarSucursal() {
  if (fSuc.nombre.trim().length < 2) { errorForm.value = 'Ingresá un nombre.'; return }
  const datos = { salon_id: fSuc.salon_id, nombre: fSuc.nombre.trim(), direccion: fSuc.direccion.trim() || null, localidad: fSuc.localidad.trim() || null, provincia: fSuc.provincia.trim() || null, telefono: fSuc.telefono.trim() || null }
  void ejecutar(async () => {
    if (sucSel.value) await api.put(rutaOrg(org.id, `sucursales/${sucSel.value.id}`), datos)
    else await api.post(rutaOrg(org.id, 'sucursales'), datos)
  }, 'Sede guardada.', () => { sucAbierta.value = false })
}

// --- Espacios ----------------------------------------------------------------
interface HorarioDia { abierto: boolean; desde: string; hasta: string }
const espAbierto = ref(false)
const espSel = ref<Espacio | null>(null)
const fEsp = reactive({
  sucursal_id: '', nombre: '', tipo: 'salon', descripcion: '', capacidad_maxima: 100 as number | null, capacidad_minima: null as number | null,
  garantia_sugerida: null as number | null, color: '#7c3aed',
  preparacion_min: 0, montaje_min: 60, desmontaje_min: 60, limpieza_min: 60, duracion_minima_min: 60, duracion_sugerida_min: 300,
  horarios: [] as HorarioDia[],
})
async function abrirEspacio(sucursalId: string, e: Espacio | null = null) {
  espSel.value = e
  Object.assign(fEsp, e ? {
    sucursal_id: e.sucursal_id, nombre: e.nombre, tipo: e.tipo, descripcion: e.descripcion ?? '', capacidad_maxima: e.capacidad_maxima, capacidad_minima: e.capacidad_minima,
    garantia_sugerida: Number(e.garantia_sugerida) || null, color: e.color,
    preparacion_min: e.preparacion_min, montaje_min: e.montaje_min, desmontaje_min: e.desmontaje_min, limpieza_min: e.limpieza_min,
    duracion_minima_min: e.duracion_minima_min, duracion_sugerida_min: e.duracion_sugerida_min,
  } : { sucursal_id: sucursalId, nombre: '', tipo: 'salon', descripcion: '', capacidad_maxima: 100, capacidad_minima: null, garantia_sugerida: null, color: '#7c3aed', preparacion_min: 0, montaje_min: 60, desmontaje_min: 60, limpieza_min: 60, duracion_minima_min: 60, duracion_sugerida_min: 300 })
  fEsp.horarios = DIAS_SEMANA.map(() => ({ abierto: false, desde: '10:00', hasta: '04:00' }))
  if (e) {
    const data = await api.get<Fila<'espacio_horarios'>[]>(`/espacios/${e.id}/horarios`)
    for (const h of data) fEsp.horarios[h.dia_semana] = { abierto: true, desde: h.hora_desde.slice(0, 5), hasta: h.hora_hasta.slice(0, 5) }
  }
  errorForm.value = ''
  espAbierto.value = true
}
function guardarEspacio() {
  if (fEsp.nombre.trim().length < 2) { errorForm.value = 'Ingresá un nombre.'; return }
  if (!fEsp.capacidad_maxima || fEsp.capacidad_maxima < 1) { errorForm.value = 'La capacidad debe ser mayor a 0.'; return }
  if (fEsp.capacidad_minima && fEsp.capacidad_minima > fEsp.capacidad_maxima) { errorForm.value = 'El mínimo de invitados no puede superar la capacidad máxima.'; return }
  const { horarios, ...resto } = fEsp
  const datos = { ...resto, nombre: resto.nombre.trim(), descripcion: resto.descripcion.trim() || null, capacidad_maxima: resto.capacidad_maxima!,
    capacidad_minima: resto.capacidad_minima || null, garantia_sugerida: resto.garantia_sugerida ?? 0 }
  void ejecutar(async () => {
    // Espacio y horarios en una sola transacción.
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
async function eliminar(tabla: 'salones' | 'sucursales' | 'espacios', fila: { id: string; nombre: string }) {
  if (!(await confirmar({ titulo: 'Eliminar', peligro: true, confirmar: 'Eliminar',
    mensaje: `Se elimina “${fila.nombre}” y todo lo que contiene. Si tiene reservas no se puede eliminar: desactivalo.` }))) return
  try {
    await eliminarRegistro(tabla, fila.id)
    await org.cargarSedes()
    exito('Eliminado.')
  } catch (e) { notificarError(e) }
}

// --- Recursos -----------------------------------------------------------------
const recursos = ref<Fila<'recursos'>[]>([])
const recAbierto = ref(false)
const recSel = ref<Fila<'recursos'> | null>(null)
const fRec = reactive({ sucursal_id: '', nombre: '', categoria: 'mobiliario', cantidad: 1, notas: '' })
async function cargarRecursos() {
  recursos.value = await api.get<Fila<'recursos'>[]>(rutaOrg(org.id, 'recursos')).catch(() => [])
}
void cargarRecursos()
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
  }, 'Recurso guardado.', () => { recAbierto.value = false })
}
async function borrarRecurso(r: Fila<'recursos'>) {
  if (!(await confirmar({ titulo: 'Eliminar recurso', mensaje: `¿Eliminar “${r.nombre}”?`, confirmar: 'Eliminar', peligro: true }))) return
  try {
    await eliminarRegistro('recursos', r.id)
    await cargarRecursos()
  } catch (e) { notificarError(e) }
}

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-slate-600">Organizá tus salones, sedes y los espacios que se reservan.
        <Ayuda texto="Salón: la marca o unidad de negocio. Sede: la dirección física. Espacio: lo que se reserva (salón principal, quincho, jardín…)." /></p>
      <button v-if="puede" class="btn-secundario" @click="abrirSalon()"><Plus class="size-4" /> Nuevo salón</button>
    </div>

    <EstadoVacio v-if="!org.salones.length" :icono="Building2" titulo="Todavía no cargaste ningún salón" descripcion="Empezá creando tu salón, después la sede y sus espacios.">
      <button v-if="puede" class="btn-primario" @click="abrirSalon()">Crear salón</button>
    </EstadoVacio>

    <section v-for="s in org.salones" :key="s.id" class="tarjeta">
      <header class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 class="flex items-center gap-2 font-semibold"><Building2 class="size-4 text-marca-600" /> {{ s.nombre }}
          <span v-if="s.es_ejemplo" class="rounded bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700">ejemplo</span></h2>
        <div v-if="puede" class="flex gap-1">
          <button class="btn-fantasma btn-chico" @click="abrirSucursal(s.id)"><Plus class="size-3.5" /> Sede</button>
          <button class="btn-fantasma p-1.5" aria-label="Editar salón" @click="abrirSalon(s)"><Pencil class="size-4" /></button>
          <button class="btn-fantasma p-1.5 text-rose-600" aria-label="Eliminar salón" @click="eliminar('salones', s)"><Trash2 class="size-4" /></button>
        </div>
      </header>
      <div v-for="su in org.sucursales.filter((x) => x.salon_id === s.id)" :key="su.id" :class="['border-b border-slate-100 p-4 last:border-b-0', !su.activo && 'opacity-60']">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 class="flex items-center gap-2 text-sm font-semibold"><MapPin class="size-4 text-slate-400" /> {{ su.nombre }}
              <span v-if="!su.activo" class="rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">inactiva</span></h3>
            <p class="text-xs text-slate-500">{{ [su.direccion, su.localidad, su.provincia].filter(Boolean).join(', ') || 'Sin dirección' }}</p>
          </div>
          <div v-if="puede" class="flex gap-1">
            <button class="btn-secundario btn-chico" @click="abrirEspacio(su.id)"><Plus class="size-3.5" /> Espacio</button>
            <button class="btn-fantasma btn-chico" @click="abrirRecurso(su.id)"><Plus class="size-3.5" /> Recurso</button>
            <button class="btn-fantasma p-1.5" aria-label="Editar sede" @click="abrirSucursal(s.id, su)"><Pencil class="size-4" /></button>
            <button class="btn-fantasma p-1.5" :aria-label="su.activo ? 'Desactivar sede' : 'Activar sede'" @click="alternarActivo('sucursales', su)"><Power class="size-4" /></button>
          </div>
        </div>
        <ul class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <li v-for="e in org.espacios.filter((x) => x.sucursal_id === su.id)" :key="e.id" :class="['rounded-lg p-3 ring-1 ring-slate-200', !e.activo && 'opacity-60']">
            <div class="flex items-start justify-between gap-2">
              <p class="flex items-center gap-2 text-sm font-medium"><span class="size-2.5 rounded-full" :style="{ background: e.color }" /> {{ e.nombre }}</p>
              <div v-if="puede" class="flex">
                <button class="btn-fantasma p-1" aria-label="Editar espacio" @click="abrirEspacio(su.id, e)"><Pencil class="size-3.5" /></button>
                <button class="btn-fantasma p-1" :aria-label="e.activo ? 'Desactivar espacio' : 'Activar espacio'" @click="alternarActivo('espacios', e)"><Power class="size-3.5" /></button>
                <button class="btn-fantasma p-1 text-rose-600" aria-label="Eliminar espacio" @click="eliminar('espacios', e)"><Trash2 class="size-3.5" /></button>
              </div>
            </div>
            <p class="mt-1 text-xs text-slate-500">{{ TIPOS_ESPACIO[e.tipo] }} · {{ e.capacidad_minima ? `${e.capacidad_minima} a ${e.capacidad_maxima}` : `hasta ${e.capacidad_maxima}` }} personas<template v-if="Number(e.garantia_sugerida) > 0"> · garantía {{ fmtMoneda(e.garantia_sugerida, true) }}</template><template v-if="!e.activo"> · inactivo</template></p>
            <p class="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Clock class="size-3" /> Antes {{ fmtMin(e.preparacion_min + e.montaje_min) }} · después {{ fmtMin(e.desmontaje_min + e.limpieza_min) }}</p>
          </li>
          <li v-if="!org.espacios.some((x) => x.sucursal_id === su.id)" class="text-sm text-slate-500">Sin espacios todavía.</li>
        </ul>
        <div v-if="recursos.some((r) => r.sucursal_id === su.id)" class="mt-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Recursos</p>
          <ul class="mt-1 flex flex-wrap gap-2">
            <li v-for="r in recursos.filter((x) => x.sucursal_id === su.id)" :key="r.id" class="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs">
              {{ r.nombre }} × {{ r.cantidad }} <span class="text-slate-400">({{ CATEGORIAS_RECURSO[r.categoria] }})</span>
              <template v-if="puede">
                <button class="rounded-full p-0.5 hover:bg-slate-200" aria-label="Editar recurso" @click="abrirRecurso(su.id, r)"><Pencil class="size-3" /></button>
                <button class="rounded-full p-0.5 text-rose-600 hover:bg-slate-200" aria-label="Eliminar recurso" @click="borrarRecurso(r)"><Trash2 class="size-3" /></button>
              </template>
            </li>
          </ul>
        </div>
      </div>
      <p v-if="!org.sucursales.some((x) => x.salon_id === s.id)" class="p-4 text-sm text-slate-500">Agregá la primera sede de este salón.</p>
    </section>

    <!-- Modales -->
    <Modal v-model="salonAbierto" :titulo="salonSel ? 'Editar salón' : 'Nuevo salón'" ancho="sm">
      <form id="f-salon" class="space-y-3" @submit.prevent="guardarSalon">
        <Campo etiqueta="Nombre" para="s-nombre" requerido><input id="s-nombre" v-model="fSalon.nombre" class="entrada" /></Campo>
        <Campo etiqueta="Descripción" para="s-desc"><textarea id="s-desc" v-model="fSalon.descripcion" rows="2" class="entrada" /></Campo>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorForm }}
          <RouterLink v-if="limitePlan" to="/configuracion/plan" class="enlace">Ver planes</RouterLink></p>
      </form>
      <template #pie><button class="btn-secundario" @click="salonAbierto = false">Cancelar</button>
        <button type="submit" form="f-salon" class="btn-primario" :disabled="guardando">Guardar</button></template>
    </Modal>

    <Modal v-model="sucAbierta" :titulo="sucSel ? 'Editar sede' : 'Nueva sede'">
      <form id="f-suc" class="grid gap-3 sm:grid-cols-2" @submit.prevent="guardarSucursal">
        <Campo etiqueta="Nombre" para="su-nombre" requerido class="sm:col-span-2"><input id="su-nombre" v-model="fSuc.nombre" class="entrada" placeholder="Ej.: Sede Centro" /></Campo>
        <Campo v-if="org.salones.length > 1" etiqueta="Salón" para="su-salon" class="sm:col-span-2">
          <select id="su-salon" v-model="fSuc.salon_id" class="entrada"><option v-for="s in org.salones" :key="s.id" :value="s.id">{{ s.nombre }}</option></select></Campo>
        <Campo etiqueta="Dirección" para="su-dir" class="sm:col-span-2"><input id="su-dir" v-model="fSuc.direccion" class="entrada" /></Campo>
        <Campo etiqueta="Localidad" para="su-loc"><input id="su-loc" v-model="fSuc.localidad" class="entrada" /></Campo>
        <Campo etiqueta="Provincia" para="su-prov"><input id="su-prov" v-model="fSuc.provincia" class="entrada" /></Campo>
        <Campo etiqueta="Teléfono" para="su-tel"><input id="su-tel" v-model="fSuc.telefono" type="tel" class="entrada" /></Campo>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ errorForm }}
          <RouterLink v-if="limitePlan" to="/configuracion/plan" class="enlace">Ver planes</RouterLink></p>
      </form>
      <template #pie><button class="btn-secundario" @click="sucAbierta = false">Cancelar</button>
        <button type="submit" form="f-suc" class="btn-primario" :disabled="guardando">Guardar</button></template>
    </Modal>

    <Modal v-model="espAbierto" :titulo="espSel ? 'Editar espacio' : 'Nuevo espacio'" ancho="lg">
      <form id="f-esp" class="space-y-4" @submit.prevent="guardarEspacio">
        <div class="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Nombre" para="e-nombre" requerido class="sm:col-span-2"><input id="e-nombre" v-model="fEsp.nombre" class="entrada" /></Campo>
          <Campo etiqueta="Color en el calendario" para="e-color"><input id="e-color" v-model="fEsp.color" type="color" class="h-9 w-full cursor-pointer rounded-lg ring-1 ring-slate-300" /></Campo>
          <Campo etiqueta="Tipo" para="e-tipo"><select id="e-tipo" v-model="fEsp.tipo" class="entrada"><option v-for="(t, k) in TIPOS_ESPACIO" :key="k" :value="k">{{ t }}</option></select></Campo>
          <Campo etiqueta="Capacidad máxima" para="e-cap" requerido><input id="e-cap" v-model.number="fEsp.capacidad_maxima" type="number" min="1" class="entrada" /></Campo>
          <Campo etiqueta="Mínimo de invitados" para="e-capmin" ayuda="Opcional. Se avisa si una reserva tiene menos."><input id="e-capmin" v-model.number="fEsp.capacidad_minima" type="number" min="1" class="entrada" placeholder="Sin mínimo" /></Campo>
          <Campo etiqueta="Garantía sugerida" para="e-gar" ayuda="Depósito reintegrable que se propone en presupuestos y eventos."><CampoMoneda id="e-gar" v-model="fEsp.garantia_sugerida" placeholder="Sin garantía" /></Campo>
          <Campo etiqueta="Duración mínima (min)" para="e-dmin"><input id="e-dmin" v-model.number="fEsp.duracion_minima_min" type="number" min="15" step="15" class="entrada" /></Campo>
        </div>
        <fieldset class="rounded-lg bg-slate-50 p-3">
          <legend class="px-1 text-sm font-medium text-slate-700">Tiempos operativos (minutos) <Ayuda texto="Se suman antes y después de cada evento: el espacio queda ocupado durante ese tiempo y no se puede reservar." /></legend>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo etiqueta="Preparación" para="e-prep"><input id="e-prep" v-model.number="fEsp.preparacion_min" type="number" min="0" step="15" class="entrada" /></Campo>
            <Campo etiqueta="Montaje" para="e-mont"><input id="e-mont" v-model.number="fEsp.montaje_min" type="number" min="0" step="15" class="entrada" /></Campo>
            <Campo etiqueta="Desmontaje" para="e-desm"><input id="e-desm" v-model.number="fEsp.desmontaje_min" type="number" min="0" step="15" class="entrada" /></Campo>
            <Campo etiqueta="Limpieza" para="e-limp"><input id="e-limp" v-model.number="fEsp.limpieza_min" type="number" min="0" step="15" class="entrada" /></Campo>
          </div>
        </fieldset>
        <fieldset>
          <legend class="flex w-full items-center justify-between text-sm font-medium text-slate-700">
            <span>Horario de atención <Ayuda texto="Si la hora de cierre es anterior a la de apertura, el horario pasa la medianoche. Reservar fuera de horario muestra un aviso, pero no lo impide." /></span>
            <button type="button" class="enlace text-xs" @click="copiarHorarioATodos">Copiar el primero a todos</button>
          </legend>
          <ul class="mt-2 space-y-1.5">
            <li v-for="(h, dia) in fEsp.horarios" :key="dia" class="grid grid-cols-[7rem_1fr_1fr] items-center gap-2 text-sm">
              <label class="flex items-center gap-2"><input v-model="h.abierto" type="checkbox" class="rounded border-slate-300 text-marca-600" /> {{ DIAS_SEMANA[dia] }}</label>
              <CampoHora v-model="h.desde" :deshabilitado="!h.abierto" :aria-label="`${DIAS_SEMANA[dia]} desde`" />
              <CampoHora v-model="h.hasta" :deshabilitado="!h.abierto" :aria-label="`${DIAS_SEMANA[dia]} hasta`" />
            </li>
          </ul>
          <p class="mt-1 text-xs text-slate-500">Sin días marcados = sin restricción horaria.</p>
        </fieldset>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorForm }}
          <RouterLink v-if="limitePlan" to="/configuracion/plan" class="enlace">Ver planes</RouterLink></p>
      </form>
      <template #pie><button class="btn-secundario" @click="espAbierto = false">Cancelar</button>
        <button type="submit" form="f-esp" class="btn-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button></template>
    </Modal>

    <Modal v-model="recAbierto" :titulo="recSel ? 'Editar recurso' : 'Nuevo recurso'" ancho="sm">
      <form id="f-rec" class="space-y-3" @submit.prevent="guardarRecurso">
        <Campo etiqueta="Nombre" para="r-nombre" requerido><input id="r-nombre" v-model="fRec.nombre" class="entrada" placeholder="Ej.: Mesas redondas" /></Campo>
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
