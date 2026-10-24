// Montos en letras para comprobantes: 1440000.5 → "un millón cuatrocientos cuarenta mil pesos con 50/100".
const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece',
  'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function hasta999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100), r = n % 100
  let texto = CENTENAS[c]!
  if (r) {
    const dec = r < 30 ? UNIDADES[r]! : DECENAS[Math.floor(r / 10)]! + (r % 10 ? ` y ${UNIDADES[r % 10]}` : '')
    texto = texto ? `${texto} ${dec}` : dec
  }
  return texto
}

/** Apocopa "uno" → "un" cuando precede a un sustantivo (mil, millón, pesos). */
const apocopar = (t: string) => (t.endsWith('veintiuno') ? t.replace(/veintiuno$/, 'veintiún') : t.replace(/uno$/, 'un'))

export function enteroEnLetras(n: number): string {
  if (n === 0) return 'cero'
  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (millones) partes.push(millones === 1 ? 'un millón' : `${apocopar(enteroEnLetras(millones))} millones`)
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocopar(hasta999(miles))} mil`)
  if (resto) partes.push(hasta999(resto))
  return partes.join(' ')
}

export function montoEnLetras(monto: number): string {
  const entero = Math.floor(Math.round(monto * 100) / 100)
  const centavos = Math.round((monto - entero) * 100)
  const texto = apocopar(enteroEnLetras(entero))
  const pesos = entero === 1 ? 'peso' : 'pesos'
  const deMillon = entero >= 1_000_000 && entero % 1_000_000 === 0 ? 'de ' : ''
  return `${texto} ${deMillon}${pesos}${centavos ? ` con ${String(centavos).padStart(2, '0')}/100` : ''}`
}
