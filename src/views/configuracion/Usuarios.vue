<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Copy, MailPlus, X } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Campo from '@/components/ui/Campo.vue'
import type { Fila } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { esLimitePlan, traducirError } from '@/lib/errores'
import { fmtFecha } from '@/lib/formato'
import { useOrganizacion } from '@/stores/organizacion'
import { useSesion } from '@/stores/sesion'
import { useConfirmar } from '@/composables/useConfirmar'
import { useNotificaciones } from '@/composables/useNotificaciones'

interface Miembro { membresia_id: string; usuario_id: string; nombre: string; email: string; rol_id: string; rol: string; rol_clave: string; activo: boolean; creado_at: string }
const org = useOrganizacion()
const sesion = useSesion()
const { confirmar } = useConfirmar()
const { exito, info, error: notificarError } = useNotificaciones()
const miembros = ref<Miembro[]>([])
const invitaciones = ref<Array<Fila<'invitaciones'> & { roles: { nombre: string } | null }>>([])
const roles = ref<Fila<'roles'>[]>([])

async function cargar() {
  try {
    const [m, i, r] = await Promise.all([
      api.get<Miembro[]>(rutaOrg(org.id, 'miembros')),
      api.get<typeof invitaciones.value>(rutaOrg(org.id, 'invitaciones')),
      api.get<Fila<'roles'>[]>(rutaOrg(org.id, 'roles')),
    ])
    miembros.value = m
    invitaciones.value = i
    roles.value = r
  } catch (e) { notificarError(e) }
}
onMounted(cargar)

async function cambiarRol(m: Miembro, rolId: string) {
  try {
    await api.patch(`/membresias/${m.membresia_id}`, { rol_id: rolId })
    exito('Rol actualizado.')
  } catch (e) { notificarError(e) }
  void cargar()
}
async function alternarActivo(m: Miembro) {
  if (m.activo && !(await confirmar({ titulo: 'Desactivar usuario', peligro: true, confirmar: 'Desactivar',
    mensaje: `${m.nombre || m.email} no podrá ingresar a esta organización. Sus registros se conservan.` }))) return
  try {
    await api.patch(`/membresias/${m.membresia_id}`, { activo: !m.activo })
    exito(m.activo ? 'Usuario desactivado.' : 'Usuario reactivado.')
  } catch (e) { notificarError(e) }
  void cargar()
}

