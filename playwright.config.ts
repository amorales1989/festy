import { defineConfig, devices } from '@playwright/test'

// Requiere el backend local: `supabase start` y `pnpm api` en ../Festy-back (API en :4000).
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'es-AR',
    timezoneId: 'Europe/Madrid', // a propósito distinta de la organización: la app debe usar la zona de la organización
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'escritorio', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
})
