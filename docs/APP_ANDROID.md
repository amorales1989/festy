# App Android (APK) y notificaciones push

La app Android es **la misma aplicación web** empaquetada con Capacitor 8: un solo código para la web y el teléfono.
La web sigue funcionando igual. En la app se suman:
- **Compartir archivos**: los PDF (presupuestos, comprobantes, listados) se guardan en el teléfono y se abre el menú «Compartir» de Android (WhatsApp, Gmail, Drive…).
- **Notificaciones push**: requieren Firebase (ver abajo).
- Ícono, pantalla de inicio, botón «atrás» de Android y respeto de las barras del sistema.

## Requisitos para compilar
- Node 22 y pnpm.
- **Java 21**. En esta máquina se descargó en `~/.local/share/jdk21-descarga/jdk-21…`; el Java del sistema es 17 y Capacitor 8 no lo acepta.
- Android SDK en `~/Android/Sdk`. Ojo: tu variable `ANDROID_HOME` apunta a `~/Android/sdk` (minúscula), que no existe. Se usa `android/local.properties`.

```bash
export JAVA_HOME=$(ls -d ~/.local/share/jdk21-descarga/jdk-21*)
export ANDROID_HOME=$HOME/Android/Sdk
```

## APK de prueba (red local)
Usa la autenticación y la API de tu computadora a través del Wi-Fi.
1. `(cd ../Festy-back && supabase start)` y `pnpm api` con `ORIGENES_PERMITIDOS` incluyendo `https://localhost` (la app Android usa ese origen; ya está en `.env.example` del back).
2. Revisar `.env.android.local`: tiene la IP de tu computadora (`http://192.168.100.13:64321` y `VITE_API_URL=http://192.168.100.13:4000/api`). Si cambia la IP, actualizala. La API escucha en todas las interfaces, así que el teléfono la alcanza por Wi-Fi.
3. `pnpm apk:dev`. El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`; también hay una copia en `apk/festy-prueba-red-local.apk`.
4. Pasalo al teléfono e instalalo (permitir «instalar apps desconocidas»), o usá `adb install -r apk/festy-prueba-red-local.apk`.
5. El teléfono tiene que estar en **el mismo Wi-Fi** que la computadora.

`CAP_DESARROLLO=1` habilita HTTP sin cifrar **solo** para esta prueba local.

## APK para clientes (producción)
1. Backend desplegado en el VPS (ver `Festy-back/README.md`).
2. Crear `.env.android` a partir de `.env.android.example`, con la URL `https://api.tudominio.com`, la `ANON_KEY` y `VITE_API_URL=https://api.tudominio.com/api`.
3. Crear una clave de firma **una sola vez** y guardarla bien: si se pierde, no se puede actualizar la app.
   ```bash
   keytool -genkey -v -keystore festy.keystore -alias festy -keyalg RSA -keysize 2048 -validity 10000
   ```
4. `pnpm build:android` y después, en Android Studio: *Build → Generate Signed App Bundle / APK*. Para Google Play se sube un **AAB**; para repartir directo, un **APK** firmado.

## Notificaciones push (Firebase)
El código está listo pero **no se probó de punta a punta**: hace falta un proyecto de Firebase, y eso lo tenés que crear vos.

Cómo funciona: cuando pasa algo (cobro registrado, evento o entrevista asignada, presupuesto aceptado) o con los recordatorios diarios de las 9:00 (cuotas que vencen, entrevistas del día, fechas retenidas por liberarse, tareas), la base crea una **notificación** que se ve en la campana de la app y de la web. Cada minuto, la API de Festy (`Festy-back/src/servicios/pushServicio.js`) toma las notificaciones pendientes y las manda por FCM a los teléfonos de esa persona. Al tocarla, se abre la pantalla correspondiente.

Pasos:
1. En [Firebase](https://console.firebase.google.com) crear un proyecto y agregar una **app Android** con el paquete `com.festy.app`.
2. Descargar `google-services.json` y copiarlo a `android/app/google-services.json`.
3. En `.env.android` poner `VITE_PUSH_HABILITADO=true` y recompilar la app. **Sin el archivo del paso 2 no lo actives**, porque la app se cerraría al intentar registrarse.
4. En Firebase → Configuración del proyecto → Cuentas de servicio → **Generar nueva clave privada** (un archivo JSON).
5. En el VPS, pegar ese JSON **en una sola línea** en `FIREBASE_SERVICE_ACCOUNT` de `Festy-back/despliegue/.env` y reiniciar la API: `docker compose up -d api`. El log dice «Envío de push programado cada minuto».
6. Probar: ingresar en la app desde un teléfono, aceptar el permiso de notificaciones y registrar un cobro desde **otro** usuario. La persona que hace la acción no recibe su propio aviso.

## Qué se probó
- Compilación del APK (Capacitor 8, Android 16 / API 36 como objetivo, mínimo Android 7).
- En el emulador (Android 11): login contra Supabase, Inicio, presupuesto, PDF con el menú «Compartir», aceptar un presupuesto (crea el evento con su plan de cuotas), registrar la seña y generar el comprobante, y márgenes de las barras del sistema.
- Push: solo la parte de la base (notificaciones, dispositivos, recordatorios), con pruebas pgTAP. La entrega real por FCM está pendiente de las credenciales de Firebase.
