# Demo pública por túnel (desde esta computadora)

Sirve para mostrarle Festy a un cliente sin contratar hosting. La app, la autenticación y la API de Festy salen por **un solo enlace https** (Cloudflare Quick Tunnel).

## Levantarla
```bash
(cd ../Festy-back && supabase start)   # si no está corriendo
pnpm api                       # API de Festy en :4000 (dejar abierto)
pnpm demo                      # (opcional) recrea la cuenta demo con datos frescos
pnpm demo:build                # build de producción en modo "mismo origen"
pnpm demo:servir               # sirve en http://localhost:4173 con proxy a la autenticación y a la API (dejar abierto)
pnpm demo:tunel                # en otra terminal: imprime https://<algo>.trycloudflare.com
```
Para entrar: `demo@festy.local` / `demo1234`. Para mostrar permisos, también están `recepcion@`, `finanzas@` y `operativo@demo.festy.local`, con la misma contraseña.

## Límites
- Funciona **solo mientras esta computadora esté prendida**, sin suspender, y con los cuatro procesos corriendo.
- **El enlace cambia** cada vez que se reinicia el túnel. Los túneles rápidos de Cloudflare no garantizan disponibilidad: son para demos, no para clientes reales.
- Cualquiera con el enlace puede crear una cuenta. Los datos quedan en la base local.

## Seguridad
El Supabase local usa claves de desarrollo conocidas públicamente. Por eso el proxy (`vite.config.ts → preview.proxy`):
- Expone solo `/auth/v1` (GoTrue) y `/api` (API de Festy, solo stored procedures). No expone PostgREST, Studio ni la base de datos.
- **Rechaza** con 403 todo pedido con la clave secreta o con un token de rol `service_role`.

Lo demás pasa por la RLS normal de la app. Verificado: la clave secreta y el token de administrador reciben 403, y un visitante anónimo no puede leer tablas.

## Para algo permanente
Backend y base en el VPS y front en Vercel: ver la sección «Despliegue en el VPS» de `Festy-back/README.md`.
