# Pendientes y limitaciones conocidas

Lo que **no** está hecho o depende de configuración externa. Nada de esto se simula en la app.

## Requiere credenciales o configuración externa
- **Email transaccional (SMTP)**: en local se usa Mailpit (http://127.0.0.1:64324). En el VPS hay que completar `SMTP_*` en `Festy-back/despliegue/.env` para confirmación de cuenta y recuperación de contraseña (mientras tanto `AUTOCONFIRMAR_EMAIL=true`). Las **invitaciones** generan un enlace que hoy se copia y comparte a mano; el envío automático requiere agregar el envío de mails a la API.
- **Mercado Pago**: ni el cobro de la suscripción ni los links de pago a clientes están integrados. El cambio de plan modifica límites sin cobrar (se avisa en pantalla).
- **Facturación electrónica (ARCA/AFIP)**: no implementada.
- **Copias de seguridad**: en el VPS, `despliegue/scripts/respaldo.sh` (pg_dump con retención) — falta programarlo en el cron del VPS y copiar los respaldos fuera del servidor. La app ofrece el informe completo en PDF por organización.
- **Confirmación de email**: deshabilitada en local (`enable_confirmations = false`). Activarla en producción.

- **Push en Android**: falta crear el proyecto de Firebase y cargar sus credenciales (pasos en docs/APP_ANDROID.md). El envío desde la API no se pudo probar sin esas credenciales.
- **Despliegue real en el VPS y en Vercel**: el stack de producción se probó completo en esta computadora (mismo docker-compose), pero no en el VPS ni con dominio y certificado reales.
- **Límite de pedidos (rate limiting) en la API**: no implementado; conviene agregarlo en Caddy o en Express antes de abrir el registro al público.
- **Firma de la app para clientes y Google Play**: hay que generar y guardar la clave de firma.
- **Push en la web** (navegador): no implementado. En la web los avisos se ven en la campana.
- **iPhone (iOS)**: no se generó el proyecto. Requiere una Mac y una cuenta de Apple Developer.

## Funcionalidad pendiente (próximas fases)
- Contratos: plantillas, PDF y firma. Hoy solo se gestiona el estado del contrato.
- Rentabilidad por evento: el catálogo ya guarda el costo de cada servicio, pero falta el reporte de ganancia y el registro de proveedores.
- Página web pública del salón con pedido de fecha.
- Reserva de **recursos** con stock por fecha (hoy los recursos son un inventario por sede).
- Presupuestos y catálogo de servicios/adicionales.
- Restricción de usuarios a sedes específicas (hoy un usuario ve todas las sedes de su organización).
- Roles personalizados nuevos desde la interfaz (la base ya lo soporta para el plan Empresa; falta la pantalla de alta).
- Recordatorios automáticos (cuotas por vencer, tentativas por vencer) por email/WhatsApp.
- Feriados trasladables 2026 y años siguientes: cargar según el decreto anual.
- Edición de un horario con varios tramos por día (la base lo soporta; la interfaz edita uno por día).

## Decisiones a validar con negocio
- Garantías: lo retenido por daños se informa como "retenido" pero no se suma a los ingresos del panel. Si se quiere contabilizar como ingreso, hay que definir cómo.
- Si el cliente tiene saldo atrasado y además una garantía en custodia, la app no la compensa sola: se decide al registrar la devolución (reteniendo y anotando el motivo).
- Exportaciones solo en PDF: sirven para leer, imprimir y archivar, pero no para pasar los datos a otro sistema ni para restaurarlos. Si hiciera falta portabilidad (por ejemplo, por un pedido de un cliente o una migración), habría que sumar una exportación en formato de datos (CSV/JSON).
- Precios de los planes (hoy en 0).
- Feriados: informan pero **no bloquean** la fecha (para no bloquear salones que trabajan feriados). Para cerrar, se crea un bloqueo.
- Horario de atención: reservar fuera de horario muestra un aviso, no lo impide.
- Un evento nocturno que termina antes del mediodía no cuenta como ocupación del día siguiente para disponibilidad y % de ocupación (la agenda horaria sí muestra la madrugada ocupada y la restricción de superposición la respeta).
