<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import Cargando from '@/components/ui/Cargando.vue'
import type { Fila } from '@/lib/supabase'
import { api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFecha, hoyISO } from '@/lib/formato'
import { useOrganizacion } from '@/stores/organizacion'
import { useSesion } from '@/stores/sesion'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

type Tarea = Fila<'tareas'> & { reservas: { numero: number; titulo: string } | null }
const org = useOrganizacion()
const sesion = useSesion()
const { confirmar } = useConfirmar()
const { exito, error: notificarError } = useNotificaciones()
const tareas = ref<Tarea[]>([])
const miembros = ref<Array<{ usuario_id: string; nombre: string; email: string }>>([])
const cargando = ref(true)
const error = ref('')
const filtro = reactive({ quien: org.puede('tareas.gestionar') ? 'todas' : 'mias', estado: 'abiertas' })
const hoy = computed(() => hoyISO(org.zona))

async function cargar() {
  cargando.value = true
  try {
    tareas.value = await api.get<Tarea[]>(rutaOrg(org.id, 'tareas'), { quien: filtro.quien, estado: filtro.estado })
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
watch(() => ({ ...filtro }), cargar)
onMounted(async () => {
  void cargar()
  const data = await api.get<Array<(typeof miembros.value)[number] & { activo: boolean }>>(rutaOrg(org.id, 'miembros')).catch(() => [])
  miembros.value = data.filter((m) => m.activo)
})
const nombre = (uid: string | null) => miembros.value.find((m) => m.usuario_id === uid)?.nombre || miembros.value.find((m) => m.usuario_id === uid)?.email || ''

async function cambiarEstado(t: Tarea, estado: string) {
  try {
    await api.patch(`/tareas/${t.id}/estado`, { estado })
    void cargar()
  } catch (e) { notificarError(e) }
}

const abierto = ref(false)
const editando = ref<Tarea | null>(null)
const f = reactive({ titulo: '', descripcion: '', vence_el: '', asignada_a: '', prioridad: 'media' })
const errorForm = ref('')
function abrir(t: Tarea | null = null) {
  editando.value = t
  Object.assign(f, t ? { titulo: t.titulo, descripcion: t.descripcion ?? '', vence_el: t.vence_el ?? '', asignada_a: t.asignada_a ?? '', prioridad: t.prioridad }
    : { titulo: '', descripcion: '', vence_el: '', asignada_a: '', prioridad: 'media' })
  errorForm.value = ''
  abierto.value = true
}
async function guardar() {
  if (f.titulo.trim().length < 2) { errorForm.value = 'Ingresá un título.'; return }
  const datos = { titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, vence_el: f.vence_el || null, asignada_a: f.asignada_a || null, prioridad: f.prioridad }
  try {
    if (editando.value) await api.put(rutaOrg(org.id, `tareas/${editando.value.id}`), datos)
    else await api.post(rutaOrg(org.id, 'tareas'), datos)
    exito('Tarea guardada.')
    abierto.value = false
    void cargar()
  } catch (e) { errorForm.value = traducirError(e) }
}
async function borrar(t: Tarea) {
  if (!(await confirmar({ titulo: 'Eliminar tarea', mensaje: `¿Eliminar “${t.titulo}”?`, confirmar: 'Eliminar', peligro: true }))) return
  try {
    await eliminarRegistro('tareas', t.id)
    void cargar()
  } catch (e) { notificarError(e) }
}
const PRIORIDADES: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' }
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="titulo-pagina">Tareas</h1>
      <button v-if="org.puede('tareas.gestionar')" class="btn-primario" @click="abrir()"><Plus class="size-4" /> Nueva tarea</button>
    </div>
    <div class="flex flex-wrap gap-2">
      <select v-model="filtro.quien" class="entrada w-auto" aria-label="Asignación">
        <option value="mias">Asignadas a mí</option><option value="todas">Todas</option><option value="sin">Sin asignar</option>
      </select>
      <select v-model="filtro.estado" class="entrada w-auto" aria-label="Estado">
        <option value="abiertas">Pendientes y en curso</option><option value="hechas">Hechas</option>
      </select>
    </div>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <div class="tarjeta">
      <Cargando v-if="cargando && !tareas.length" />
      <EstadoVacio v-else-if="!tareas.length" :icono="ListChecks" titulo="No hay tareas" descripcion="Las tareas también se pueden crear desde cada reserva." />
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="t in tareas" :key="t.id" class="flex flex-wrap items-start gap-3 px-4 py-3">
          <input type="checkbox" :checked="t.estado === 'hecha'" class="mt-1 rounded border-slate-300 text-marca-600" :aria-label="`Marcar ${t.titulo}`"
                 :disabled="!org.puede('tareas.gestionar') && t.asignada_a !== sesion.usuario?.id" @change="cambiarEstado(t, t.estado === 'hecha' ? 'pendiente' : 'hecha')" />
          <div class="min-w-0 flex-1">
            <p :class="['text-sm font-medium', t.estado === 'hecha' && 'text-slate-400 line-through']">{{ t.titulo }}
              <span v-if="t.prioridad === 'alta'" class="ml-1 rounded bg-rose-50 px-1.5 text-[10px] font-semibold uppercase text-rose-700">Alta</span></p>
            <p v-if="t.descripcion" class="text-sm text-slate-600">{{ t.descripcion }}</p>
            <p class="text-xs text-slate-500">
              <span v-if="t.vence_el" :class="t.estado !== 'hecha' && t.vence_el < hoy && 'font-medium text-rose-600'">Vence {{ fmtFecha(t.vence_el, org.zona) }}</span>
              <template v-if="t.asignada_a"> · {{ nombre(t.asignada_a) }}</template>
              <template v-if="t.reservas"> · <RouterLink :to="{ name: 'reserva', params: { id: t.reserva_id! } }" class="enlace">#{{ t.reservas.numero }} {{ t.reservas.titulo }}</RouterLink></template>
            </p>
          </div>
          <select v-if="t.estado !== 'hecha' && (org.puede('tareas.gestionar') || t.asignada_a === sesion.usuario?.id)" :value="t.estado" class="entrada w-auto py-1 text-xs" aria-label="Estado"
                  @change="cambiarEstado(t, ($event.target as HTMLSelectElement).value)">
            <option value="pendiente">Pendiente</option><option value="en_curso">En curso</option><option value="hecha">Hecha</option>
          </select>
          <div v-if="org.puede('tareas.gestionar')" class="flex">
            <button class="btn-fantasma p-1.5" aria-label="Editar" @click="abrir(t)"><Pencil class="size-4" /></button>
            <button class="btn-fantasma p-1.5 text-rose-600" aria-label="Eliminar" @click="borrar(t)"><Trash2 class="size-4" /></button>
          </div>
        </li>
      </ul>
    </div>
    <Modal v-model="abierto" :titulo="editando ? 'Editar tarea' : 'Nueva tarea'">
      <form id="form-tarea" class="grid gap-3 sm:grid-cols-2" @submit.prevent="guardar">
        <Campo etiqueta="Título" para="t-titulo" requerido class="sm:col-span-2"><input id="t-titulo" v-model="f.titulo" class="entrada" /></Campo>
        <Campo etiqueta="Detalle" para="t-desc" class="sm:col-span-2"><textarea id="t-desc" v-model="f.descripcion" rows="2" class="entrada" /></Campo>
        <Campo etiqueta="Vence" para="t-vence"><CampoFecha id="t-vence" v-model="f.vence_el" /></Campo>
        <Campo etiqueta="Prioridad" para="t-prio"><select id="t-prio" v-model="f.prioridad" class="entrada"><option v-for="(p, k) in PRIORIDADES" :key="k" :value="k">{{ p }}</option></select></Campo>
        <Campo etiqueta="Asignar a" para="t-asig" class="sm:col-span-2">
          <select id="t-asig" v-model="f.asignada_a" class="entrada"><option value="">Sin asignar</option>
            <option v-for="m in miembros" :key="m.usuario_id" :value="m.usuario_id">{{ m.nombre || m.email }}</option></select>
        </Campo>
        <p v-if="errorForm" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2" role="alert">{{ errorForm }}</p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="abierto = false">Cancelar</button>
        <button type="submit" form="form-tarea" class="btn-primario">Guardar</button>
      </template>
    </Modal>
  </div>
</template>