const invitarAbierto = ref(false)
const inv = reactive({ email: '', rol_id: '' })
const errorInv = ref('')
const limite = ref(false)
const enlaceGenerado = ref('')
function abrirInvitar() {
  Object.assign(inv, { email: '', rol_id: roles.value.find((r) => r.clave === 'recepcion')?.id ?? roles.value[0]?.id ?? '' })
  errorInv.value = ''
  enlaceGenerado.value = ''
  invitarAbierto.value = true
}
const enlace = (token: string) => `${location.origin}/invitacion/${token}`
async function invitar() {
  errorInv.value = ''
  limite.value = false
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inv.email.trim())) { errorInv.value = 'Ingresá un email válido.'; return }
  try {
    const r = await api.post<{ token: string }>(rutaOrg(org.id, 'invitaciones'), { email: inv.email.trim().toLowerCase(), rol_id: inv.rol_id })
    enlaceGenerado.value = enlace(r.token)
    void cargar()
  } catch (e) {
    errorInv.value = (e as { code?: string }).code === '23505' ? 'Ya hay una invitación pendiente para ese email.' : traducirError(e)
    limite.value = esLimitePlan(e)
  }
}
async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    info('Enlace copiado. Envialo por WhatsApp o email.')
  } catch {
    notificarError('No se pudo copiar automáticamente. Seleccioná el enlace y copialo.')
  }
}
async function revocar(i: Fila<'invitaciones'>) {
  try {
    await api.delete(`/invitaciones/${i.id}`)
    void cargar()
  } catch (e) { notificarError(e) }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-slate-600">Usuarios con acceso a {{ org.actual?.nombre }}<template v-if="org.plan?.max_usuarios"> · tu plan permite {{ org.plan.max_usuarios }}</template>.</p>
      <button class="btn-primario" @click="abrirInvitar"><MailPlus class="size-4" /> Invitar usuario</button>
    </div>
    <div class="tarjeta overflow-x-auto">
      <table class="tabla">
        <thead class="bg-slate-50"><tr><th>Usuario</th><th>Rol</th><th class="hidden sm:table-cell">Desde</th><th /></tr></thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="m in miembros" :key="m.membresia_id" :class="!m.activo && 'opacity-50'">
            <td><span class="font-medium">{{ m.nombre || '—' }}</span><span v-if="m.usuario_id === sesion.usuario?.id" class="ml-1 text-xs text-slate-500">(vos)</span>
              <span class="block text-xs text-slate-500">{{ m.email }}</span></td>
            <td>
              <select :value="m.rol_id" class="entrada w-auto py-1" :disabled="m.usuario_id === sesion.usuario?.id || !m.activo" :aria-label="`Rol de ${m.email}`"
                      @change="cambiarRol(m, ($event.target as HTMLSelectElement).value)">
                <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.nombre }}</option>
              </select>
            </td>
            <td class="hidden sm:table-cell">{{ fmtFecha(m.creado_at, org.zona) }}</td>
            <td class="text-right">
              <button v-if="m.usuario_id !== sesion.usuario?.id" class="btn-fantasma btn-chico" :class="m.activo && 'text-rose-600'" @click="alternarActivo(m)">
                {{ m.activo ? 'Desactivar' : 'Reactivar' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section v-if="invitaciones.length" class="tarjeta">
      <h2 class="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Invitaciones pendientes</h2>
      <ul class="divide-y divide-slate-100">
        <li v-for="i in invitaciones" :key="i.id" class="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
          <span class="flex-1">{{ i.email }} <span class="text-xs text-slate-500">· {{ i.roles?.nombre }} · vence {{ fmtFecha(i.expira_at, org.zona) }}</span></span>
          <button class="btn-fantasma btn-chico" @click="copiar(enlace(i.token))"><Copy class="size-3.5" /> Copiar enlace</button>
          <button class="btn-fantasma btn-chico text-rose-600" @click="revocar(i)"><X class="size-3.5" /> Revocar</button>
        </li>
      </ul>
    </section>

    <Modal v-model="invitarAbierto" titulo="Invitar usuario" ancho="sm">
      <div v-if="enlaceGenerado" class="space-y-3 text-sm">
        <p>Listo. Compartí este enlace con <strong>{{ inv.email }}</strong> (vence en 7 días):</p>
        <div class="flex gap-2"><input :value="enlaceGenerado" readonly class="entrada text-xs" aria-label="Enlace de invitación" @focus="($event.target as HTMLInputElement).select()" />
          <button class="btn-secundario" @click="copiar(enlaceGenerado)"><Copy class="size-4" /></button></div>
        <p class="text-xs text-slate-500">El envío automático por email requiere configurar un servidor de correo (ver docs/PENDIENTES.md).</p>
      </div>
      <form v-else id="f-inv" class="space-y-3" @submit.prevent="invitar">
        <Campo etiqueta="Email" para="i-email" requerido><input id="i-email" v-model="inv.email" type="email" class="entrada" /></Campo>
        <Campo etiqueta="Rol" para="i-rol" :ayuda="roles.find((r) => r.id === inv.rol_id)?.descripcion ?? undefined">
          <select id="i-rol" v-model="inv.rol_id" class="entrada"><option v-for="r in roles" :key="r.id" :value="r.id">{{ r.nombre }}</option></select>
        </Campo>
        <p v-if="errorInv" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ errorInv }}
          <RouterLink v-if="limite" to="/configuracion/plan" class="enlace">Ver planes</RouterLink></p>
      </form>
      <template #pie>
        <button class="btn-secundario" @click="invitarAbierto = false">{{ enlaceGenerado ? 'Cerrar' : 'Cancelar' }}</button>
        <button v-if="!enlaceGenerado" type="submit" form="f-inv" class="btn-primario">Crear invitación</button>
      </template>
    </Modal>
  </div>
</template>
