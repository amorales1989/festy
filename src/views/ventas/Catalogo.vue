<script setup lang="ts">
// Catálogo de servicios: lo que el salón vende, con su precio. Se usa para armar presupuestos en segundos.
import { computed, onMounted, reactive, ref } from 'vue'
import { Package, Pencil, Plus, Power, Trash2 } from 'lucide-vue-next'
import PestanasVentas from './PestanasVentas.vue'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoMoneda from '@/components/ui/CampoMoneda.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import Cargando from '@/components/ui/Cargando.vue'
import type { Fila } from '@/lib/supabase'
import { activar, api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtMoneda } from '@/lib/formato'
import { CATEGORIAS_SERVICIO, TIPOS_SERVICIO, UNIDADES_SERVICIO } from '@/lib/catalogos'
import { useOrganizacion } from '@/stores/organizacion'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

type Servicio = Fila<'servicios'>
const org = useOrganizacion()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()
const servicios = ref<Servicio[]>([])
const cargando = ref(true)
const verInactivos = ref(false)
const puede = computed(() => org.puede('catalogo.gestionar'))

async function cargar() {
  try {
    servicios.value = (await api.get<Servicio[]>(rutaOrg(org.id, 'servicios'))).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  } catch (e) { notificarError(e) } finally { cargando.value = false }
}
onMounted(cargar)
const grupos = computed(() => (['paquete', 'servicio', 'adicional'] as const).map((tipo) => ({
  tipo, items: servicios.value.filter((s) => s.tipo === tipo && (verInactivos.value || s.activo)),
})).filter((g) => g.items.length))

const abierto = ref(false)
const sel = ref<Servicio | null>(null)
const f = reactive({ nombre: '', descripcion: '', tipo: 'servicio', categoria: 'otro', unidad: 'evento', precio: null as number | null, costo: null as number | null,
  personas_incluidas: null as number | null, precio_persona_extra: null as number | null })
const error = ref('')
function abrir(s: Servicio | null = null, tipo = 'servicio') {
  sel.value = s
  Object.assign(f, s ? { nombre: s.nombre, descripcion: s.descripcion ?? '', tipo: s.tipo, categoria: s.categoria, unidad: s.unidad, precio: Number(s.precio), costo: s.costo === null ? null : Number(s.costo),
    personas_incluidas: s.personas_incluidas, precio_persona_extra: s.precio_persona_extra === null ? null : Number(s.precio_persona_extra) }
    : { nombre: '', descripcion: '', tipo, categoria: 'otro', unidad: 'evento', precio: null, costo: null, personas_incluidas: null, precio_persona_extra: null })
  error.value = ''
  abierto.value = true
}
async function guardar() {
  if (f.nombre.trim().length < 2) { error.value = 'Ingresá un nombre.'; return }
  if (f.precio === null || f.precio < 0) { error.value = 'Ingresá el precio.'; return }
  // Personas incluidas: solo para precios por evento, y siempre con el precio de la persona extra.
  const incluidas = f.unidad === 'evento' && f.personas_incluidas ? f.personas_incluidas : null
  if (incluidas && (!Number.isInteger(incluidas) || incluidas < 1)) { error.value = 'Las personas incluidas deben ser un número entero.'; return }
  if (incluidas && f.precio_persona_extra === null) { error.value = 'Ingresá el precio por persona extra.'; return }
  const datos = { ...f, nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null, precio: f.precio,
    personas_incluidas: incluidas, precio_persona_extra: incluidas ? f.precio_persona_extra : null }
  try {
    if (sel.value) await api.put(rutaOrg(org.id, `servicios/${sel.value.id}`), datos)
    else await api.post(rutaOrg(org.id, 'servicios'), datos)
    exito('Guardado en el catálogo.')
    abierto.value = false
    void cargar()
  } catch (e) { error.value = traducirError(e) }
}
async function alternar(s: Servicio) {
  try { await activar('servicios', s.id, !s.activo); void cargar() } catch (e) { notificarError(e) }
}
async function borrar(s: Servicio) {
  if (!(await confirmar({ titulo: 'Eliminar del catálogo', mensaje: `¿Eliminar “${s.nombre}”? Los presupuestos ya hechos no cambian.`, confirmar: 'Eliminar', peligro: true }))) return
  try { await eliminarRegistro('servicios', s.id); void cargar() } catch (e) { notificarError(e) }
}
</script>

