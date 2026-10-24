<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import Cargando from '@/components/ui/Cargando.vue'
import type { Fila } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { fmtFechaHora } from '@/lib/formato'
import { useOrganizacion } from '@/stores/organizacion'

const TABLAS: Record<string, string> = {
  reservas: 'Reservas', reserva_espacios: 'Espacios de reserva', pagos: 'Cobros', cuotas: 'Cuotas', clientes: 'Clientes',
  bloqueos: 'Bloqueos', gastos: 'Gastos', tareas: 'Tareas', membresias: 'Usuarios', invitaciones: 'Invitaciones',
  roles: 'Roles', rol_permisos: 'Permisos', organizaciones: 'Organización', salones: 'Marcas', sucursales: 'Salones',
  espacios: 'Espacios', espacio_horarios: 'Horarios', recursos: 'Recursos', feriados: 'Feriados',
}
const ACCIONES: Record<string, string> = { alta: 'Alta', cambio: 'Cambio', baja: 'Baja' }
const org = useOrganizacion()
const filtro = reactive({ tabla: '', accion: '' })
type Registro = Omit<Fila<'auditoria'>, 'cambios'> & { cambios: unknown }
const filas = ref<Registro[]>([])
const usuarios = ref(new Map<string, string>())
const pagina = ref(0)
const hayMas = ref(false)
const cargando = ref(true)
const error = ref('')
const abierta = ref<number | null>(null)

async function cargar() {
  cargando.value = true
  try {
    // Se piden 51 para saber si hay otra página.
    const datos = await api.get<Registro[]>(rutaOrg(org.id, 'auditoria'), {
      tabla: filtro.tabla || undefined, accion: filtro.accion || undefined, limite: 51, desplazamiento: pagina.value * 50,
    })
    hayMas.value = datos.length > 50
    filas.value = datos.slice(0, 50)
  } catch (e) { error.value = traducirError(e) } finally { cargando.value = false }
}
watch(() => ({ ...filtro }), () => { pagina.value = 0; void cargar() })
watch(pagina, cargar)
onMounted(async () => {
  void cargar()
  const data = await api.get<Array<{ usuario_id: string; nombre: string | null; email: string }>>(rutaOrg(org.id, 'miembros')).catch(() => [])
  usuarios.value = new Map(data.map((m) => [m.usuario_id, m.nombre || m.email]))
})
function resumen(f: Registro): string {
  const c = (f.cambios ?? {}) as Record<string, unknown>
  if (f.accion === 'cambio') return Object.keys(c).join(', ')
  return String(c.titulo ?? c.nombre ?? c.descripcion ?? c.email ?? c.permiso ?? '')
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <select v-model="filtro.tabla" class="entrada w-auto" aria-label="Sección"><option value="">Todas las secciones</option>
        <option v-for="(t, k) in TABLAS" :key="k" :value="k">{{ t }}</option></select>
      <select v-model="filtro.accion" class="entrada w-auto" aria-label="Acción"><option value="">Todas las acciones</option>
        <option v-for="(a, k) in ACCIONES" :key="k" :value="k">{{ a }}</option></select>
    </div>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <div class="tarjeta overflow-x-auto">
      <Cargando v-if="cargando && !filas.length" />
      <table v-else class="tabla">
        <thead class="bg-slate-50"><tr><th>Fecha</th><th>Usuario</th><th>Sección</th><th>Acción</th><th>Detalle</th></tr></thead>
        <tbody class="divide-y divide-slate-100">
          <template v-for="f in filas" :key="f.id">
            <tr class="cursor-pointer" @click="abierta = abierta === f.id ? null : f.id">
              <td class="whitespace-nowrap">{{ fmtFechaHora(f.creado_at, org.zona) }}</td>
              <td>{{ f.usuario_id ? usuarios.get(f.usuario_id) ?? 'Usuario eliminado' : 'Sistema' }}</td>
              <td>{{ TABLAS[f.tabla] ?? f.tabla }}</td>
              <td>{{ ACCIONES[f.accion] }}</td>
              <td class="max-w-xs truncate text-slate-600">{{ resumen(f) }}</td>
            </tr>
            <tr v-if="abierta === f.id"><td colspan="5" class="bg-slate-50">
              <pre class="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{{ JSON.stringify(f.cambios, null, 2) }}</pre></td></tr>
          </template>
          <tr v-if="!filas.length"><td colspan="5" class="py-8 text-center text-slate-500">Sin registros.</td></tr>
        </tbody>
      </table>
    </div>
    <div class="flex justify-between">
      <button class="btn-fantasma btn-chico" :disabled="pagina === 0" @click="pagina--">Más recientes</button>
      <button class="btn-fantasma btn-chico" :disabled="!hayMas" @click="pagina++">Más antiguos</button>
    </div>
  </div>
</template>
