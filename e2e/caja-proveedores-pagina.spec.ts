import { expect, test, type Page } from '@playwright/test'

// Caja por cuenta, costos de proveedores con rentabilidad y la página pública
// del salón con pedido de fecha (visitante sin sesión).
const sufijo = Date.now().toString(36)
const duenia = { nombre: 'Dueña Caja', email: `caja-${sufijo}@e2e.test`, clave: 'clave-segura-123' }
const slug = `salon-e2e-${sufijo}`
const CAPTURAS = process.env.CAPTURAS_DIR

async function captura(page: Page, nombre: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nombre}.png`, fullPage: true })
}
async function ingresar(page: Page) {
  await page.goto('/ingresar')
  await page.getByLabel('Email').fill(duenia.email)
  await page.getByLabel('Contraseña').fill(duenia.clave)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('heading', { name: 'HOY' })).toBeVisible()
}

test.describe.serial('caja, proveedores y página pública', () => {
  test('alta con datos de ejemplo', async ({ page }) => {
    await page.goto('/registro')
    await page.getByLabel('Tu nombre').fill(duenia.nombre)
    await page.getByLabel('Email').fill(duenia.email)
    await page.getByLabel('Contraseña').fill(duenia.clave)
    await page.getByText('Acepto los términos').click()
    await page.getByRole('button', { name: 'Crear cuenta' }).click()
    await page.getByLabel('Nombre de tu salón o empresa').fill('Salón Caja E2E')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Nombre del espacio').fill('Salón principal')
    await page.getByLabel('Capacidad máxima').fill('150')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click()
    await expect(page.getByText('Estás viendo datos de ejemplo')).toBeVisible()
  })

  test('caja: saldos por cuenta y transferencia', async ({ page }) => {
    await ingresar(page)
    await page.goto('/caja')
    for (const c of ['Efectivo', 'Banco', 'Mercado Pago']) await expect(page.getByRole('button', { name: new RegExp(c) }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Transferir' }).click()
    const t = page.getByRole('dialog', { name: 'Transferir entre cuentas' })
    await t.getByLabel('Monto').fill('10.000')
    await t.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByText(/Transferencia a /).first()).toBeVisible()
    await captura(page, '20-caja')
  })

  test('costos del evento, pago al proveedor y rentabilidad', async ({ page }) => {
    await ingresar(page)
    await page.goto('/proveedores')
    await expect(page.getByText('Catering Las Delicias (ejemplo)')).toBeVisible()
    await page.goto('/reservas')
    await page.getByRole('link', { name: /Casamiento|Cumpleaños|15/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Costos y proveedores' })).toBeVisible()
    await page.getByRole('button', { name: 'Agregar costo' }).click()
    const c = page.getByRole('dialog', { name: 'Agregar costo' })
    await c.getByLabel('Qué es').fill('Fotografía')
    await c.getByLabel('Monto').fill('200.000')
    await c.getByLabel('Proveedor').selectOption('nuevo')
    await c.getByLabel('Nombre del proveedor').fill(`Foto Flash ${sufijo}`)
    await c.getByRole('button', { name: 'Guardar' }).click()
    const fila = page.locator('li', { hasText: 'Fotografía' })
    await expect(fila).toContainText('sin pagar')
    await fila.getByRole('button', { name: 'Pagar' }).click()
    const p = page.getByRole('dialog', { name: 'Pagar al proveedor' })
    await p.getByLabel('Monto').fill('50.000')
    await p.getByRole('button', { name: 'Registrar pago' }).click()
    await expect(fila).toContainText('falta')
    await captura(page, '21-costos-evento')
    await page.goto('/rentabilidad')
    await expect(page.getByRole('cell', { name: /#\d+/ }).first()).toBeVisible()
    await captura(page, '22-rentabilidad')
  })

  test('página pública: publicar y recibir un pedido sin sesión', async ({ page, browser }) => {
    await ingresar(page)
    await page.goto('/configuracion/pagina')
    await page.getByLabel('Publicar la página').check()
    await page.getByLabel('Dirección de la página').fill(slug)
    await page.getByLabel('WhatsApp para recibir pedidos').fill('5491155550000')
    await page.getByLabel('Presentación').fill('Salón para casamientos y cumpleaños.')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByRole('link', { name: 'Ver página' })).toBeVisible()

    const visitante = await browser.newContext({ locale: 'es-AR' })
    const v = await visitante.newPage()
    await v.goto(`/s/${slug}`)
    await expect(v.getByRole('heading', { name: 'Salón Caja E2E' })).toBeVisible()
    await v.getByRole('button', { name: 'Mes siguiente' }).click()
    await v.getByRole('button', { name: /: libre$/ }).first().click()
    await v.getByLabel('Tu nombre').fill('Visitante Web')
    await v.getByLabel('Teléfono / WhatsApp').fill('11 4444 5555')
    await v.getByLabel('Invitados (aprox.)').fill('90')
    await captura(v, '23-pagina-publica')
    await v.getByRole('button', { name: 'Pedir esta fecha' }).click()
    await expect(v.getByText('¡Listo, Visitante!')).toBeVisible()
    await expect(v.getByRole('link', { name: 'Escribirles por WhatsApp' })).toHaveAttribute('href', /wa\.me\/5491155550000/)
    await visitante.close()

    // El pedido aparece en el Inicio con el teléfono y los botones para contactar
    await page.goto('/')
    const pedido = page.getByRole('region', { name: /desde tu página/ })
    await expect(pedido.getByText('Visitante Web')).toBeVisible()
    await expect(pedido.getByRole('link', { name: 'Llamar a Visitante Web' })).toHaveAttribute('href', 'tel:+5491144445555')
    await expect(pedido.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/5491144445555/)
    await captura(page, '24-inicio-pedido-web')
    await pedido.getByRole('button', { name: 'Ya lo contacté' }).click()
    await expect(page.getByRole('region', { name: /desde tu página/ })).toHaveCount(0)
    await page.goto('/reservas?estado=consulta')
    await expect(page.getByText('Pedido web · Visitante Web').first()).toBeVisible()
  })
})
