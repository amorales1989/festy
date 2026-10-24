import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useSesion } from '@/stores/sesion'
import { useOrganizacion } from '@/stores/organizacion'
import { useNotificaciones } from '@/composables/useNotificaciones'

declare module 'vue-router' {
  interface RouteMeta {
    publica?: boolean
    /** Accesible con o sin sesión (p. ej. invitaciones, nueva contraseña). */
    libre?: boolean
    sinOrganizacion?: boolean
    permiso?: string
    titulo?: string
  }
}

const REGISTRO_PUBLICO = import.meta.env.VITE_REGISTRO_PUBLICO === 'true'

const rutas: RouteRecordRaw[] = [
  { path: '/ingresar', component: () => import('@/views/auth/Ingresar.vue'), meta: { publica: true, titulo: 'Ingresar' } },
  // El registro público está cerrado en producción: las cuentas las crea la administración de Festy.
  { path: '/registro', component: () => import('@/views/auth/Registro.vue'), meta: { publica: true, titulo: 'Crear cuenta' },
    beforeEnter: () => (REGISTRO_PUBLICO ? true : { path: '/ingresar' }) },
  { path: '/recuperar', component: () => import('@/views/auth/RecuperarClave.vue'), meta: { publica: true, titulo: 'Recuperar contraseña' } },
  { path: '/nueva-clave', component: () => import('@/views/auth/NuevaClave.vue'), meta: { libre: true, titulo: 'Nueva contraseña' } },
  { path: '/s/:slug', name: 'pagina-salon', component: () => import('@/views/publico/PaginaSalon.vue'), meta: { libre: true, titulo: 'Pedí tu fecha' } },
  { path: '/invitacion/:token', component: () => import('@/views/auth/Invitacion.vue'), meta: { libre: true, titulo: 'Invitación' } },
  { path: '/plataforma', name: 'plataforma', component: () => import('@/views/plataforma/Plataforma.vue'), meta: { sinOrganizacion: true, titulo: 'Administración de Festy' } },
  { path: '/bienvenida', component: () => import('@/views/onboarding/Bienvenida.vue'), meta: { sinOrganizacion: true, titulo: 'Bienvenida' } },
  {
    path: '/',
    component: () => import('@/layouts/LayoutApp.vue'),
    children: [
      { path: '', name: 'panel', component: () => import('@/views/panel/Panel.vue'), meta: { titulo: 'Inicio' } },
      { path: 'calendario', name: 'calendario', component: () => import('@/views/calendario/Calendario.vue'), meta: { permiso: 'calendario.ver', titulo: 'Agenda' } },
      { path: 'reservas', name: 'reservas', component: () => import('@/views/reservas/ReservasLista.vue'), meta: { permiso: 'reservas.ver', titulo: 'Eventos' } },
      { path: 'reservas/:id', name: 'reserva', component: () => import('@/views/reservas/ReservaDetalle.vue'), meta: { permiso: 'reservas.ver', titulo: 'Evento' } },
      { path: 'presupuestos', name: 'presupuestos', component: () => import('@/views/ventas/PresupuestosLista.vue'), meta: { permiso: 'presupuestos.ver', titulo: 'Presupuestos' } },
      { path: 'presupuestos/nuevo', name: 'presupuesto-nuevo', component: () => import('@/views/ventas/PresupuestoEditor.vue'), meta: { permiso: 'presupuestos.gestionar', titulo: 'Nuevo presupuesto' } },
      { path: 'presupuestos/:id', name: 'presupuesto', component: () => import('@/views/ventas/PresupuestoEditor.vue'), meta: { permiso: 'presupuestos.ver', titulo: 'Presupuesto' } },
      { path: 'catalogo', name: 'catalogo', component: () => import('@/views/ventas/Catalogo.vue'), meta: { permiso: 'presupuestos.ver', titulo: 'Catálogo de servicios' } },
      { path: 'clientes', name: 'clientes', component: () => import('@/views/clientes/ClientesLista.vue'), meta: { permiso: 'clientes.ver', titulo: 'Clientes' } },
      { path: 'clientes/:id', name: 'cliente', component: () => import('@/views/clientes/ClienteDetalle.vue'), meta: { permiso: 'clientes.ver', titulo: 'Cliente' } },
      { path: 'estadisticas', name: 'estadisticas', component: () => import('@/views/estadisticas/Estadisticas.vue'), meta: { permiso: 'reservas.ver', titulo: 'Estadísticas' } },
      { path: 'tareas', name: 'tareas', component: () => import('@/views/tareas/Tareas.vue'), meta: { permiso: 'tareas.ver', titulo: 'Tareas' } },
      { path: 'cobros', name: 'cobros', component: () => import('@/views/finanzas/Cobros.vue'), meta: { permiso: 'pagos.ver', titulo: 'Cobros' } },
      { path: 'garantias', name: 'garantias', component: () => import('@/views/finanzas/Garantias.vue'), meta: { permiso: 'pagos.ver', titulo: 'Garantías' } },
      { path: 'gastos', name: 'gastos', component: () => import('@/views/finanzas/Gastos.vue'), meta: { permiso: 'gastos.ver', titulo: 'Gastos' } },
      { path: 'caja', name: 'caja', component: () => import('@/views/finanzas/Caja.vue'), meta: { permiso: 'caja.ver', titulo: 'Caja' } },
      { path: 'proveedores', name: 'proveedores', component: () => import('@/views/finanzas/Proveedores.vue'), meta: { permiso: 'gastos.ver', titulo: 'Proveedores' } },
      { path: 'rentabilidad', name: 'rentabilidad', component: () => import('@/views/finanzas/Rentabilidad.vue'), meta: { permiso: 'gastos.ver', titulo: 'Rentabilidad' } },
      {
        path: 'configuracion',
        component: () => import('@/views/configuracion/Configuracion.vue'),
        children: [
          { path: '', redirect: { name: 'config-organizacion' } },
          { path: 'organizacion', name: 'config-organizacion', component: () => import('@/views/configuracion/Organizacion.vue'), meta: { titulo: 'Organización' } },
          { path: 'sedes', name: 'config-sedes', component: () => import('@/views/configuracion/Sedes.vue'), meta: { titulo: 'Sedes y espacios' } },
          { path: 'pagina', name: 'config-pagina', component: () => import('@/views/configuracion/PaginaPublica.vue'), meta: { titulo: 'Página web' } },
          { path: 'feriados', name: 'config-feriados', component: () => import('@/views/configuracion/Feriados.vue'), meta: { titulo: 'Feriados' } },
          { path: 'usuarios', name: 'config-usuarios', component: () => import('@/views/configuracion/Usuarios.vue'), meta: { permiso: 'usuarios.gestionar', titulo: 'Usuarios' } },
          { path: 'roles', name: 'config-roles', component: () => import('@/views/configuracion/Roles.vue'), meta: { titulo: 'Roles y permisos' } },
          { path: 'auditoria', name: 'config-auditoria', component: () => import('@/views/configuracion/Auditoria.vue'), meta: { permiso: 'auditoria.ver', titulo: 'Auditoría' } },
          { path: 'datos', name: 'config-datos', component: () => import('@/views/configuracion/Datos.vue'), meta: { titulo: 'Datos y cuenta' } },
        ],
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes: rutas,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const sesion = useSesion()
  await sesion.iniciar()

  if (to.meta.libre) return true
  if (to.meta.publica) return sesion.autenticado ? { path: '/' } : true
  if (!sesion.autenticado) return { path: '/ingresar', query: to.fullPath !== '/' ? { volver: to.fullPath } : {} }

  const org = useOrganizacion()
  if (!org.cargado) {
    try {
      await org.cargarOrganizaciones()
    } catch (e) {
      useNotificaciones().error(e)
    }
  }
  if (to.name === 'plataforma' && !sesion.esAdminPlataforma) return { path: '/' }
  if (to.meta.sinOrganizacion) return true
  if (!org.actual) return sesion.esAdminPlataforma ? { name: 'plataforma' } : { path: '/bienvenida' }

  if (to.meta.permiso && !org.puede(to.meta.permiso)) {
    useNotificaciones().info('No tenés permiso para ver esa sección.')
    return to.name === 'panel' ? true : { name: 'panel' }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.titulo ? `${to.meta.titulo} · Festy` : 'Festy'
})
