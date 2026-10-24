# Festy · Arquitectura

Plataforma SaaS multiempresa para salones de eventos, quinchos, espacios de celebración y centros de convenciones en Argentina.

## 1. Decisiones técnicas

| Decisión | Elección | Motivo |
|---|---|---|
| Frontend | Vue 3 + TypeScript (estricto) + Vite + Tailwind CSS v4 | Pedido explícito; SPA rápida, tipada de punta a punta con los tipos generados de la base. |
| Estado | Pinia (sesión, organización activa, acciones globales) | Estado mínimo; los datos se piden a la base por vista. |
| Backend | API Node/Express (repo `Festy-back`) + PostgreSQL con stored procedures `api.sp_*` + GoTrue (Auth) en un VPS | Pedido explícito: el front no consulta tablas; la API solo ejecuta SP. Los SP corren con la identidad del usuario, así que la lógica crítica sigue en la base (RLS, triggers, reglas) y vale para cualquier cliente. PostgREST no se publica. |
| Autorización | RLS en **todas** las tablas + funciones `SECURITY DEFINER` con `exigir_permiso()` | “Nunca confiar en el frontend”: la interfaz solo oculta botones; la base decide. |
| Anti-superposición | Tabla `ocupaciones` con `EXCLUDE USING gist (espacio_id WITH =, rango WITH &&) WHERE (bloqueante)` | Garantiza que no haya dobles reservas incluso con transacciones concurrentes (probado con dos sesiones reales). |
| Fechas | `timestamptz` en UTC; la UI muestra e ingresa en la zona de la organización (`@date-fns/tz`) | Zona configurable por organización, independiente del navegador. Formato DD/MM/AAAA y 24 h con componentes propios. |
| Tareas programadas | `pg_cron` | Vencer tentativas (15 min), finalizar eventos (cada hora), purgar bajas (diario). |
| Privilegios | `auto_expose_new_tables = false` + `GRANT` explícitos | Ninguna tabla queda expuesta por accidente. |
| Pruebas | pgTAP (base), script de concurrencia, Vitest (lógica), Playwright (punta a punta) | Cada capa se prueba donde vive su lógica. |
| Exportaciones | PDF generado en el navegador (jsPDF + autotable, carga diferida) | Pedido del negocio: todo lo exportable sale en PDF con encabezado, totales y numeración. La plantilla de importación sigue en CSV porque es un archivo para completar y cargar, no una exportación. |

### Por qué la lógica está en la base
Las reglas que no pueden fallar (aislamiento entre empresas, permisos, superposición, capacidad, inmutabilidad de cobros, límites del plan) se implementaron como restricciones, triggers y políticas. Una app móvil, una integración o un script futuro las heredan sin reimplementarlas.

## 2. Modelo de datos

```
organizaciones (tenant) ── plan_clave → planes
 ├─ roles ── rol_permisos → permisos (catálogo)
 ├─ membresias (usuario ↔ organización, con rol)      perfiles (1:1 auth.users)
 ├─ invitaciones (token, vence 7 días)
 ├─ salones (marca) ── sucursales (sede física) ── espacios ── espacio_horarios
 │                                   └─ recursos
 ├─ feriados (organizacion_id null = nacional)
 ├─ clientes
 ├─ reservas ── reserva_espacios ──┐
 │    ├─ cuotas (plan de pagos)     ├─→ ocupaciones (derivada; EXCLUDE)
 │    ├─ pagos (inmutables, se anulan)
 │    └─ tareas                     │
 ├─ bloqueos ───────────────────────┘
 ├─ gastos
 └─ auditoria (solo lectura, sin FK para conservar la traza)
```

Puntos clave:
- **Claves foráneas compuestas** `(organizacion_id, id)`: es imposible relacionar filas de dos organizaciones aunque alguien conozca un UUID ajeno.
- **Estados de reserva**: `consulta` (no bloquea) → `tentativa` (bloquea, vence sola) → `senada` → `confirmada` → `finalizada`; `cancelada` libera la fecha.
- **Ocupación real** = evento + preparación/montaje antes + desmontaje/limpieza después (configurable por espacio y ajustable por reserva).
- **Saldos** (`v_reservas_saldo`, `v_cuotas_estado`): vistas `security_invoker`; la deuda vencida aplica los cobros a las cuotas por orden de vencimiento (FIFO).
- **Numeración** correlativa por organización (`#1`, `#2`…), con bloqueo de fila.
- **Datos de ejemplo** marcados con `es_ejemplo`, removibles sin tocar datos reales.

