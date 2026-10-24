import { describe, expect, it } from 'vitest'
import { esLimitePlan, traducirError } from './errores'

describe('traducirError', () => {
  it('respeta los mensajes de negocio en español de la base', () => {
    const e = { code: '23P01', message: 'El espacio "Quincho" ya está ocupado del 05/01/2030 20:00 al 06/01/2030 06:00 por la reserva #1 "Primera".' }
    expect(traducirError(e)).toBe(e.message)
  })
  it('traduce la violación cruda de la restricción EXCLUDE (carrera concurrente)', () => {
    expect(traducirError({ code: '23P01', message: 'conflicting key value violates exclusion constraint "ocupaciones_sin_superposicion"' }))
      .toMatch(/ya está ocupado/)
  })
  it('traduce errores de autenticación', () => {
    expect(traducirError({ message: 'Invalid login credentials' })).toBe('El email o la contraseña no son correctos.')
  })
  it('traduce permisos denegados genéricos', () => {
    expect(traducirError({ code: '42501', message: 'new row violates row-level security policy for table "clientes"' }))
      .toBe('No tenés permiso para realizar esta acción.')
  })
  it('traduce claves foráneas al borrar', () => {
    expect(traducirError({ code: '23503', message: 'update or delete on table "espacios" violates foreign key constraint' }))
      .toMatch(/No se puede eliminar/)
  })
  it('no expone mensajes técnicos desconocidos', () => {
    expect(traducirError({ message: 'XX000 internal stuff' })).toMatch(/error inesperado/)
  })
  it('detecta límites del plan', () => {
    expect(esLimitePlan({ hint: 'LIMITE_PLAN' })).toBe(true)
    expect(esLimitePlan({})).toBe(false)
  })
})
