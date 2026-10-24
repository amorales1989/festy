<script setup lang="ts">
// Agendar o ver una entrevista con un cliente (o con alguien que todavía no es cliente).
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { FileText, MessageCircle, Trash2 } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import CampoFecha from '@/components/ui/CampoFecha.vue'
import CampoHora from '@/components/ui/CampoHora.vue'
import SelectorCliente from '@/components/clientes/SelectorCliente.vue'
import type { ClienteElegido } from '@/components/clientes/tipos'
import type { Fila } from '@/lib/supabase'
import { api, eliminar as eliminarRegistro, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { aLocal, desdeLocal, fmtDiaLargo, hoyISO } from '@/lib/formato'
import { ESTADOS_ENTREVISTA, MODALIDADES_ENTREVISTA } from '@/lib/catalogos'
import { telefonoWhatsApp } from '@/lib/compartir'
import { useOrganizacion } from '@/stores/organizacion'
import { useAcciones } from '@/stores/acciones'
import { useSesion } from '@/stores/sesion'
import { useNotificaciones } from '@/composables/useNotificaciones'
import { useConfirmar } from '@/composables/useConfirmar'

const org = useOrganizacion()
const acciones = useAcciones()
const sesion = useSesion()
const router = useRouter()
const { exito, error: notificarError } = useNotificaciones()
const { confirmar } = useConfirmar()
const abierto = computed({ get: () => acciones.entrevistaAbierta, set: (v) => { acciones.entrevistaAbierta = v } })
const editando = computed(() => !!acciones.entrevistaId)
const puede = computed(() => org.puede('entrevistas.gestionar'))

const vacio = () => ({ esCliente: true, contacto_nombre: '', contacto_telefono: '', fecha: '', hora: '18:00', duracion_min: 45,
  modalidad: 'presencial', sucursal_id: '', enlace: '', motivo: '', asignada_a: '', estado: 'programada', notas: '' })
const f = reactive(vacio())
const cliente = ref<ClienteElegido | null>(null)
const miembros = ref<Array<{ usuario_id: string; nombre: string; email: string }>>([])
const error = ref('')
const guardando = ref(false)

watch(abierto, async (v) => {
  if (!v) return
  Object.assign(f, vacio())
  cliente.value = null
  error.value = ''
  f.asignada_a = sesion.usuario?.id ?? ''
  f.sucursal_id = org.sucursalesActivas[0]?.id ?? ''
  const data = await api.get<Array<(typeof miembros.value)[number] & { activo: boolean }>>(rutaOrg(org.id, 'miembros')).catch(() => [])
  miembros.value = data.filter((m) => m.activo)
  if (acciones.entrevistaId) {
    try {
      const e = await api.get<Fila<'entrevistas'> & { clientes: ClienteElegido | null }>(`/entrevistas/${acciones.entrevistaId}`)
      const l = aLocal(e.inicio, org.zona)
      Object.assign(f, { esCliente: !!e.cliente_id, contacto_nombre: e.contacto_nombre ?? '', contacto_telefono: e.contacto_telefono ?? '',
        fecha: l.fecha, hora: l.hora, duracion_min: e.duracion_min, modalidad: e.modalidad, sucursal_id: e.sucursal_id ?? '', enlace: e.enlace ?? '',
        motivo: e.motivo ?? '', asignada_a: e.asignada_a ?? '', estado: e.estado, notas: e.notas ?? '' })
      cliente.value = e.clientes as ClienteElegido | null
    } catch (e) { error.value = traducirError(e) }
  } else {
    const p = acciones.precargaEntrevista
    f.fecha = p.fecha ?? hoyISO(org.zona)
    if (p.hora) f.hora = p.hora
    if (p.clienteId) {
      const c = await api.get<ClienteElegido>(`/clientes/${p.clienteId}`).catch(() => null)
      cliente.value = c ? { id: c.id, nombre: c.nombre, telefono: c.telefono, email: c.email } : null
    }
  }
})

async function guardar(estado?: string) {
  error.value = ''
  if (f.esCliente && !cliente.value) { error.value = 'Elegí el cliente o marcá que todavía no es cliente.'; return }
  if (!f.esCliente && f.contacto_nombre.trim().length < 2) { error.value = 'Ingresá el nombre de la persona.'; return }
  if (!f.fecha || !f.hora) { error.value = 'Indicá el día y la hora.'; return }
  guardando.value = true
  const datos = {
    cliente_id: f.esCliente ? cliente.value!.id : null, contacto_nombre: f.esCliente ? null : f.contacto_nombre.trim(),
    contacto_telefono: f.esCliente ? null : f.contacto_telefono.trim() || null, inicio: desdeLocal(f.fecha, f.hora, org.zona),
    duracion_min: f.duracion_min, modalidad: f.modalidad, sucursal_id: f.modalidad === 'presencial' ? f.sucursal_id || null : null,
    enlace: f.modalidad === 'videollamada' ? f.enlace.trim() || null : null, motivo: f.motivo.trim() || null,
    asignada_a: f.asignada_a || null, estado: estado ?? f.estado, notas: f.notas.trim() || null,
  }
  try {
    if (acciones.entrevistaId) await api.put(rutaOrg(org.id, `entrevistas/${acciones.entrevistaId}`), datos)
    else await api.post(rutaOrg(org.id, 'entrevistas'), datos)
    exito(estado ? `Entrevista marcada como ${ESTADOS_ENTREVISTA[estado]!.etiqueta.toLowerCase()}.` : editando.value ? 'Entrevista actualizada.' : 'Entrevista agendada.')
    acciones.cambiosGuardados()
    abierto.value = false
  } catch (e) { error.value = traducirError(e) } finally { guardando.value = false }
}
async function eliminar() {
  if (!(await confirmar({ titulo: 'Eliminar entrevista', mensaje: 'Se elimina de la agenda.', confirmar: 'Eliminar', peligro: true }))) return
  try {
    await eliminarRegistro('entrevistas', acciones.entrevistaId!)
    acciones.cambiosGuardados()
    abierto.value = false
  } catch (e) { notificarError(e) }
}
const telefono = computed(() => (f.esCliente ? cliente.value?.telefono : f.contacto_telefono) ?? null)
function recordarPorWhatsApp() {
  const nombre = (f.esCliente ? cliente.value?.nombre : f.contacto_nombre)?.split(' ')[0] ?? ''
  const lugar = f.modalidad === 'presencial' ? `en ${org.sucursales.find((s) => s.id === f.sucursal_id)?.direccion || org.actual?.nombre}`
    : f.modalidad === 'videollamada' ? `por videollamada${f.enlace ? `: ${f.enlace}` : ''}` : 'por teléfono'
  const texto = `Hola ${nombre}! Te recuerdo nuestra reunión el ${fmtDiaLargo(f.fecha)} a las ${f.hora} hs, ${lugar}. ¡Te esperamos! ${org.actual?.nombre ?? ''}`
  window.open(`https://wa.me/${telefonoWhatsApp(telefono.value) ?? ''}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
}
function hacerPresupuesto() {
  abierto.value = false
  void router.push({ name: 'presupuesto-nuevo', query: cliente.value ? { cliente: cliente.value.id } : {} })
}
</script>

<template>
  <Modal v-model="abierto" :titulo="editando ? 'Entrevista' : 'Agendar entrevista'" descripcion="Reunión con un cliente para mostrar el salón o cerrar detalles.">
    <form id="f-entrevista" class="space-y-4" @submit.prevent="guardar()">
      <fieldset :disabled="!puede" class="space-y-4">
        <div v-if="editando" class="flex flex-wrap items-center gap-2">
          <span :class="['rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', ESTADOS_ENTREVISTA[f.estado]?.clase]">{{ ESTADOS_ENTREVISTA[f.estado]?.etiqueta }}</span>
          <template v-if="f.estado === 'programada' && puede">
            <button type="button" class="btn-secundario btn-chico" @click="guardar('realizada')">Se hizo</button>
            <button type="button" class="btn-fantasma btn-chico" @click="guardar('no_asistio')">No vino</button>
            <button type="button" class="btn-fantasma btn-chico text-rose-600" @click="guardar('cancelada')">Cancelar</button>
          </template>
        </div>
        <div>
          <div class="mb-2 flex gap-2 text-sm">
            <button type="button" :class="['rounded-lg px-3 py-1.5 ring-1', f.esCliente ? 'bg-marca-50 font-medium ring-marca-400' : 'ring-slate-300']" @click="f.esCliente = true">Cliente</button>
            <button type="button" :class="['rounded-lg px-3 py-1.5 ring-1', !f.esCliente ? 'bg-marca-50 font-medium ring-marca-400' : 'ring-slate-300']" @click="f.esCliente = false">Todavía no es cliente</button>
          </div>
          <SelectorCliente v-if="f.esCliente" v-model="cliente" :deshabilitado="!puede" />
          <div v-else class="grid gap-2 sm:grid-cols-2">
            <input v-model="f.contacto_nombre" class="entrada" placeholder="Nombre" aria-label="Nombre del contacto" />
            <input v-model="f.contacto_telefono" class="entrada" type="tel" placeholder="WhatsApp / teléfono" aria-label="Teléfono del contacto" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_6.5rem_7rem]">
          <Campo etiqueta="Día" para="ent-fecha" class="col-span-2 sm:col-span-1"><CampoFecha id="ent-fecha" v-model="f.fecha" /></Campo>
          <Campo etiqueta="Hora" para="ent-hora"><CampoHora id="ent-hora" v-model="f.hora" /></Campo>
          <Campo etiqueta="Duración" para="ent-dur">
            <select id="ent-dur" v-model.number="f.duracion_min" class="entrada"><option v-for="m in [30, 45, 60, 90, 120]" :key="m" :value="m">{{ m }} min</option></select>
          </Campo>
        </div>
        <div role="radiogroup" aria-label="Modalidad" class="flex flex-wrap gap-2">
          <button v-for="(m, k) in MODALIDADES_ENTREVISTA" :key="k" type="button" role="radio" :aria-checked="f.modalidad === k"
                  :class="['rounded-lg px-3 py-1.5 text-sm ring-1', f.modalidad === k ? 'bg-marca-50 font-medium ring-2 ring-marca-500' : 'ring-slate-300']" @click="f.modalidad = k">{{ m }}</button>
        </div>
        <Campo v-if="f.modalidad === 'presencial' && org.sucursalesActivas.length > 1" etiqueta="Salón" para="ent-suc">
          <select id="ent-suc" v-model="f.sucursal_id" class="entrada"><option v-for="s in org.sucursalesActivas" :key="s.id" :value="s.id">{{ s.nombre }}</option></select>
        </Campo>
        <Campo v-if="f.modalidad === 'videollamada'" etiqueta="Enlace de la videollamada" para="ent-enlace"><input id="ent-enlace" v-model="f.enlace" class="entrada" placeholder="https://meet.google.com/…" /></Campo>
        <div class="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Para qué" para="ent-motivo"><input id="ent-motivo" v-model="f.motivo" class="entrada" placeholder="Ej.: visita al salón, degustación" /></Campo>
          <Campo etiqueta="La atiende" para="ent-asig">
            <select id="ent-asig" v-model="f.asignada_a" class="entrada"><option value="">Sin asignar</option>
              <option v-for="m in miembros" :key="m.usuario_id" :value="m.usuario_id">{{ m.nombre || m.email }}</option></select>
          </Campo>
        </div>
        <Campo etiqueta="Notas" para="ent-notas"><textarea id="ent-notas" v-model="f.notas" rows="2" class="entrada" /></Campo>
      </fieldset>
      <div v-if="editando || telefono" class="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button v-if="telefono" type="button" class="btn-fantasma btn-chico text-emerald-700" @click="recordarPorWhatsApp"><MessageCircle class="size-4" /> Recordarle por WhatsApp</button>
        <button v-if="editando && org.puede('presupuestos.gestionar')" type="button" class="btn-fantasma btn-chico" @click="hacerPresupuesto"><FileText class="size-4" /> Hacer presupuesto</button>
        <button v-if="editando && puede" type="button" class="btn-fantasma btn-chico ml-auto text-rose-600" @click="eliminar"><Trash2 class="size-4" /> Eliminar</button>
      </div>
      <p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error }}</p>
    </form>
    <template v-if="puede" #pie>
      <button class="btn-secundario" @click="abierto = false">Cerrar</button>
      <button type="submit" form="f-entrevista" class="btn-primario" :disabled="guardando">{{ editando ? 'Guardar cambios' : 'Agendar' }}</button>
    </template>
  </Modal>
</template>