Migraciones: `Festy-back/supabase/migrations/` (base multiempresa, sedes, reservas y agenda, auditoría, funciones de negocio, horarios, ventas, garantías y la capa de stored procedures `api`).

## 3. Matriz de permisos (roles iniciales)

Los permisos de cada rol son **configurables** desde *Configuración → Roles y permisos*, salvo los del Propietario, que son inmutables. La base garantiza que siempre exista al menos un propietario activo.

| Permiso | Propietario | Administrador | Recepción | Vendedor | Finanzas | Coordinador | Operativo |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| organizacion.editar | ✔ | ✔ | | | | | |
| organizacion.eliminar (baja) | ✔ | | | | | | |
| plan.gestionar | ✔ | | | | | | |
| usuarios.gestionar / roles.gestionar | ✔ | ✔ | | | | | |
| auditoria.ver | ✔ | ✔ | | | | | |
| sedes.gestionar | ✔ | ✔ | | | | | |
| calendario.ver | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| bloqueos.gestionar | ✔ | ✔ | | | | ✔ | |
| clientes.ver | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| clientes.gestionar | ✔ | ✔ | ✔ | ✔ | | | |
| reservas.ver | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| reservas.crear | ✔ | ✔ | ✔ | ✔ | | | |
| reservas.editar | ✔ | ✔ | ✔ | ✔ | | ✔ | |
| reservas.cancelar / eliminar | ✔ | ✔ | | | | | |
| contratos.gestionar | ✔ | ✔ | | ✔ | ✔ | | |
| pagos.ver | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| pagos.registrar | ✔ | ✔ | ✔ | | ✔ | | |
| pagos.anular | ✔ | ✔ | | | ✔ | | |
| gastos.ver / gestionar | ✔ | ✔ | | | ✔ | | |
| tareas.ver | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| tareas.gestionar | ✔ | ✔ | | | | ✔ | (solo estado de las propias) |
| datos.exportar | ✔ | ✔ | | | ✔ | | |
| datos.importar | ✔ | ✔ | | | | | |

Reglas de campo aplicadas por triggers: quien solo puede cancelar o gestionar contratos no puede editar otros campos de la reserva; el personal operativo solo cambia el estado de sus tareas; los cobros no se editan ni se borran (solo se anulan con motivo).

## 4. Funcionalidades por plan

**Plan único.** Festy se vende con un solo plan y se cobra por fuera de la app. Toda organización tiene todas las funciones (calendario, reservas, clientes, cobros, tareas, panel, gastos, importación, exportación, auditoría, varios salones y roles personalizados) y no hay límites de sedes, espacios ni usuarios. No hay período de prueba ni pantalla de planes.

La estructura de planes de la base se conserva con un único plan activo (`festy`, migración 12), por si en el futuro se reabren planes con límites: los triggers de límites siguen existiendo y no se disparan porque el plan no tiene límites.

## 5. Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| 0. Fundaciones | Multiempresa, auth, invitaciones, roles y permisos, RLS, auditoría, planes y límites, onboarding, datos de ejemplo, importación/exportación, baja de cuenta | **Hecho** |
| 1. Panel principal (Módulo 1) | Indicadores reales con filtros por período, salón, sede y responsable; acceso al detalle | **Hecho** |
| 2. Calendario y disponibilidad (Módulo 2) | Vistas mes/semana/día (día por espacio), estados, bloqueos, horarios, tiempos operativos, feriados, eventos multi-día, anti-superposición en la base | **Hecho** |
| Soporte de 1 y 2 | Reservas (alta/edición, estados, plan de cuotas, cobros, anulaciones, historial), clientes, tareas, cobros, gastos | **Hecho (MVP)** |
| 3. Contratos | Plantillas, generación PDF, firma electrónica, adjuntos | Pendiente (hoy: estado del contrato) |
| 4. Cobranza online | Mercado Pago (links de pago, webhooks), facturación electrónica AFIP/ARCA | Pendiente |
| 5. Comunicación | Emails transaccionales (invitaciones, recordatorios), WhatsApp | Pendiente |
| 6. Operación avanzada | Reserva de recursos con stock por fecha, presupuestos y catálogo de servicios, permisos por sede | Pendiente |
| 7. Facturación SaaS | El cobro se hace por fuera de la app (plan único). Pendiente si se necesita: suspender cuentas que no pagan | Fuera de la app |