<template>
  <div class="space-y-4">
    <PestanasVentas />
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-slate-600">Cargá lo que vendés con su precio y armá presupuestos con un clic.</p>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-xs text-slate-600"><input v-model="verInactivos" type="checkbox" class="rounded border-slate-300 text-marca-600" /> Ver pausados</label>
        <button v-if="puede" class="btn-primario" @click="abrir()"><Plus class="size-4" /> Agregar al catálogo</button>
      </div>
    </div>
    <Cargando v-if="cargando" />
    <div v-else-if="!grupos.length" class="tarjeta">
      <EstadoVacio :icono="Package" titulo="Tu catálogo está vacío" descripcion="Empezá por lo que más vendés: el alquiler del salón, el menú por persona, el DJ…">
        <button v-if="puede" class="btn-primario" @click="abrir(null, 'paquete')">Agregar el primero</button>
      </EstadoVacio>
    </div>
    <section v-for="g in grupos" :key="g.tipo">
      <h2 class="mb-2 text-sm font-semibold text-slate-500">{{ TIPOS_SERVICIO[g.tipo]!.etiqueta.toUpperCase() }}S</h2>
      <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="s in g.items" :key="s.id" :class="['tarjeta flex flex-col p-4', !s.activo && 'opacity-60']">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-medium">{{ s.nombre }}<span v-if="!s.activo" class="ml-2 text-xs text-slate-500">(pausado)</span></p>
              <p class="text-xs text-slate-500">{{ CATEGORIAS_SERVICIO[s.categoria] }}</p>
            </div>
            <p class="shrink-0 text-right"><span class="block font-semibold tabular-nums">{{ fmtMoneda(s.precio, true) }}</span>
              <span class="text-xs text-slate-500">{{ UNIDADES_SERVICIO[s.unidad]!.corta }}</span></p>
          </div>
          <p v-if="s.personas_incluidas" class="mt-1 text-xs text-slate-600">
            Hasta {{ s.personas_incluidas }} personas · extra {{ fmtMoneda(s.precio_persona_extra, true) }} c/u
          </p>
          <p v-if="s.descripcion" class="mt-2 line-clamp-2 text-sm text-slate-600">{{ s.descripcion }}</p>
          <div v-if="puede" class="mt-auto flex justify-end gap-1 pt-2">
            <button class="btn-fantasma p-1.5" aria-label="Editar" @click="abrir(s)"><Pencil class="size-4" /></button>
            <button class="btn-fantasma p-1.5" :aria-label="s.activo ? 'Pausar' : 'Activar'" :title="s.activo ? 'Pausar' : 'Activar'" @click="alternar(s)"><Power class="size-4" /></button>
            <button class="btn-fantasma p-1.5 text-rose-600" aria-label="Eliminar" @click="borrar(s)"><Trash2 class="size-4" /></button>
          </div>
        </li>
      </ul>
    </section>

    <Modal v-model="abierto" :titulo="sel ? 'Editar' : 'Agregar al catálogo'">
      <form id="f-servicio" class="space-y-3" @submit.prevent="guardar">
        <div role="radiogroup" aria-label="Tipo" class="grid grid-cols-3 gap-2">
          <button v-for="(t, k) in TIPOS_SERVICIO" :key="k" type="button" role="radio" :aria-checked="f.tipo === k"
                  :class="['rounded-lg p-2 text-left ring-1', f.tipo === k ? 'bg-marca-50 ring-2 ring-marca-500' : 'ring-slate-300']" @click="f.tipo = k">
            <span class="block text-sm font-semibold">{{ t.etiqueta }}</span><span class="block text-[11px] text-slate-500">{{ t.ayuda }}</span>
          </button>
        </div>
        <Campo etiqueta="Nombre" para="s-nombre"><input id="s-nombre" v-model="f.nombre" class="entrada" placeholder="Ej.: Menú completo con recepción" /></Campo>
        <Campo etiqueta="Qué incluye" para="s-desc"><textarea id="s-desc" v-model="f.descripcion" rows="2" class="entrada" placeholder="Se imprime en el presupuesto" /></Campo>
        <div class="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Precio" para="s-precio"><CampoMoneda id="s-precio" v-model="f.precio" /></Campo>
          <Campo etiqueta="Se cobra" para="s-unidad">
            <select id="s-unidad" v-model="f.unidad" class="entrada"><option v-for="(u, k) in UNIDADES_SERVICIO" :key="k" :value="k">{{ u.etiqueta }}</option></select>
          </Campo>
          <Campo etiqueta="Rubro" para="s-cat">
            <select id="s-cat" v-model="f.categoria" class="entrada"><option v-for="(c, k) in CATEGORIAS_SERVICIO" :key="k" :value="k">{{ c }}</option></select>
          </Campo>
        </div>
        <div v-if="f.unidad === 'evento'" class="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Personas incluidas (opcional)" para="s-incluidas" ayuda="Ej.: el precio cubre hasta 20 personas.">
            <input id="s-incluidas" v-model.number="f.personas_incluidas" type="number" min="1" step="1" class="entrada" placeholder="Sin límite" />
          </Campo>
          <Campo v-if="f.personas_incluidas" etiqueta="Precio por persona extra" para="s-extra">
            <CampoMoneda id="s-extra" v-model="f.precio_persona_extra" />
          </Campo>
        </div>
        <Campo etiqueta="Costo para vos (opcional)" para="s-costo" ayuda="No se muestra al cliente. Servirá para calcular la ganancia por evento.">
          <CampoMoneda id="s-costo" v-model="f.costo" />
        </Campo>
        <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
      </form>
      <template #pie><button class="btn-secundario" @click="abierto = false">Cancelar</button>
        <button type="submit" form="f-servicio" class="btn-primario">Guardar</button></template>
    </Modal>
  </div>
</template>
