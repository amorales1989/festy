import { expect, test, type Page } from '@playwright/test'

// Alta de empresas por la administración de Festy (registro público cerrado en
// producción) y alta de un empleado por invitación, sin pasar por /registro.
// El administrador local es el email de ADMIN_PLATAFORMA en Festy-back/.env.
const ADMIN = { nombre: 'Admin Festy', email: 'admin@festy.local', clave: 'admin-festy-123' }
const sufijo = Date.now().toString(36)
const duenio = { nombre: 'Dueño Alta', email: `duenio-${sufijo}@e2e.test`, empresa: `Salón Alta ${sufijo}` }
const empleado = { nombre: 'Empleada Invitada', email: `empleada-${sufijo}@e2e.test`, clave: 'clave-empleada-1' }
const CAPTURAS = process.env.CAPTURAS_DIR

async function captura(page: Page, nombre: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nombre}.png`, fullPage: true })
}
async function ingresar(page: Page, email: string, clave: string) {
  await page.goto('/ingresar')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(clave)
  await page.getByRole('button', { name: 'Ingresar' }).click()
}

test.describe.serial('administración de la plataforma', () => {
  let claveInicial = ''
  let enlaceInvitacion = ''

  test('el administrador da de alta una empresa', async ({ page }) => {
    // Cuenta del administrador (se crea la primera vez; en local el registro está abierto)
    await ingresar(page, ADMIN.email, ADMIN.clave)
    await Promise.race([page.waitForURL((u) => !u.pathname.startsWith('/ingresar')), page.getByRole('alert').waitFor()])
    if (new URL(page.url()).pathname.startsWith('/ingresar')) {
      await page.goto('/registro')
      await page.getByLabel('Tu nombre').fill(ADMIN.nombre)
      await page.getByLabel('Email').fill(ADMIN.email)
      await page.getByLabel('Contraseña').fill(ADMIN.clave)
      await page.getByText('Acepto los términos').click()
      await page.getByRole('button', { name: 'Crear cuenta' }).click()
      // Sin empresa y siendo administrador, entra directo a la administración
      await expect(page).toHaveURL(/\/plataforma/)
    }
    await page.goto('/plataforma')
    await expect(page.getByRole('heading', { name: 'Administración de Festy' })).toBeVisible()
    await page.getByRole('button', { name: 'Nueva empresa' }).click()
    const d = page.getByRole('dialog', { name: 'Nueva empresa' })
    await d.getByLabel('Nombre de la empresa o salón').fill(duenio.empresa)
    await d.getByLabel('Nombre del dueño').fill(duenio.nombre)
    await d.getByLabel('Email del dueño (su usuario)').fill(duenio.email)
    claveInicial = await d.getByLabel('Contraseña inicial').inputValue()
    expect(claveInicial).toMatch(/^Festy-/)
    await d.getByRole('button', { name: 'Crear empresa' }).click()
    await expect(page.getByRole('dialog', { name: 'Empresa creada' })).toContainText(`Usuario: ${duenio.email}`)
    await page.getByRole('button', { name: 'Listo' }).click()
    const fila = page.getByRole('row', { name: new RegExp(duenio.empresa) })
    await expect(fila).toContainText('$ 30.000')
    await expect(fila).toContainText('1 salón · tarifa')
    await expect(fila).toContainText('Sin pagos')
    // Registrar el pago de la suscripción
    await fila.getByRole('button', { name: 'Registrar pago' }).click()
    const pago = page.getByRole('dialog', { name: 'Registrar pago' })
    await pago.getByLabel('Meses que paga').selectOption('2')
    await expect(pago.getByLabel('Monto')).toHaveValue('60.000')
    await pago.getByLabel('Medio').selectOption({ label: 'Mercado Pago' })
    await pago.getByRole('button', { name: 'Registrar pago' }).click()
    await expect(fila).toContainText('Al día hasta')
    await expect(fila).toContainText('Mercado Pago · 2 meses')
    await captura(page, '30-plataforma')
  })

  test('el dueño entra con la contraseña inicial e invita a su equipo', async ({ page }) => {
    await ingresar(page, duenio.email, claveInicial)
    await expect(page.getByText(duenio.empresa).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Administración' })).toHaveCount(0)
    await page.goto('/plataforma')
    await expect(page).not.toHaveURL(/plataforma/)  // no es administrador de la plataforma
    await page.goto('/configuracion/usuarios')
    await page.getByRole('button', { name: 'Invitar usuario' }).click()
    const inv = page.getByRole('dialog', { name: 'Invitar usuario' })
    await inv.getByLabel('Email').fill(empleado.email)
    await inv.getByLabel('Rol').selectOption({ label: 'Recepción' })
    await inv.getByRole('button', { name: 'Crear invitación' }).click()
    enlaceInvitacion = await inv.getByLabel('Enlace de invitación').inputValue()
  })

  test('el empleado crea su cuenta desde la invitación', async ({ page }) => {
    await page.goto(new URL(enlaceInvitacion).pathname)
    await expect(page.getByText('Te invitaron a sumarte a')).toBeVisible()
    await page.getByLabel('Tu nombre').fill(empleado.nombre)
    await page.getByLabel('Contraseña', { exact: true }).fill(empleado.clave)
    await page.getByLabel('Repetí la contraseña').fill(empleado.clave)
    await captura(page, '31-invitacion-crear-cuenta')
    await page.getByRole('button', { name: 'Crear cuenta y unirme' }).click()
    await expect(page.getByRole('heading', { name: 'HOY' })).toBeVisible()
    await expect(page.getByText(duenio.empresa).first()).toBeVisible()
  })

  test('suspensión por falta de pago y reactivación al pagar', async ({ page, browser }) => {
    await ingresar(page, ADMIN.email, ADMIN.clave)
    await expect(page.getByRole('heading', { name: 'Administración de Festy' })).toBeVisible()
    const fila = page.getByRole('row', { name: new RegExp(duenio.empresa) })
    await fila.getByRole('button', { name: `Suspender ${duenio.empresa}` }).click()
    await page.getByLabel('Motivo (lo ve el cliente al entrar)').fill('Falta de pago de noviembre')
    await page.getByRole('button', { name: 'Suspender', exact: true }).click()
    await expect(fila).toContainText('Suspendida')

    const otro = await (await browser.newContext({ locale: 'es-AR' })).newPage()
    await ingresar(otro, duenio.email, claveInicial)
    await expect(otro.getByRole('heading', { name: 'Cuenta suspendida' })).toBeVisible()
    await expect(otro.getByText('Falta de pago de noviembre')).toBeVisible()
    await captura(otro, '32-cuenta-suspendida')

    await fila.getByRole('button', { name: 'Registrar pago' }).click()
    const pago = page.getByRole('dialog', { name: 'Registrar pago' })
    await expect(pago.getByText('La empresa está suspendida')).toBeVisible()
    await pago.getByRole('button', { name: 'Registrar pago' }).click()
    await expect(fila).not.toContainText('Suspendida')

    await otro.getByRole('button', { name: 'Volver a intentar' }).click()
    await expect(otro.getByRole('heading', { name: 'HOY' })).toBeVisible()
  })
})