## 6. Riesgos

| Riesgo | Impacto | Mitigación actual / pendiente |
|---|---|---|
| Fuga de datos entre empresas | Crítico | RLS en las 25 tablas, FKs compuestas, pruebas pgTAP de aislamiento. Pendiente: auditoría externa de seguridad antes del lanzamiento. |
| Doble reserva | Crítico | Restricción EXCLUDE + prueba de concurrencia real. |
| Tentativas que no vencen si pg_cron no corre | Medio | pg_cron configurado en la migración; si no está disponible la migración avisa. Monitorear el job. |
| Feriados trasladables mal cargados | Bajo | Solo se precargan los inamovibles de 2026; el resto lo carga cada organización. Pendiente: actualizar anualmente según decreto. |
| Invitaciones sin email automático | Medio | Hoy se comparte el enlace. Pendiente: SMTP propio en Supabase (ver PENDIENTES). |
| Rendimiento del panel con muchos datos | Medio | Índices por organización y fecha; `panel_resumen` limita el período a 1 año. Pendiente: pruebas de carga. |
| Cobro fuera de la app | Comercial | Si un cliente deja de pagar, hoy no hay una forma de suspender su cuenta desde la app (ver PENDIENTES). |
| Copias de seguridad | Alto | Dependen de la infraestructura (Supabase Pro: backups diarios + PITR). Informe PDF completo por organización disponible (no reemplaza un backup: no sirve para reimportar). |
| Purga irreversible de cuentas | Alto | 30 días de gracia, confirmación escribiendo el nombre, aviso permanente en la interfaz. |

## 7. Decisiones de experiencia de usuario

Basadas en la comparación con software del rubro (13/10/2026):
- **Brinden** (Argentina, salones y quinchos): flujo de 3 etapas *presupuestado → señado → reservado*, agenda con doble reserva detectada y foco en la facilidad de uso.
- **Perfect Venue**: todo gira en torno al evento y al calendario; promete uso “casi sin capacitación”.
- **Tripleseat**: el más completo, pero criticado por exceso de funciones, curva de aprendizaje y configuración larga. Es el anti-modelo.

Cómo se aplicó:
| Antes | Ahora |
|---|---|
| Panel con 10 indicadores y filtros siempre visibles | Inicio con saludo, **HOY**, 4 números y una lista **Para hacer** con acciones concretas (“Pedir la seña…”, “Cobrar $X atrasados”); filtros plegados |
| 8 secciones en el menú, con jerga (“Reservas”, “Calendario”, “Configuración”) | Inicio · Agenda · Eventos · Clientes · Plata (cobros + gastos) · Tareas · Ajustes; barra inferior con botón “+” en el celular |
| 6 estados técnicos (“Tentativa”, “Finalizada”) | Lenguaje simple: Consulta · Fecha retenida · Señada · Confirmada · Realizado · Cancelado, con explicación en una línea |
| Formulario de reserva con ~15 campos en dos columnas | Tres pasos (*¿Para quién? ¿Cuándo y dónde? ¿Qué evento?*), estado con 3 botones grandes, el resto en “Más opciones”; el nombre del evento se completa solo |
| Ficha del evento sin guía | Aviso **Próximo paso** con el botón para resolverlo (seña, contrato, saldo, confirmar) |
| Calendario con muchos controles; en celular, vista horaria | Vista **Lista** por defecto en el celular; tocar un día muestra qué hay y “Reservar este día”; filtros de estado plegados; “Bloqueo” pasa a “Cerrar fechas” |

Los nombres internos (tablas, enums, permisos) no cambiaron: solo la capa de presentación.
