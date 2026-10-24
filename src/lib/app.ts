// Integración con la app Android (Capacitor). En la web todas estas funciones no hacen nada.
import type { Router } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { api } from './api'

let tokenActual: string | null = null

/** Botón "atrás" de Android, barra de estado y apertura de notificaciones. */
export async function iniciarApp(router: Router) {
  if (!Capacitor.isNativePlatform()) return
  const [{ App }, { StatusBar, Style }] = await Promise.all([import('@capacitor/app'), import('@capacitor/status-bar')])
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.minimizeApp()
  })
  try {
    await StatusBar.setStyle({ style: Style.Light })
    await StatusBar.setBackgroundColor({ color: '#ffffff' })
  } catch { /* no disponible en todas las versiones */ }
  // Al tocar una notificación se abre la pantalla correspondiente.
  if (pushHabilitado()) {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    void PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      const url = a.notification.data?.url as string | undefined
      if (url?.startsWith('/')) void router.push(url)
    })
  }
}

/** El push requiere el archivo google-services.json de Firebase al compilar (ver docs/APP_ANDROID.md). */
export const pushHabilitado = () => Capacitor.isNativePlatform() && import.meta.env.VITE_PUSH_HABILITADO === 'true'

/** Pide permiso y registra el dispositivo del usuario para recibir push. */
export async function registrarPush(alRecibir?: () => void) {
  if (!pushHabilitado()) return
  const { PushNotifications } = await import('@capacitor/push-notifications')
  let permiso = await PushNotifications.checkPermissions()
  if (permiso.receive === 'prompt' || permiso.receive === 'prompt-with-rationale') permiso = await PushNotifications.requestPermissions()
  if (permiso.receive !== 'granted') return
  await PushNotifications.createChannel({ id: 'festy', name: 'Avisos de Festy', description: 'Cobros, eventos, entrevistas y recordatorios', importance: 4, visibility: 1 })
  await PushNotifications.removeAllListeners()
  await PushNotifications.addListener('registration', async ({ value }) => {
    tokenActual = value
    await api.post('/dispositivos', { token: value, plataforma: 'android' }).catch((e) => console.warn('Push: no se pudo guardar el dispositivo', e))
  })
  await PushNotifications.addListener('registrationError', (e) => console.warn('Push: no se pudo registrar', e.error))
  await PushNotifications.addListener('pushNotificationReceived', () => alRecibir?.())
  await PushNotifications.register()
}

/** Al cerrar sesión, el teléfono deja de recibir avisos de esa cuenta. */
export async function quitarPush() {
  if (!tokenActual) return
  await api.delete(`/dispositivos/${encodeURIComponent(tokenActual)}`).catch(() => {})
  tokenActual = null
}
