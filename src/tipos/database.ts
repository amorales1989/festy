export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      auditoria: {
        Row: {
          accion: string
          cambios: Json | null
          creado_at: string
          id: number
          organizacion_id: string
          registro_id: string | null
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          cambios?: Json | null
          creado_at?: string
          id?: never
          organizacion_id: string
          registro_id?: string | null
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          cambios?: Json | null
          creado_at?: string
          id?: never
          organizacion_id?: string
          registro_id?: string | null
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      bloqueos: {
        Row: {
          creado_at: string
          creado_por: string | null
          espacio_id: string
          fin: string
          id: string
          inicio: string
          motivo: string | null
          organizacion_id: string
          tipo: string
        }
        Insert: {
          creado_at?: string
          creado_por?: string | null
          espacio_id: string
          fin: string
          id?: string
          inicio: string
          motivo?: string | null
          organizacion_id: string
          tipo?: string
        }
        Update: {
          creado_at?: string
          creado_por?: string | null
          espacio_id?: string
          fin?: string
          id?: string
          inicio?: string
          motivo?: string | null
          organizacion_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueos_organizacion_id_espacio_id_fkey"
            columns: ["organizacion_id", "espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      clientes: {
        Row: {
          actualizado_at: string
          busqueda: string | null
          creado_at: string
          creado_por: string | null
          direccion: string | null
          documento: string | null
          email: string | null
          es_ejemplo: boolean
          id: string
          nombre: string
          notas: string | null
          organizacion_id: string
          origen: string | null
          telefono: string | null
          tipo: string
        }
        Insert: {
          actualizado_at?: string
          busqueda?: string | null
          creado_at?: string
          creado_por?: string | null
          direccion?: string | null
          documento?: string | null
          email?: string | null
          es_ejemplo?: boolean
          id?: string
          nombre: string
          notas?: string | null
          organizacion_id: string
          origen?: string | null
          telefono?: string | null
          tipo?: string
        }
        Update: {
          actualizado_at?: string
          busqueda?: string | null
          creado_at?: string
          creado_por?: string | null
          direccion?: string | null
          documento?: string | null
          email?: string | null
          es_ejemplo?: boolean
          id?: string
          nombre?: string
          notas?: string | null
          organizacion_id?: string
          origen?: string | null
          telefono?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cuotas: {
        Row: {
          concepto: string
          creado_at: string
          id: string
          monto: number
          organizacion_id: string
          reserva_id: string
          vencimiento: string
        }
        Insert: {
          concepto?: string
          creado_at?: string
          id?: string
          monto: number
          organizacion_id: string
          reserva_id: string
          vencimiento: string
        }
        Update: {
          concepto?: string
          creado_at?: string
          id?: string
          monto?: number
          organizacion_id?: string
          reserva_id?: string
          vencimiento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuotas_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "cuotas_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
        ]
      }
      dispositivos: {
        Row: {
          actualizado_at: string
          creado_at: string
          id: string
          plataforma: string
          token: string
          usuario_id: string
        }
        Insert: {
          actualizado_at?: string
          creado_at?: string
          id?: string
          plataforma: string
          token: string
          usuario_id: string
        }
        Update: {
          actualizado_at?: string
          creado_at?: string
          id?: string
          plataforma?: string
          token?: string
          usuario_id?: string
        }
        Relationships: []
      }
      entrevistas: {
        Row: {
          actualizado_at: string
          asignada_a: string | null
          cliente_id: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          creado_at: string
          creado_por: string | null
          duracion_min: number
          enlace: string | null
          es_ejemplo: boolean
          estado: string
          id: string
          inicio: string
          modalidad: string
          motivo: string | null
          notas: string | null
          organizacion_id: string
          presupuesto_id: string | null
          reserva_id: string | null
          sucursal_id: string | null
        }
        Insert: {
          actualizado_at?: string
          asignada_a?: string | null
          cliente_id?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          creado_at?: string
          creado_por?: string | null
          duracion_min?: number
          enlace?: string | null
          es_ejemplo?: boolean
          estado?: string
          id?: string
          inicio: string
          modalidad?: string
          motivo?: string | null
          notas?: string | null
          organizacion_id: string
          presupuesto_id?: string | null
          reserva_id?: string | null
          sucursal_id?: string | null
        }
        Update: {
          actualizado_at?: string
          asignada_a?: string | null
          cliente_id?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          creado_at?: string
          creado_por?: string | null
          duracion_min?: number
          enlace?: string | null
          es_ejemplo?: boolean
          estado?: string
          id?: string
          inicio?: string
          modalidad?: string
          motivo?: string | null
          notas?: string | null
          organizacion_id?: string
          presupuesto_id?: string | null
          reserva_id?: string | null
          sucursal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entrevistas_organizacion_id_cliente_id_fkey"
            columns: ["organizacion_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "entrevistas_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entrevistas_organizacion_id_presupuesto_id_fkey"
            columns: ["organizacion_id", "presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "entrevistas_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "entrevistas_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
          {
            foreignKeyName: "entrevistas_organizacion_id_sucursal_id_fkey"
            columns: ["organizacion_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      espacio_horarios: {
        Row: {
          dia_semana: number
          espacio_id: string
          hora_desde: string
          hora_hasta: string
          id: string
          organizacion_id: string
        }
        Insert: {
          dia_semana: number
          espacio_id: string
          hora_desde: string
          hora_hasta: string
          id?: string
          organizacion_id: string
        }
        Update: {
          dia_semana?: number
          espacio_id?: string
          hora_desde?: string
          hora_hasta?: string
          id?: string
          organizacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "espacio_horarios_organizacion_id_espacio_id_fkey"
            columns: ["organizacion_id", "espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      espacios: {
        Row: {
          activo: boolean
          actualizado_at: string
          capacidad_maxima: number
          capacidad_minima: number | null
          color: string
          creado_at: string
          descripcion: string | null
          desmontaje_min: number
          duracion_minima_min: number
          duracion_sugerida_min: number
          es_ejemplo: boolean
          garantia_sugerida: number
          id: string
          limpieza_min: number
          montaje_min: number
          nombre: string
          organizacion_id: string
          preparacion_min: number
          sucursal_id: string
          tipo: string
        }
        Insert: {
          activo?: boolean
          actualizado_at?: string
          capacidad_maxima: number
          capacidad_minima?: number | null
          color?: string
          creado_at?: string
          descripcion?: string | null
          desmontaje_min?: number
          duracion_minima_min?: number
          duracion_sugerida_min?: number
          es_ejemplo?: boolean
          garantia_sugerida?: number
          id?: string
          limpieza_min?: number
          montaje_min?: number
          nombre: string
          organizacion_id: string
          preparacion_min?: number
          sucursal_id: string
          tipo?: string
        }
        Update: {
          activo?: boolean
          actualizado_at?: string
          capacidad_maxima?: number
          capacidad_minima?: number | null
          color?: string
          creado_at?: string
          descripcion?: string | null
          desmontaje_min?: number
          duracion_minima_min?: number
          duracion_sugerida_min?: number
          es_ejemplo?: boolean
          garantia_sugerida?: number
          id?: string
          limpieza_min?: number
          montaje_min?: number
          nombre?: string
          organizacion_id?: string
          preparacion_min?: number
          sucursal_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "espacios_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espacios_organizacion_id_sucursal_id_fkey"
            columns: ["organizacion_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      feriados: {
        Row: {
          creado_at: string
          fecha: string
          id: string
          nombre: string
          organizacion_id: string | null
        }
        Insert: {
          creado_at?: string
          fecha: string
          id?: string
          nombre: string
          organizacion_id?: string | null
        }
        Update: {
          creado_at?: string
          fecha?: string
          id?: string
          nombre?: string
          organizacion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feriados_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      garantias: {
        Row: {
          actualizado_at: string
          cobrada_por: string | null
          cobro_fecha: string | null
          cobro_medio: string | null
          cobro_referencia: string | null
          creado_at: string
          devolucion_fecha: string | null
          devolucion_medio: string | null
          devolucion_monto: number | null
          devuelta_por: string | null
          es_ejemplo: boolean
          estado: string
          id: string
          monto: number
          motivo_retencion: string | null
          numero_devolucion: number | null
          numero_recibo: number | null
          organizacion_id: string
          reserva_id: string
        }
        Insert: {
          actualizado_at?: string
          cobrada_por?: string | null
          cobro_fecha?: string | null
          cobro_medio?: string | null
          cobro_referencia?: string | null
          creado_at?: string
          devolucion_fecha?: string | null
          devolucion_medio?: string | null
          devolucion_monto?: number | null
          devuelta_por?: string | null
          es_ejemplo?: boolean
          estado?: string
          id?: string
          monto: number
          motivo_retencion?: string | null
          numero_devolucion?: number | null
          numero_recibo?: number | null
          organizacion_id: string
          reserva_id: string
        }
        Update: {
          actualizado_at?: string
          cobrada_por?: string | null
          cobro_fecha?: string | null
          cobro_medio?: string | null
          cobro_referencia?: string | null
          creado_at?: string
          devolucion_fecha?: string | null
          devolucion_medio?: string | null
          devolucion_monto?: number | null
          devuelta_por?: string | null
          es_ejemplo?: boolean
          estado?: string
          id?: string
          monto?: number
          motivo_retencion?: string | null
          numero_devolucion?: number | null
          numero_recibo?: number | null
          organizacion_id?: string
          reserva_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garantias_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "garantias_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
        ]
      }
      gastos: {
        Row: {
          categoria: string
          creado_at: string
          descripcion: string
          es_ejemplo: boolean
          fecha: string
          id: string
          medio: string
          monto: number
          organizacion_id: string
          proveedor: string | null
          registrado_por: string | null
          reserva_id: string | null
          sucursal_id: string | null
        }
        Insert: {
          categoria?: string
          creado_at?: string
          descripcion: string
          es_ejemplo?: boolean
          fecha: string
          id?: string
          medio?: string
          monto: number
          organizacion_id: string
          proveedor?: string | null
          registrado_por?: string | null
          reserva_id?: string | null
          sucursal_id?: string | null
        }
        Update: {
          categoria?: string
          creado_at?: string
          descripcion?: string
          es_ejemplo?: boolean
          fecha?: string
          id?: string
          medio?: string
          monto?: number
          organizacion_id?: string
          proveedor?: string | null
          registrado_por?: string | null
          reserva_id?: string | null
          sucursal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "gastos_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
          {
            foreignKeyName: "gastos_organizacion_id_sucursal_id_fkey"
            columns: ["organizacion_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          aceptada_at: string | null
          aceptada_por: string | null
          creada_por: string | null
          creado_at: string
          email: string
          expira_at: string
          id: string
          organizacion_id: string
          revocada: boolean
          rol_id: string
          token: string
        }
        Insert: {
          aceptada_at?: string | null
          aceptada_por?: string | null
          creada_por?: string | null
          creado_at?: string
          email: string
          expira_at?: string
          id?: string
          organizacion_id: string
          revocada?: boolean
          rol_id: string
          token?: string
        }
        Update: {
          aceptada_at?: string | null
          aceptada_por?: string | null
          creada_por?: string | null
          creado_at?: string
          email?: string
          expira_at?: string
          id?: string
          organizacion_id?: string
          revocada?: boolean
          rol_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_organizacion_id_rol_id_fkey"
            columns: ["organizacion_id", "rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      membresias: {
        Row: {
          activo: boolean
          creado_at: string
          id: string
          organizacion_id: string
          rol_id: string
          usuario_id: string
        }
        Insert: {
          activo?: boolean
          creado_at?: string
          id?: string
          organizacion_id: string
          rol_id: string
          usuario_id: string
        }
        Update: {
          activo?: boolean
          creado_at?: string
          id?: string
          organizacion_id?: string
          rol_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membresias_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_organizacion_id_rol_id_fkey"
            columns: ["organizacion_id", "rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          clave: string | null
          creado_at: string
          cuerpo: string | null
          id: number
          leida_at: string | null
          organizacion_id: string
          push_enviada_at: string | null
          tipo: string
          titulo: string
          url: string | null
          usuario_id: string
        }
        Insert: {
          clave?: string | null
          creado_at?: string
          cuerpo?: string | null
          id?: never
          leida_at?: string | null
          organizacion_id: string
          push_enviada_at?: string | null
          tipo: string
          titulo: string
          url?: string | null
          usuario_id: string
        }
        Update: {
          clave?: string | null
          creado_at?: string
          cuerpo?: string | null
          id?: never
          leida_at?: string | null
          organizacion_id?: string
          push_enviada_at?: string | null
          tipo?: string
          titulo?: string
          url?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      ocupaciones: {
        Row: {
          bloqueante: boolean
          bloqueo_id: string | null
          espacio_id: string
          id: string
          organizacion_id: string
          rango: unknown
          reserva_espacio_id: string | null
        }
        Insert: {
          bloqueante: boolean
          bloqueo_id?: string | null
          espacio_id: string
          id?: string
          organizacion_id: string
          rango: unknown
          reserva_espacio_id?: string | null
        }
        Update: {
          bloqueante?: boolean
          bloqueo_id?: string | null
          espacio_id?: string
          id?: string
          organizacion_id?: string
          rango?: unknown
          reserva_espacio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocupaciones_bloqueo_id_fkey"
            columns: ["bloqueo_id"]
            isOneToOne: true
            referencedRelation: "bloqueos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocupaciones_espacio_id_fkey"
            columns: ["espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocupaciones_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocupaciones_reserva_espacio_id_fkey"
            columns: ["reserva_espacio_id"]
            isOneToOne: true
            referencedRelation: "reserva_espacios"
            referencedColumns: ["id"]
          },
        ]
      }
      organizaciones: {
        Row: {
          actualizado_at: string
          baja_solicitada_at: string | null
          color_marca: string
          condiciones_presupuesto: string | null
          creado_at: string
          creado_por: string | null
          cuit: string | null
          dias_devolucion_garantia: number
          direccion: string | null
          email_contacto: string | null
          estado: Database["public"]["Enums"]["estado_organizacion"]
          horas_vencimiento_tentativa: number
          id: string
          logo: string | null
          moneda: string
          nombre: string
          onboarding_completado: boolean
          plan_clave: string
          prueba_hasta: string | null
          razon_social: string | null
          suscripcion_estado: Database["public"]["Enums"]["estado_suscripcion"]
          telefono: string | null
          ultimo_numero_comprobante: number
          ultimo_numero_garantia: number
          ultimo_numero_presupuesto: number
          ultimo_numero_reserva: number
          validez_presupuesto_dias: number
          zona_horaria: string
        }
        Insert: {
          actualizado_at?: string
          baja_solicitada_at?: string | null
          color_marca?: string
          condiciones_presupuesto?: string | null
          creado_at?: string
          creado_por?: string | null
          cuit?: string | null
          dias_devolucion_garantia?: number
          direccion?: string | null
          email_contacto?: string | null
          estado?: Database["public"]["Enums"]["estado_organizacion"]
          horas_vencimiento_tentativa?: number
          id?: string
          logo?: string | null
          moneda?: string
          nombre: string
          onboarding_completado?: boolean
          plan_clave?: string
          prueba_hasta?: string | null
          razon_social?: string | null
          suscripcion_estado?: Database["public"]["Enums"]["estado_suscripcion"]
          telefono?: string | null
          ultimo_numero_comprobante?: number
          ultimo_numero_garantia?: number
          ultimo_numero_presupuesto?: number
          ultimo_numero_reserva?: number
          validez_presupuesto_dias?: number
          zona_horaria?: string
        }
        Update: {
          actualizado_at?: string
          baja_solicitada_at?: string | null
          color_marca?: string
          condiciones_presupuesto?: string | null
          creado_at?: string
          creado_por?: string | null
          cuit?: string | null
          dias_devolucion_garantia?: number
          direccion?: string | null
          email_contacto?: string | null
          estado?: Database["public"]["Enums"]["estado_organizacion"]
          horas_vencimiento_tentativa?: number
          id?: string
          logo?: string | null
          moneda?: string
          nombre?: string
          onboarding_completado?: boolean
          plan_clave?: string
          prueba_hasta?: string | null
          razon_social?: string | null
          suscripcion_estado?: Database["public"]["Enums"]["estado_suscripcion"]
          telefono?: string | null
          ultimo_numero_comprobante?: number
          ultimo_numero_garantia?: number
          ultimo_numero_presupuesto?: number
          ultimo_numero_reserva?: number
          validez_presupuesto_dias?: number
          zona_horaria?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizaciones_plan_clave_fkey"
            columns: ["plan_clave"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["clave"]
          },
        ]
      }
      pagos: {
        Row: {
          anulado: boolean
          anulado_at: string | null
          anulado_motivo: string | null
          anulado_por: string | null
          concepto: string
          creado_at: string
          fecha: string
          id: string
          medio: string
          monto: number
          notas: string | null
          numero_comprobante: number
          organizacion_id: string
          referencia: string | null
          registrado_por: string | null
          reserva_id: string
        }
        Insert: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          concepto?: string
          creado_at?: string
          fecha: string
          id?: string
          medio?: string
          monto: number
          notas?: string | null
          numero_comprobante: number
          organizacion_id: string
          referencia?: string | null
          registrado_por?: string | null
          reserva_id: string
        }
        Update: {
          anulado?: boolean
          anulado_at?: string | null
          anulado_motivo?: string | null
          anulado_por?: string | null
          concepto?: string
          creado_at?: string
          fecha?: string
          id?: string
          medio?: string
          monto?: number
          notas?: string | null
          numero_comprobante?: number
          organizacion_id?: string
          referencia?: string | null
          registrado_por?: string | null
          reserva_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "pagos_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
        ]
      }
      perfiles: {
        Row: {
          actualizado_at: string
          creado_at: string
          email: string
          id: string
          nombre: string
          organizacion_actual: string | null
          telefono: string | null
        }
        Insert: {
          actualizado_at?: string
          creado_at?: string
          email?: string
          id: string
          nombre?: string
          organizacion_actual?: string | null
          telefono?: string | null
        }
        Update: {
          actualizado_at?: string
          creado_at?: string
          email?: string
          id?: string
          nombre?: string
          organizacion_actual?: string | null
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_organizacion_actual_fkey"
            columns: ["organizacion_actual"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      permisos: {
        Row: {
          clave: string
          descripcion: string
          modulo: string
          orden: number
        }
        Insert: {
          clave: string
          descripcion: string
          modulo: string
          orden?: number
        }
        Update: {
          clave?: string
          descripcion?: string
          modulo?: string
          orden?: number
        }
        Relationships: []
      }
      planes: {
        Row: {
          activo: boolean
          clave: string
          funciones: string[]
          max_espacios: number | null
          max_reservas_mes: number | null
          max_sucursales: number | null
          max_usuarios: number | null
          nombre: string
          orden: number
          precio_mensual_ars: number
        }
        Insert: {
          activo?: boolean
          clave: string
          funciones?: string[]
          max_espacios?: number | null
          max_reservas_mes?: number | null
          max_sucursales?: number | null
          max_usuarios?: number | null
          nombre: string
          orden?: number
          precio_mensual_ars?: number
        }
        Update: {
          activo?: boolean
          clave?: string
          funciones?: string[]
          max_espacios?: number | null
          max_reservas_mes?: number | null
          max_sucursales?: number | null
          max_usuarios?: number | null
          nombre?: string
          orden?: number
          precio_mensual_ars?: number
        }
        Relationships: []
      }
      presupuesto_items: {
        Row: {
          cantidad: number
          descripcion: string
          id: string
          orden: number
          organizacion_id: string
          precio_unitario: number
          presupuesto_id: string
          servicio_id: string | null
          unidad: string
        }
        Insert: {
          cantidad?: number
          descripcion: string
          id?: string
          orden?: number
          organizacion_id: string
          precio_unitario: number
          presupuesto_id: string
          servicio_id?: string | null
          unidad?: string
        }
        Update: {
          cantidad?: number
          descripcion?: string
          id?: string
          orden?: number
          organizacion_id?: string
          precio_unitario?: number
          presupuesto_id?: string
          servicio_id?: string | null
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuesto_items_organizacion_id_presupuesto_id_fkey"
            columns: ["organizacion_id", "presupuesto_id"]
            isOneToOne: false
            referencedRelation: "presupuestos"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "presupuesto_items_organizacion_id_servicio_id_fkey"
            columns: ["organizacion_id", "servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      presupuestos: {
        Row: {
          actualizado_at: string
          cantidad_cuotas: number
          cliente_id: string
          condiciones: string | null
          creado_at: string
          creado_por: string | null
          descuento: number
          enviado_at: string | null
          es_ejemplo: boolean
          espacio_id: string | null
          estado: string
          fecha_evento: string | null
          garantia_monto: number
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          invitados: number | null
          notas: string | null
          numero: number
          organizacion_id: string
          reserva_id: string | null
          respondido_at: string | null
          sena_porcentaje: number
          subtotal: number
          tipo_evento: string
          titulo: string
          total: number
          valido_hasta: string
        }
        Insert: {
          actualizado_at?: string
          cantidad_cuotas?: number
          cliente_id: string
          condiciones?: string | null
          creado_at?: string
          creado_por?: string | null
          descuento?: number
          enviado_at?: string | null
          es_ejemplo?: boolean
          espacio_id?: string | null
          estado?: string
          fecha_evento?: string | null
          garantia_monto?: number
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          invitados?: number | null
          notas?: string | null
          numero: number
          organizacion_id: string
          reserva_id?: string | null
          respondido_at?: string | null
          sena_porcentaje?: number
          subtotal?: number
          tipo_evento?: string
          titulo: string
          total?: number
          valido_hasta: string
        }
        Update: {
          actualizado_at?: string
          cantidad_cuotas?: number
          cliente_id?: string
          condiciones?: string | null
          creado_at?: string
          creado_por?: string | null
          descuento?: number
          enviado_at?: string | null
          es_ejemplo?: boolean
          espacio_id?: string | null
          estado?: string
          fecha_evento?: string | null
          garantia_monto?: number
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          invitados?: number | null
          notas?: string | null
          numero?: number
          organizacion_id?: string
          reserva_id?: string | null
          respondido_at?: string | null
          sena_porcentaje?: number
          subtotal?: number
          tipo_evento?: string
          titulo?: string
          total?: number
          valido_hasta?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_organizacion_id_cliente_id_fkey"
            columns: ["organizacion_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "presupuestos_organizacion_id_espacio_id_fkey"
            columns: ["organizacion_id", "espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "presupuestos_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presupuestos_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "presupuestos_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
        ]
      }
      recursos: {
        Row: {
          activo: boolean
          actualizado_at: string
          cantidad: number
          categoria: string
          creado_at: string
          id: string
          nombre: string
          notas: string | null
          organizacion_id: string
          sucursal_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_at?: string
          cantidad?: number
          categoria?: string
          creado_at?: string
          id?: string
          nombre: string
          notas?: string | null
          organizacion_id: string
          sucursal_id: string
        }
        Update: {
          activo?: boolean
          actualizado_at?: string
          cantidad?: number
          categoria?: string
          creado_at?: string
          id?: string
          nombre?: string
          notas?: string | null
          organizacion_id?: string
          sucursal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recursos_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recursos_organizacion_id_sucursal_id_fkey"
            columns: ["organizacion_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      reserva_espacios: {
        Row: {
          antes_min: number
          despues_min: number
          espacio_id: string
          id: string
          organizacion_id: string
          reserva_id: string
        }
        Insert: {
          antes_min: number
          despues_min: number
          espacio_id: string
          id?: string
          organizacion_id: string
          reserva_id: string
        }
        Update: {
          antes_min?: number
          despues_min?: number
          espacio_id?: string
          id?: string
          organizacion_id?: string
          reserva_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserva_espacios_organizacion_id_espacio_id_fkey"
            columns: ["organizacion_id", "espacio_id"]
            isOneToOne: false
            referencedRelation: "espacios"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "reserva_espacios_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "reserva_espacios_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
        ]
      }
      reserva_items: {
        Row: {
          cantidad: number
          creado_at: string
          descripcion: string
          es_adicional: boolean
          id: string
          orden: number
          organizacion_id: string
          precio_unitario: number
          reserva_id: string
          servicio_id: string | null
          unidad: string
        }
        Insert: {
          cantidad?: number
          creado_at?: string
          descripcion: string
          es_adicional?: boolean
          id?: string
          orden?: number
          organizacion_id: string
          precio_unitario: number
          reserva_id: string
          servicio_id?: string | null
          unidad?: string
        }
        Update: {
          cantidad?: number
          creado_at?: string
          descripcion?: string
          es_adicional?: boolean
          id?: string
          orden?: number
          organizacion_id?: string
          precio_unitario?: number
          reserva_id?: string
          servicio_id?: string | null
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "reserva_items_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "reserva_items_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
          {
            foreignKeyName: "reserva_items_organizacion_id_servicio_id_fkey"
            columns: ["organizacion_id", "servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      reservas: {
        Row: {
          actualizado_at: string
          cancelada_at: string | null
          cliente_id: string
          contrato_estado: Database["public"]["Enums"]["estado_contrato"]
          creado_at: string
          creado_por: string | null
          descuento: number
          es_ejemplo: boolean
          estado: Database["public"]["Enums"]["estado_reserva"]
          fin: string
          id: string
          inicio: string
          invitados: number | null
          motivo_cancelacion: string | null
          notas: string | null
          numero: number
          organizacion_id: string
          precio_total: number
          responsable_id: string | null
          sucursal_id: string
          tipo_evento: string
          titulo: string
          vence_tentativa_at: string | null
        }
        Insert: {
          actualizado_at?: string
          cancelada_at?: string | null
          cliente_id: string
          contrato_estado?: Database["public"]["Enums"]["estado_contrato"]
          creado_at?: string
          creado_por?: string | null
          descuento?: number
          es_ejemplo?: boolean
          estado?: Database["public"]["Enums"]["estado_reserva"]
          fin: string
          id?: string
          inicio: string
          invitados?: number | null
          motivo_cancelacion?: string | null
          notas?: string | null
          numero: number
          organizacion_id: string
          precio_total?: number
          responsable_id?: string | null
          sucursal_id: string
          tipo_evento?: string
          titulo: string
          vence_tentativa_at?: string | null
        }
        Update: {
          actualizado_at?: string
          cancelada_at?: string | null
          cliente_id?: string
          contrato_estado?: Database["public"]["Enums"]["estado_contrato"]
          creado_at?: string
          creado_por?: string | null
          descuento?: number
          es_ejemplo?: boolean
          estado?: Database["public"]["Enums"]["estado_reserva"]
          fin?: string
          id?: string
          inicio?: string
          invitados?: number | null
          motivo_cancelacion?: string | null
          notas?: string | null
          numero?: number
          organizacion_id?: string
          precio_total?: number
          responsable_id?: string | null
          sucursal_id?: string
          tipo_evento?: string
          titulo?: string
          vence_tentativa_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservas_organizacion_id_cliente_id_fkey"
            columns: ["organizacion_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "reservas_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_organizacion_id_sucursal_id_fkey"
            columns: ["organizacion_id", "sucursal_id"]
            isOneToOne: false
            referencedRelation: "sucursales"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      rol_permisos: {
        Row: {
          organizacion_id: string
          permiso: string
          rol_id: string
        }
        Insert: {
          organizacion_id: string
          permiso: string
          rol_id: string
        }
        Update: {
          organizacion_id?: string
          permiso?: string
          rol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rol_permisos_organizacion_id_rol_id_fkey"
            columns: ["organizacion_id", "rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "rol_permisos_permiso_fkey"
            columns: ["permiso"]
            isOneToOne: false
            referencedRelation: "permisos"
            referencedColumns: ["clave"]
          },
        ]
      }
      roles: {
        Row: {
          clave: string
          creado_at: string
          descripcion: string | null
          es_sistema: boolean
          id: string
          nombre: string
          organizacion_id: string
        }
        Insert: {
          clave: string
          creado_at?: string
          descripcion?: string | null
          es_sistema?: boolean
          id?: string
          nombre: string
          organizacion_id: string
        }
        Update: {
          clave?: string
          creado_at?: string
          descripcion?: string | null
          es_sistema?: boolean
          id?: string
          nombre?: string
          organizacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      roles_plantilla: {
        Row: {
          clave: string
          descripcion: string
          nombre: string
          orden: number
          permisos: string[]
        }
        Insert: {
          clave: string
          descripcion: string
          nombre: string
          orden: number
          permisos: string[]
        }
        Update: {
          clave?: string
          descripcion?: string
          nombre?: string
          orden?: number
          permisos?: string[]
        }
        Relationships: []
      }
      salones: {
        Row: {
          activo: boolean
          actualizado_at: string
          creado_at: string
          descripcion: string | null
          es_ejemplo: boolean
          id: string
          nombre: string
          organizacion_id: string
        }
        Insert: {
          activo?: boolean
          actualizado_at?: string
          creado_at?: string
          descripcion?: string | null
          es_ejemplo?: boolean
          id?: string
          nombre: string
          organizacion_id: string
        }
        Update: {
          activo?: boolean
          actualizado_at?: string
          creado_at?: string
          descripcion?: string | null
          es_ejemplo?: boolean
          id?: string
          nombre?: string
          organizacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salones_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          activo: boolean
          actualizado_at: string
          categoria: string
          costo: number | null
          creado_at: string
          descripcion: string | null
          es_ejemplo: boolean
          id: string
          nombre: string
          organizacion_id: string
          precio: number
          tipo: string
          unidad: string
        }
        Insert: {
          activo?: boolean
          actualizado_at?: string
          categoria?: string
          costo?: number | null
          creado_at?: string
          descripcion?: string | null
          es_ejemplo?: boolean
          id?: string
          nombre: string
          organizacion_id: string
          precio: number
          tipo?: string
          unidad?: string
        }
        Update: {
          activo?: boolean
          actualizado_at?: string
          categoria?: string
          costo?: number | null
          creado_at?: string
          descripcion?: string | null
          es_ejemplo?: boolean
          id?: string
          nombre?: string
          organizacion_id?: string
          precio?: number
          tipo?: string
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicios_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      sucursales: {
        Row: {
          activo: boolean
          actualizado_at: string
          creado_at: string
          direccion: string | null
          es_ejemplo: boolean
          id: string
          localidad: string | null
          nombre: string
          organizacion_id: string
          provincia: string | null
          salon_id: string
          telefono: string | null
          zona_horaria: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_at?: string
          creado_at?: string
          direccion?: string | null
          es_ejemplo?: boolean
          id?: string
          localidad?: string | null
          nombre: string
          organizacion_id: string
          provincia?: string | null
          salon_id: string
          telefono?: string | null
          zona_horaria?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_at?: string
          creado_at?: string
          direccion?: string | null
          es_ejemplo?: boolean
          id?: string
          localidad?: string | null
          nombre?: string
          organizacion_id?: string
          provincia?: string | null
          salon_id?: string
          telefono?: string | null
          zona_horaria?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sucursales_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sucursales_organizacion_id_salon_id_fkey"
            columns: ["organizacion_id", "salon_id"]
            isOneToOne: false
            referencedRelation: "salones"
            referencedColumns: ["organizacion_id", "id"]
          },
        ]
      }
      tareas: {
        Row: {
          actualizado_at: string
          asignada_a: string | null
          completada_at: string | null
          creado_at: string
          creado_por: string | null
          descripcion: string | null
          es_ejemplo: boolean
          estado: string
          id: string
          organizacion_id: string
          prioridad: string
          reserva_id: string | null
          titulo: string
          vence_el: string | null
        }
        Insert: {
          actualizado_at?: string
          asignada_a?: string | null
          completada_at?: string | null
          creado_at?: string
          creado_por?: string | null
          descripcion?: string | null
          es_ejemplo?: boolean
          estado?: string
          id?: string
          organizacion_id: string
          prioridad?: string
          reserva_id?: string | null
          titulo: string
          vence_el?: string | null
        }
        Update: {
          actualizado_at?: string
          asignada_a?: string | null
          completada_at?: string | null
          creado_at?: string
          creado_por?: string | null
          descripcion?: string | null
          es_ejemplo?: boolean
          estado?: string
          id?: string
          organizacion_id?: string
          prioridad?: string
          reserva_id?: string | null
          titulo?: string
          vence_el?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tareas_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "tareas_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
        ]
      }
    }
    Views: {
      v_cuotas_estado: {
        Row: {
          concepto: string | null
          id: string | null
          monto: number | null
          organizacion_id: string | null
          pendiente: number | null
          reserva_id: string | null
          vencimiento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cuotas_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["organizacion_id", "id"]
          },
          {
            foreignKeyName: "cuotas_organizacion_id_reserva_id_fkey"
            columns: ["organizacion_id", "reserva_id"]
            isOneToOne: false
            referencedRelation: "v_reservas_saldo"
            referencedColumns: ["organizacion_id", "reserva_id"]
          },
        ]
      }
      v_reservas_saldo: {
        Row: {
          organizacion_id: string | null
          pagado: number | null
          precio_total: number | null
          reserva_id: string | null
          saldo: number | null
          total_cuotas: number | null
          vencido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservas_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceptar_invitacion: { Args: { p_token: string }; Returns: string }
      aceptar_presupuesto: {
        Args: { p_estado?: string; p_id: string }
        Returns: string
      }
      agregar_item_reserva: {
        Args: {
          p_cantidad: number
          p_crear_cuota?: boolean
          p_descripcion: string
          p_es_adicional?: boolean
          p_precio: number
          p_reserva: string
          p_servicio?: string
          p_unidad: string
          p_vencimiento?: string
        }
        Returns: string
      }
      borrar_datos_ejemplo: { Args: { p_org: string }; Returns: undefined }
      buscar_global: { Args: { p_org: string; p_q: string }; Returns: Json }
      cancelar_baja_organizacion: {
        Args: { p_org: string }
        Returns: undefined
      }
      cargar_datos_ejemplo: { Args: { p_org: string }; Returns: Json }
      checklist_configuracion: { Args: { p_org: string }; Returns: Json }
      cobrar_garantia: {
        Args: {
          p_fecha: string
          p_medio: string
          p_referencia?: string
          p_reserva: string
        }
        Returns: number
      }
      crear_organizacion: {
        Args: { p_nombre: string; p_zona_horaria?: string }
        Returns: string
      }
      devolver_garantia: {
        Args: {
          p_fecha: string
          p_medio: string
          p_monto_devuelto: number
          p_motivo?: string
          p_reserva: string
        }
        Returns: number
      }
      disparar_push: { Args: never; Returns: undefined }
      es_miembro: { Args: { p_org: string }; Returns: boolean }
      es_propietario: { Args: { p_org: string }; Returns: boolean }
      estado_bloquea: {
        Args: { e: Database["public"]["Enums"]["estado_reserva"] }
        Returns: boolean
      }
      exigir_permiso: {
        Args: { p_org: string; p_permiso: string }
        Returns: undefined
      }
      finalizar_eventos_pasados: { Args: never; Returns: number }
      formato_ars: { Args: { p: number }; Returns: string }
      generar_recordatorios: { Args: never; Returns: number }
      generar_recordatorios_garantias: { Args: never; Returns: number }
      guardar_horarios: {
        Args: { p_espacio: string; p_horarios: Json }
        Returns: undefined
      }
      guardar_presupuesto: {
        Args: { p_datos: Json; p_id: string; p_items: Json; p_org: string }
        Returns: string
      }
      guardar_reserva: {
        Args: { p_datos: Json; p_espacios: Json; p_id: string; p_org: string }
        Returns: string
      }
      importar_clientes: {
        Args: { p_filas: Json; p_org: string }
        Returns: Json
      }
      importar_reservas: {
        Args: { p_filas: Json; p_org: string }
        Returns: Json
      }
      listar_miembros: {
        Args: { p_org: string }
        Returns: {
          activo: boolean
          creado_at: string
          email: string
          membresia_id: string
          nombre: string
          rol: string
          rol_clave: string
          rol_id: string
          usuario_id: string
        }[]
      }
      mis_permisos: { Args: { p_org: string }; Returns: string[] }
      normalizar: { Args: { t: string }; Returns: string }
      notificar: {
        Args: {
          p_clave?: string
          p_cuerpo: string
          p_org: string
          p_tipo: string
          p_titulo: string
          p_url: string
          p_usuarios: string[]
        }
        Returns: undefined
      }
      ocupa_dia: {
        Args: { p_dia: string; p_rango: unknown; p_tz: string }
        Returns: boolean
      }
      org_tiene_funcion: {
        Args: { p_funcion: string; p_org: string }
        Returns: boolean
      }
      panel_resumen: {
        Args: {
          p_desde: string
          p_hasta: string
          p_org: string
          p_responsable?: string
          p_salon?: string
          p_sucursal?: string
        }
        Returns: Json
      }
      pedir_garantia: {
        Args: { p_monto: number; p_reserva: string }
        Returns: string
      }
      purgar_organizaciones_dadas_de_baja: { Args: never; Returns: number }
      quitar_dispositivo: { Args: { p_token: string }; Returns: undefined }
      quitar_garantia: { Args: { p_reserva: string }; Returns: undefined }
      registrar_dispositivo: {
        Args: { p_plataforma: string; p_token: string }
        Returns: undefined
      }
      registrar_pago: {
        Args: {
          p_concepto: string
          p_fecha: string
          p_medio: string
          p_monto: number
          p_notas?: string
          p_referencia?: string
          p_reserva: string
        }
        Returns: string
      }
      sincronizar_ocupaciones_reserva: {
        Args: { p_reserva: string }
        Returns: undefined
      }
      solicitar_baja_organizacion: {
        Args: { p_confirmacion: string; p_org: string }
        Returns: string
      }
      tiene_permiso: {
        Args: { p_org: string; p_permiso: string }
        Returns: boolean
      }
      total_items_reserva: { Args: { p_reserva: string }; Returns: number }
      upsert_ocupacion: {
        Args: {
          p_bloqueante: boolean
          p_bloqueo: string
          p_espacio: string
          p_org: string
          p_rango: unknown
          p_reserva_espacio: string
        }
        Returns: undefined
      }
      usuarios_con_permiso: {
        Args: { p_org: string; p_permiso: string }
        Returns: string[]
      }
      vencer_presupuestos: { Args: never; Returns: number }
      vencer_tentativas: { Args: never; Returns: number }
      ver_invitacion: { Args: { p_token: string }; Returns: Json }
      verificar_disponibilidad: {
        Args: {
          p_espacios: string[]
          p_excluir_reserva?: string
          p_fin: string
          p_inicio: string
          p_invitados?: number
          p_org: string
        }
        Returns: Json
      }
      verificar_limite_plan_membresia: {
        Args: { p_org: string }
        Returns: undefined
      }
    }
    Enums: {
      estado_contrato: "no_requerido" | "pendiente" | "enviado" | "firmado"
      estado_organizacion: "activa" | "suspendida" | "baja_solicitada"
      estado_reserva:
        | "consulta"
        | "tentativa"
        | "senada"
        | "confirmada"
        | "finalizada"
        | "cancelada"
      estado_suscripcion: "prueba" | "activa" | "vencida" | "cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_contrato: ["no_requerido", "pendiente", "enviado", "firmado"],
      estado_organizacion: ["activa", "suspendida", "baja_solicitada"],
      estado_reserva: [
        "consulta",
        "tentativa",
        "senada",
        "confirmada",
        "finalizada",
        "cancelada",
      ],
      estado_suscripcion: ["prueba", "activa", "vencida", "cancelada"],
    },
  },
} as const

