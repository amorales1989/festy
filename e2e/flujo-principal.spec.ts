import { expect, test, type Page } from '@playwright/test'

// Flujo completo con datos reales en la base local: registro, onboarding,
// panel, calendario, reserva, conflicto de agenda, cobro e invitación con
// permisos restringidos.
const sufijo = Date.now().toString(36)
const duenia = { nombre: 'Dueña E2E', email: `duenia-${sufijo}@e2e.test`, clave: 'clave-segura-123' }
const operativo = { nombre: 'Operario E2E', email: `operativo-${sufijo}@e2e.test`, clave: 'clave-segura-456' }
const CAPTURAS = process.env.CAPTURAS_DIR

async function captura(page: Page, nombre: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nombre}.png`, fullPage: true })
}

async function registrar(page: Page, u: typeof duenia, volver?: string) {
  await page.goto(volver ? `/registro?volver=${encodeURIComponent(volver)}` : '/registro')
  await page.getByLabel('Tu nombre').fill(u.nombre)
  await page.getByLabel('Email').fill(u.email)
  await page.getByLabel('Contraseña').fill(u.clave)
  await page.getByText('Acepto los términos').click()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
}

test.describe.serial('flujo principal', () => {
  let enlaceInvitacion = ''

  test('registro y onboarding guiado con datos de ejemplo', async ({ page }) => {
    await registrar(page, duenia)
    await expect(page).toHaveURL(/\/bienvenida/)
    await captura(page, '01-bienvenida')
    await page.getByLabel('Nombre de tu salón o empresa').fill('Salón E2E')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Nombre del espacio').fill('Salón principal')
    await page.getByLabel('Capacidad máxima').fill('150')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click()
    await expect(page.getByRole('heading', { name: 'HOY' })).toBeVisible()
    await expect(page.getByText('Estás viendo datos de ejemplo')).toBeVisible()
    await expect(page.getByText('Evento de hoy (ejemplo)').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'PARA HACER' })).toBeVisible()
    await captura(page, '02-panel')
  })

  test('calendario: vistas mes, semana y día', async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByLabel('Email').fill(duenia.email)
    await page.getByLabel('Contraseña').fill(duenia.clave)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('heading', { name: 'HOY' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Agenda' }).click()
    await page.getByRole('tab', { name: 'Mes' }).click()
    await expect(page.getByText('Evento de hoy (ejemplo)').first()).toBeVisible()
    await captura(page, '03-calendario-mes')
    await page.getByRole('tab', { name: 'Semana' }).click()
    await captura(page, '04-calendario-semana')
    await page.getByRole('tab', { name: 'Día' }).click()
    await expect(page.getByRole('main').getByText('150 pers.')).toBeVisible()
    await captura(page, '05-calendario-dia')
  })

  test('reserva nueva, conflicto de agenda y cobro de seña', async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByLabel('Email').fill(duenia.email)
    await page.getByLabel('Contraseña').fill(duenia.clave)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('heading', { name: 'HOY' })).toBeVisible()

    await page.getByRole('button', { name: 'Nueva reserva' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Nueva reserva' })
    await dialogo.getByLabel('Cliente').fill('Cliente E2E')
    await dialogo.getByRole('button', { name: /Es un cliente nuevo/ }).click()
    await dialogo.getByLabel('Teléfono').fill('+54 9 351 000-0000')
    await dialogo.getByLabel('Tipo', { exact: true }).selectOption('casamiento')
    await dialogo.getByRole('textbox', { name: 'Fecha', exact: true }).fill('20/03/2027')
    await dialogo.getByLabel('Desde').fill('21:00')
    await dialogo.getByLabel('Hasta').fill('05:00')
    await expect(dialogo.getByText(/Termina al día siguiente/)).toBeVisible()
    await dialogo.getByRole('radio', { name: /Fecha retenida/ }).click()
    await dialogo.getByLabel('Invitados').fill('120')
    await dialogo.getByLabel('Precio total').fill('3.000.000')
    await expect(dialogo.getByText('Disponible', { exact: true })).toBeVisible()
    await captura(page, '06-form-reserva')
    await dialogo.getByRole('button', { name: 'Reservar', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Casamiento · Cliente E2E/ })).toBeVisible()
    await expect(page.getByText(/sáb 20\/03\/2027 · 21:00 a 05:00/i)).toBeVisible()
    const url = page.url()

    // Conflicto: mismo espacio y horario superpuesto.
    await page.getByRole('button', { name: 'Nueva reserva' }).click()
    await dialogo.getByLabel('Cliente').fill('Otro cliente')
    await dialogo.getByRole('button', { name: /Es un cliente nuevo/ }).click()
    await dialogo.getByRole('textbox', { name: 'Fecha', exact: true }).fill('20/03/2027')
    await dialogo.getByLabel('Desde').fill('23:00')
    await dialogo.getByLabel('Hasta').fill('02:00')
    await dialogo.getByRole('radio', { name: /Confirmada/ }).click()
    await expect(dialogo.getByText('Esa fecha ya está ocupada')).toBeVisible()
    await dialogo.getByRole('button', { name: 'Reservar', exact: true }).click()
    await expect(dialogo.getByRole('alert')).toContainText('ya está ocupado')
    await captura(page, '07-conflicto')
    await dialogo.getByRole('button', { name: 'Cancelar' }).click()

    // Seña: pasa la tentativa a señada.
    await page.goto(url)
    await page.getByRole('button', { name: 'Registrar cobro' }).click()
    const pago = page.getByRole('dialog', { name: 'Registrar cobro' })
    await pago.getByLabel('Monto').fill('900.000')
    await expect(pago.getByLabel('Concepto')).toHaveValue('sena')
    await pago.getByRole('button', { name: 'Registrar' }).click()
    const recibo = page.getByRole('dialog', { name: 'Cobro registrado' })
    await expect(recibo).toContainText(/Comprobante N° \d{8}/)
    const [descarga] = await Promise.all([page.waitForEvent('download'), recibo.getByRole('button', { name: 'Descargar' }).click()])
    expect(descarga.suggestedFilename()).toMatch(/^comprobante-\d{8}\.pdf$/)
    await recibo.getByRole('button', { name: 'Cerrar' }).click()
    await expect(page.locator('main').getByText('Señada', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('$ 900.000,00').first()).toBeVisible()
    await captura(page, '08-reserva-detalle')

    // Invitación a personal operativo
    await page.goto('/configuracion/usuarios')
    await page.getByRole('button', { name: 'Invitar usuario' }).click()
    const inv = page.getByRole('dialog', { name: 'Invitar usuario' })
    await inv.getByLabel('Email').fill(operativo.email)
    await inv.getByLabel('Rol').selectOption({ label: 'Personal operativo' })
    await inv.getByRole('button', { name: 'Crear invitación' }).click()
    enlaceInvitacion = await inv.getByLabel('Enlace de invitación').inputValue()
    expect(enlaceInvitacion).toContain('/invitacion/')
  })

  test('catálogo, presupuesto en PDF, aceptación y evento creado', async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByLabel('Email').fill(duenia.email)
    await page.getByLabel('Contraseña').fill(duenia.clave)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('heading', { name: 'HOY' })).toBeVisible()

    // Catálogo
    await page.goto('/catalogo')
    await page.getByRole('button', { name: 'Agregar al catálogo' }).click()
    const serv = page.getByRole('dialog', { name: 'Agregar al catálogo' })
    await serv.getByLabel('Nombre').fill('Menú adultos')
    await serv.getByLabel('Precio', { exact: true }).fill('25.000')
    await serv.getByLabel('Se cobra').selectOption('persona')
    await serv.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Menú adultos')).toBeVisible()

    // Presupuesto
    await page.goto('/presupuestos/nuevo')
    await page.getByLabel('Cliente', { exact: true }).fill('Cliente Presupuesto')
    await page.getByRole('button', { name: /Es un cliente nuevo/ }).click()
    await page.getByLabel('Teléfono del cliente').fill('351 555 1234')
    await page.getByRole('button', { name: 'Guardar cliente' }).click()
    await page.getByLabel('Invitados').fill('100')
    await page.getByRole('textbox', { name: 'Fecha', exact: true }).fill('10/04/2027')
    await page.getByLabel('Espacio').selectOption({ label: 'Salón principal' })
    await expect(page.getByText('La fecha está libre')).toBeVisible()
    await page.getByRole('button', { name: 'Del catálogo' }).click()
    await page.getByRole('dialog', { name: 'Agregar del catálogo' }).getByRole('button', { name: /Menú adultos/ }).click()
    await expect(page.getByText('Total $ 2.500.000,00')).toBeVisible()
    await page.locator('div').filter({ hasText: /^Depósito de garantía/ }).getByRole('textbox').fill('300.000')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Presupuesto N° 0001' })).toBeVisible()
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF' }).click()])
    expect(pdf.suggestedFilename()).toBe('presupuesto-0001-cliente-presupuesto.pdf')
    await captura(page, '11-presupuesto')

    // Aceptación → evento con plan de pagos
    await page.getByRole('button', { name: 'Aceptar presupuesto' }).click()
    await page.getByRole('radio', { name: /Fecha retenida/ }).click()
    await page.getByRole('button', { name: 'Crear el evento' }).click()
    await expect(page.getByRole('heading', { name: /Cumpleaños · Cliente Presupuesto/ })).toBeVisible()
    await expect(page.getByText('Fecha retenida: falta la seña')).toBeVisible()
    await expect(page.getByText(/^Seña · vence/).first()).toBeVisible()
    await expect(page.getByText(/^Saldo · vence/).first()).toBeVisible()
    await captura(page, '12-evento-desde-presupuesto')

    // Adicional pedido después: suma al total y genera su cuota
    await page.getByRole('button', { name: 'Agregar adicional' }).click()
    const ad = page.getByRole('dialog', { name: 'Agregar adicional' })
    await ad.getByLabel('Qué es').fill('Cabina de fotos')
    await ad.getByLabel('Precio').fill('280.000')
    await ad.getByRole('button', { name: 'Agregar' }).click()
    await expect(page.getByText('Total del evento')).toBeVisible()
    await expect(page.locator('li', { hasText: 'Total del evento' })).toContainText('$ 2.780.000,00')
    await expect(page.getByText(/^Adicional: Cabina de fotos/)).toBeVisible()

    // Garantía: pedida desde el presupuesto, se cobra y se devuelve con retención
    await expect(page.getByText('Falta cobrarla')).toBeVisible()
    await page.getByRole('region', { name: 'Próximo paso' }).getByRole('button', { name: /Registrar seña/ }).waitFor()
    await page.getByRole('button', { name: 'Cobrar', exact: true }).click()
    const cobro = page.getByRole('dialog', { name: 'Cobrar garantía' })
    await cobro.getByRole('button', { name: 'Registrar cobro' }).click()
    await expect(page.getByText('En custodia')).toBeVisible()
    const [recibo] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Recibo', exact: true }).click()])
    expect(recibo.suggestedFilename()).toBe('recibo-garantia-00000001.pdf')
    await page.getByRole('button', { name: 'Registrar devolución' }).click()
    const dev = page.getByRole('dialog', { name: 'Devolver garantía' })
    await dev.getByRole('radio', { name: /Hubo daños/ }).click()
    await dev.getByLabel('Monto que se devuelve').fill('250.000')
    await dev.getByRole('button', { name: 'Registrar devolución' }).click()
    await expect(dev.getByRole('alert')).toContainText('motivo')
    await dev.getByLabel('Motivo de la retención').fill('Tres copas rotas')
    await dev.getByRole('button', { name: 'Registrar devolución' }).click()
    await expect(page.getByText('Devuelta con retención')).toBeVisible()
    await expect(page.getByText(/retenido \$\s50\.000,00: Tres copas rotas/)).toBeVisible()
    const [constancia] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Devolución', exact: true }).click()])
    expect(constancia.suggestedFilename()).toBe('devolucion-garantia-00000002.pdf')
    await captura(page, '13-garantia-devuelta')

    // La garantía no cuenta como cobro del evento
    await expect(page.getByText('Todavía no se registraron cobros.')).toBeVisible()
  })

  test('el personal operativo invitado solo ve lo que su rol permite', async ({ page }) => {
    const ruta = new URL(enlaceInvitacion).pathname
    await registrar(page, operativo, ruta)
    await expect(page.getByText('Te invitaron a sumarte a')).toBeVisible()
    await page.getByRole('button', { name: 'Aceptar invitación' }).click()
    await expect(page.getByRole('heading', { name: 'HOY' })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Navegación principal' })
    await expect(nav.getByRole('link', { name: 'Agenda' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Clientes' })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Finanzas' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Nueva reserva' })).toHaveCount(0)
    await expect(page.getByText(/Cobrado este mes/)).toHaveCount(0)
    await page.goto('/clientes')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('No tenés permiso para ver esa sección.')).toBeVisible()
  })

  test('celular: panel y menú', async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', isMobile: true, hasTouch: true })
    const page = await contexto.newPage()
    await page.goto('/ingresar')
    await page.getByLabel('Email').fill(duenia.email)
    await page.getByLabel('Contraseña').fill(duenia.clave)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByRole('heading', { name: 'HOY' })).toBeVisible()
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(ancho).toBeLessThanOrEqual(390)
    await captura(page, '09-movil-panel')
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Agenda' })).toBeVisible()
    await captura(page, '10-movil-menu')
    await contexto.close()
  })
})
