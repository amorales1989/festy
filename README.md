# Festy

SaaS multiempresa para administrar salones de eventos, quinchos y espacios de celebración. En español argentino, fechas DD/MM/AAAA, horario 24 h, moneda ARS y zona horaria configurable por organización.

**Stack:** Vue 3 · TypeScript · Vite · Tailwind CSS v4 · Pinia. Backend en el repo hermano [`Festy-back`](../Festy-back/README.md): API Node/Express que solo ejecuta stored procedures de PostgreSQL (RLS, pg_cron) y GoTrue para las sesiones.

El front usa `supabase-js` **solo para la autenticación**; todos los datos pasan por la API (`src/lib/api.ts`). Se despliega en Vercel (`vercel.json`); el backend y la base, en el VPS.

- Arquitectura, modelo de datos, matriz de permisos, planes, fases y riesgos: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Pendientes y limitaciones: [docs/PENDIENTES.md](docs/PENDIENTES.md)

## Qué incluye
- **Multiempresa**: cada organización es un tenant aislado por RLS; un usuario puede pertenecer a varias. Salones → sedes → espacios → recursos.
- **Usuarios**: registro, ingreso, recuperación de contraseña, invitaciones por enlace, 7 roles con permisos configurables, auditoría de cambios.
- **Panel**: eventos de hoy, próximas reservas, consultas, tentativas, contratos pendientes, cobros próximos, deuda vencida, ingresos, gastos, ocupación, fines de semana libres y tareas. Filtros por período, salón, sede y responsable.
- **Calendario**: mes, semana y día (columnas por espacio); estados, bloqueos, feriados, horarios, montaje/limpieza, eventos multi-día. La base impide superposiciones, también en concurrencia.
- **Reservas, clientes, cobros (plan de cuotas, señas, anulaciones), gastos y tareas.**
- **Onboarding** guiado, datos de ejemplo removibles, checklist de configuración, importación desde planillas CSV, exportación en PDF (listados e informe completo) y baja controlada de la cuenta (30 días de gracia).

## Ventas
- **Catálogo de servicios** (paquetes, servicios y adicionales, por evento, por persona, por hora o por unidad).
- **Presupuestos** con ítems del catálogo, descuento, plan de pagos, vigencia y condiciones; PDF con logo y color del salón; envío por WhatsApp; al aceptarlo se crea el evento con sus cuotas.
- **Entrevistas** con clientes o con contactos nuevos, en la agenda y en el Inicio, con recordatorio por WhatsApp.
- **Capacidad**: máximo (la base no deja superarlo) y mínimo de invitados por espacio (aviso).
- **Servicios contratados**: el evento guarda lo que se vendió; los **adicionales** pedidos después suman al total y pueden generar su propia cuota.
- **Depósitos de garantía**: se piden, se cobran y se devuelven (completos o con retención por daños y su motivo), con recibo y constancia en PDF. No cuentan como ingresos ni como pago del evento.
- **Comprobantes de pago** numerados para cada seña, cuota o saldo, con el monto en letras y el saldo pendiente.
- **Caja por cuenta**: efectivo, banco, Mercado Pago y las que agregues, con saldo inicial; cada cobro, gasto y garantía va a una cuenta (la elegida o la del medio de pago); transferencias entre cuentas; movimientos y saldos en PDF.
- **Proveedores y rentabilidad**: costos por evento (con proveedor, o desde el costo del catálogo), pagos parciales que se registran como gasto, cuánto falta pagar a cada proveedor y la ganancia y el margen de cada evento y del período.
- **Página web del salón** (`/s/<dirección>`): presentación, espacios, calendario de días libres y «Pedí tu fecha». El pedido entra como consulta (no bloquea la fecha), avisa al equipo y ofrece seguir por WhatsApp.
- **Notificaciones** en la campana (web y app) y push en Android (ver [docs/APP_ANDROID.md](docs/APP_ANDROID.md)).

## App Android
`pnpm apk:dev` genera un APK de prueba que usa el Supabase local por Wi-Fi. Para producción, push con Firebase y firma de la app, ver [docs/APP_ANDROID.md](docs/APP_ANDROID.md).

## Desarrollo local
Requisitos: Node 22+, pnpm, Docker y Supabase CLI.

```bash
pnpm install
(cd ../Festy-back && npm install && supabase start)   # Auth 64321 · DB 64322 · Studio 64323 · Mailpit 64324
pnpm api                       # API de Festy en http://localhost:4000 (en otra terminal)
cp .env.example .env.local     # VITE_AUTH_KEY = clave publishable de `supabase status`; VITE_API_URL ya apunta a la API local
pnpm dev                       # http://localhost:5173
```
Los puertos 643xx evitan conflictos con otros proyectos Supabase locales. Crear una cuenta en `/registro` lleva al onboarding.

## Pruebas
```bash
pnpm test               # unitarias (Vitest): fechas/zonas, montos, errores, agenda
pnpm test:db            # pgTAP (en Festy-back): aislamiento, permisos, superposición, cobros, garantías y capa de stored procedures
pnpm test:concurrencia  # dos transacciones reales compitiendo por el mismo espacio
npx playwright test     # punta a punta en Chrome contra la API local (requiere `pnpm api`): registro → onboarding → panel → calendario → reserva → conflicto → seña → invitación con permisos → celular
pnpm typecheck && pnpm build
```

## Estructura
```
src/lib               cliente de la API, sesión (supabase-js), formato AR, errores, catálogos, PDF, plantillas CSV
src/stores            sesión, organización activa y permisos, acciones globales
src/components        UI base, calendario, formularios de reserva/cliente
src/views             auth, onboarding, panel, calendario, reservas, clientes, tareas, finanzas, configuración
e2e/                  Playwright
```
Después de cambiar el esquema: `pnpm db:tipos` regenera `src/tipos/database.ts`.
