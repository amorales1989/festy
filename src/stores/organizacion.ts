// Organización activa del usuario, sus permisos y el catálogo de sedes.
// Los permisos se usan para adaptar la interfaz; la autorización real la hace
// la base de datos (stored procedures + RLS) detrás de la API.
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Fila } from '@/lib/supabase'
import { api, rutaOrg } from '@/lib/api'
import { ZONA_POR_DEFECTO } from '@/lib/formato'
import { useSesion } from './sesion'

const CLAVE_ORG = 'festy.organizacion'

export type Organizacion = Fila<'organizaciones'>
export type Salon = Fila<'salones'>
export type Sucursal = Fila<'sucursales'>
export type Espacio = Fila<'espacios'>

export const useOrganizacion = defineStore('organizacion', () => {
  const organizaciones = ref<Organizacion[]>([])
  const actual = ref<Organizacion | null>(null)
  const permisos = ref<Set<string>>(new Set())
  const rol = ref<string | null>(null)
  const salones = ref<Salon[]>([])
  const sucursales = ref<Sucursal[]>([])
  const espacios = ref<Espacio[]>([])
  const plan = ref<Fila<'planes'> | null>(null)
  const cargado = ref(false)
  /** Empresas del usuario suspendidas por la administración (no se pueden usar). */
  const suspendidas = ref<Array<{ id: string; nombre: string; motivo: string | null; suspendida_at: string }>>([])

  const id = computed(() => actual.value?.id ?? '')
  const zona = computed(() => actual.value?.zona_horaria ?? ZONA_POR_DEFECTO)
  const espaciosActivos = computed(() => espacios.value.filter((e) => e.activo))
  const sucursalesActivas = computed(() => sucursales.value.filter((s) => s.activo))
  const tieneSedes = computed(() => espaciosActivos.value.length > 0)

  function puede(permiso: string): boolean {
    return permisos.value.has(permiso)
  }
  function tieneFuncion(funcion: string): boolean {
    return plan.value?.funciones.includes(funcion) ?? false
  }

  interface Contexto {
    organizacion: Organizacion
    permisos: string[]
    rol: string | null
    plan: Fila<'planes'> | null
    salones: Salon[]
    sucursales: Sucursal[]
    espacios: Espacio[]
  }

  async function cargarOrganizaciones() {
    const data = await api.get<Organizacion[]>('/organizaciones')
    organizaciones.value = data
    suspendidas.value = data.length ? [] : await api.get<typeof suspendidas.value>('/empresas-suspendidas').catch(() => [])
    const sesion = useSesion()
    const preferida = localStorageSeguro.get(CLAVE_ORG) ?? sesion.perfil?.organizacion_actual
    const elegida = data.find((o) => o.id === preferida) ?? data[0] ?? null
    if (elegida) await seleccionar(elegida.id)
    else limpiar()
    cargado.value = true
  }

  // Organización, permisos, rol, plan y sedes en una sola llamada.
  async function cargarContexto(orgId: string) {
    const c = await api.get<Contexto>(rutaOrg(orgId, 'contexto'))
    actual.value = c.organizacion
    organizaciones.value = organizaciones.value.map((o) => (o.id === orgId ? c.organizacion : o))
    permisos.value = new Set(c.permisos)
    rol.value = c.rol
    plan.value = c.plan
    salones.value = c.salones
    sucursales.value = c.sucursales
    espacios.value = c.espacios
  }

  async function seleccionar(orgId: string) {
    const org = organizaciones.value.find((o) => o.id === orgId)
    if (!org) return
    actual.value = org
    localStorageSeguro.set(CLAVE_ORG, orgId)
    await cargarContexto(orgId)
    const sesion = useSesion()
    if (sesion.usuario && sesion.perfil?.organizacion_actual !== orgId) {
      void api.put('/perfil/organizacion', { organizacion_id: orgId }).catch(() => {})
    }
  }

  async function cargarSedes(orgId = id.value) {
    if (orgId) await cargarContexto(orgId)
  }

  async function refrescarActual() {
    if (id.value) await cargarContexto(id.value)
  }

  function limpiar() {
    actual.value = null
    permisos.value = new Set()
    rol.value = null
    salones.value = []
    sucursales.value = []
    espacios.value = []
    plan.value = null
  }

  function reiniciar() {
    limpiar()
    organizaciones.value = []
    cargado.value = false
  }

  return {
    organizaciones, actual, permisos, rol, salones, sucursales, espacios, plan, cargado, suspendidas,
    id, zona, espaciosActivos, sucursalesActivas, tieneSedes,
    puede, tieneFuncion, cargarOrganizaciones, seleccionar, cargarSedes, refrescarActual, reiniciar,
  }
})

// localStorage puede no estar disponible (modo privado, bloqueos): nunca debe romper la app.
const localStorageSeguro = {
  get(clave: string): string | null {
    try { return localStorage.getItem(clave) } catch { return null }
  },
  set(clave: string, valor: string) {
    try { localStorage.setItem(clave, valor) } catch { /* sin persistencia */ }
  },
}
