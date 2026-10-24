<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Plus, Search, Upload, Users } from 'lucide-vue-next'
import FormCliente from '@/components/clientes/FormCliente.vue'
import EstadoVacio from '@/components/ui/EstadoVacio.vue'
import Cargando from '@/components/ui/Cargando.vue'
import type { Fila } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { traducirError } from '@/lib/errores'
import { normalizar } from '@/lib/texto'
import { fmtFecha, hoyISO } from '@/lib/formato'
import { ORIGENES_CLIENTE } from '@/lib/catalogos'
import { exportarPDF, nombreArchivo } from '@/lib/pdf'
import { useOrganizacion } from '@/stores/organizacion'

const POR_PAGINA = 50
const org = useOrganizacion()
const router = useRouter()
const texto = ref('')
const clientes = ref<Fila<'clientes'>[]>([])
const total = ref(0)
const pagina = ref(0)
const cargando = ref(true)
const error = ref('')
const formAbierto = ref(false)

function consulta(limite: number, desplazamiento = 0) {
  const t = normalizar(texto.value)
  return api.get<{ total: number; filas: Fila<'clientes'>[] }>(rutaOrg(org.id, 'clientes'), {
    q: t.length >= 2 ? texto.value.trim() : undefined, limite, desplazamiento,
  })
}
async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const r = await consulta(POR_PAGINA, pagina.value * POR_PAGINA)
    clientes.value = r.filas
    total.value = r.total
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    cargando.value = false
  }
}
let t: ReturnType<typeof setTimeout> | undefined
watch(texto, () => { pagina.value = 0; clearTimeout(t); t = setTimeout(cargar, 250) })
watch(pagina, cargar)
onMounted(cargar)

const exportando = ref(false)
async function exportar() {
  exportando.value = true
  try {
    const todos = (await consulta(10000)).filas
    await exportarPDF(nombreArchivo('clientes', org.actual?.nombre ?? '', hoyISO(org.zona)), {
      titulo: 'Clientes', subtitulo: texto.value ? `Búsqueda: "${texto.value}"` : undefined,
      organizacion: org.actual?.nombre ?? '', zona: org.zona, horizontal: true,
      resumen: [['Clientes', String(todos.length)]],
      secciones: [{
        columnas: [
          { clave: 'nombre', titulo: 'Nombre', ancho: 22 }, { clave: 'documento', titulo: 'DNI / CUIT', ancho: 11 },
          { clave: 'telefono', titulo: 'Teléfono', ancho: 14 }, { clave: 'email', titulo: 'Email', ancho: 20 },
          { clave: 'origen', titulo: 'Nos conoció por', ancho: 11 }, { clave: 'alta', titulo: 'Cliente desde', ancho: 10 },
          { clave: 'notas', titulo: 'Notas', ancho: 20 },
        ],
        filas: todos.map((c) => ({
          nombre: c.nombre, documento: c.documento, telefono: c.telefono, email: c.email,
          origen: c.origen ? ORIGENES_CLIENTE[c.origen] : '', alta: fmtFecha(c.creado_at, org.zona), notas: c.notas,
        })),
      }],
    })
  } catch (e) {
    error.value = traducirError(e)
  } finally {
    exportando.value = false
  }
}
const paginas = computed(() => Math.ceil(total.value / POR_PAGINA))
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div><h1 class="titulo-pagina">Clientes</h1><p class="subtitulo">{{ total }} cliente{{ total === 1 ? '' : 's' }}</p></div>
      <div class="flex flex-wrap gap-2">
        <RouterLink v-if="org.puede('datos.importar')" to="/configuracion/datos" class="btn-secundario"><Upload class="size-4" /> Importar</RouterLink>
        <button v-if="org.puede('datos.exportar') && org.tieneFuncion('exportacion')" class="btn-secundario" :disabled="!total || exportando" @click="exportar"><Download class="size-4" /> {{ exportando ? 'Generando…' : 'Exportar PDF' }}</button>
        <button v-if="org.puede('clientes.gestionar')" class="btn-primario" @click="formAbierto = true"><Plus class="size-4" /> Nuevo cliente</button>
      </div>
    </div>
    <div class="relative max-w-md">
      <Search class="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
      <input v-model="texto" class="entrada pl-9" placeholder="Nombre, DNI, teléfono o email" aria-label="Buscar clientes" />
    </div>
    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{{ error }}</p>
    <div class="tarjeta overflow-hidden">
      <Cargando v-if="cargando && !clientes.length" />
      <EstadoVacio v-else-if="!clientes.length" :icono="Users" :titulo="texto ? 'Sin resultados' : 'Todavía no hay clientes'"
                   :descripcion="texto ? 'Probá con otro nombre o teléfono.' : 'Cargalos a mano o importalos desde una planilla.'" />
      <template v-else>
        <table class="tabla">
          <thead class="bg-slate-50"><tr><th>Nombre</th><th class="hidden sm:table-cell">Teléfono</th><th class="hidden md:table-cell">Email</th><th class="hidden lg:table-cell">Origen</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="c in clientes" :key="c.id" class="cursor-pointer" @click="router.push({ name: 'cliente', params: { id: c.id } })">
              <td><RouterLink :to="{ name: 'cliente', params: { id: c.id } }" class="font-medium hover:underline" @click.stop>{{ c.nombre }}</RouterLink>
                <span v-if="c.es_ejemplo" class="ml-2 rounded bg-amber-50 px-1 text-[10px] text-amber-700">ejemplo</span>
                <span class="block text-xs text-slate-500 sm:hidden">{{ c.telefono }}</span></td>
              <td class="hidden sm:table-cell">{{ c.telefono || '—' }}</td>
              <td class="hidden md:table-cell">{{ c.email || '—' }}</td>
              <td class="hidden text-slate-500 lg:table-cell">{{ c.origen ? ORIGENES_CLIENTE[c.origen] : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="paginas > 1" class="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-sm">
          <button class="btn-fantasma btn-chico" :disabled="pagina === 0" @click="pagina--">Anterior</button>
          <span class="text-slate-500">Página {{ pagina + 1 }} de {{ paginas }}</span>
          <button class="btn-fantasma btn-chico" :disabled="pagina + 1 >= paginas" @click="pagina++">Siguiente</button>
        </div>
      </template>
    </div>
    <FormCliente v-model="formAbierto" @guardado="(id) => router.push({ name: 'cliente', params: { id } })" />
  </div>
</template>
