import type { CapacitorConfig } from '@capacitor/cli'

// CAP_DESARROLLO=1 permite que la app de prueba hable con un Supabase local por
// HTTP (en la red de tu casa). En producción Supabase usa HTTPS y no hace falta.
const desarrollo = process.env.CAP_DESARROLLO === '1'

const config: CapacitorConfig = {
  appId: 'com.festy.app',
  appName: 'Festy',
  webDir: 'dist',
  server: desarrollo ? { androidScheme: 'http', cleartext: true } : { androidScheme: 'https' },
  android: { allowMixedContent: desarrollo },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#7c3aed', showSpinner: false },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
}

export default config
