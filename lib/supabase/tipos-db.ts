export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campanas: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubes: {
        Row: {
          actualizado_en: string
          creado_en: string
          escudo_url: string | null
          fecha_fundacion: string | null
          id: string
          id_externo: string | null
          nombre: string
          origen: Database["public"]["Enums"]["origen_dato"]
          pais: string | null
          payload_crudo: Json | null
          proveedor_externo: string | null
          sincronizado_en: string | null
          zona_horaria: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          escudo_url?: string | null
          fecha_fundacion?: string | null
          id?: string
          id_externo?: string | null
          nombre: string
          origen?: Database["public"]["Enums"]["origen_dato"]
          pais?: string | null
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          sincronizado_en?: string | null
          zona_horaria?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          escudo_url?: string | null
          fecha_fundacion?: string | null
          id?: string
          id_externo?: string | null
          nombre?: string
          origen?: Database["public"]["Enums"]["origen_dato"]
          pais?: string | null
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          sincronizado_en?: string | null
          zona_horaria?: string | null
        }
        Relationships: []
      }
      competencias: {
        Row: {
          actualizado_en: string
          cobertura: boolean | null
          codigo: string | null
          creado_en: string
          id: string
          id_externo: string | null
          nombre: string
          origen: Database["public"]["Enums"]["origen_dato"]
          pais: string | null
          payload_crudo: Json | null
          proveedor_externo: string | null
          sincronizado_en: string | null
          tipo: Database["public"]["Enums"]["tipo_competencia"]
        }
        Insert: {
          actualizado_en?: string
          cobertura?: boolean | null
          codigo?: string | null
          creado_en?: string
          id?: string
          id_externo?: string | null
          nombre: string
          origen?: Database["public"]["Enums"]["origen_dato"]
          pais?: string | null
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          sincronizado_en?: string | null
          tipo: Database["public"]["Enums"]["tipo_competencia"]
        }
        Update: {
          actualizado_en?: string
          cobertura?: boolean | null
          codigo?: string | null
          creado_en?: string
          id?: string
          id_externo?: string | null
          nombre?: string
          origen?: Database["public"]["Enums"]["origen_dato"]
          pais?: string | null
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          sincronizado_en?: string | null
          tipo?: Database["public"]["Enums"]["tipo_competencia"]
        }
        Relationships: []
      }
      convocatorias: {
        Row: {
          actualizado_en: string
          creado_en: string
          descripcion: string | null
          fecha: string | null
          id: string
          id_externo: string | null
          jugador_id: string
          origen: Database["public"]["Enums"]["origen_dato"]
          partido_id: string | null
          payload_crudo: Json | null
          proveedor_externo: string | null
          sincronizado_en: string | null
          tipo: Database["public"]["Enums"]["tipo_convocatoria"]
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          fecha?: string | null
          id?: string
          id_externo?: string | null
          jugador_id: string
          origen?: Database["public"]["Enums"]["origen_dato"]
          partido_id?: string | null
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          sincronizado_en?: string | null
          tipo: Database["public"]["Enums"]["tipo_convocatoria"]
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          fecha?: string | null
          id?: string
          id_externo?: string | null
          jugador_id?: string
          origen?: Database["public"]["Enums"]["origen_dato"]
          partido_id?: string | null
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          sincronizado_en?: string | null
          tipo?: Database["public"]["Enums"]["tipo_convocatoria"]
        }
        Relationships: [
          {
            foreignKeyName: "convocatorias_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocatorias_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "totales_jugador"
            referencedColumns: ["jugador_id"]
          },
          {
            foreignKeyName: "convocatorias_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocatorias_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["partido_id"]
          },
        ]
      }
      escalas_hito: {
        Row: {
          activo: boolean
          actualizado_en: string
          aviso: number
          base: Database["public"]["Enums"]["base_hito"]
          creado_en: string
          id: string
          metrica: Database["public"]["Enums"]["metrica_hito"]
          paso: number
          plantilla_frase: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          aviso: number
          base: Database["public"]["Enums"]["base_hito"]
          creado_en?: string
          id?: string
          metrica: Database["public"]["Enums"]["metrica_hito"]
          paso: number
          plantilla_frase: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          aviso?: number
          base?: Database["public"]["Enums"]["base_hito"]
          creado_en?: string
          id?: string
          metrica?: Database["public"]["Enums"]["metrica_hito"]
          paso?: number
          plantilla_frase?: string
        }
        Relationships: []
      }
      estadisticas_partido: {
        Row: {
          actualizado_en: string
          amarillas: number | null
          asistencias: number | null
          creado_en: string
          goles: number | null
          id: string
          jugador_id: string
          minutos: number | null
          origen: Database["public"]["Enums"]["origen_dato"]
          partido_id: string
          payload_crudo: Json | null
          proveedor_externo: string | null
          rojas: number | null
          sincronizado_en: string | null
          titular: boolean | null
          valoracion: number | null
        }
        Insert: {
          actualizado_en?: string
          amarillas?: number | null
          asistencias?: number | null
          creado_en?: string
          goles?: number | null
          id?: string
          jugador_id: string
          minutos?: number | null
          origen?: Database["public"]["Enums"]["origen_dato"]
          partido_id: string
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          rojas?: number | null
          sincronizado_en?: string | null
          titular?: boolean | null
          valoracion?: number | null
        }
        Update: {
          actualizado_en?: string
          amarillas?: number | null
          asistencias?: number | null
          creado_en?: string
          goles?: number | null
          id?: string
          jugador_id?: string
          minutos?: number | null
          origen?: Database["public"]["Enums"]["origen_dato"]
          partido_id?: string
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          rojas?: number | null
          sincronizado_en?: string | null
          titular?: boolean | null
          valoracion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estadisticas_partido_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estadisticas_partido_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "totales_jugador"
            referencedColumns: ["jugador_id"]
          },
          {
            foreignKeyName: "estadisticas_partido_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estadisticas_partido_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["partido_id"]
          },
        ]
      }
      hitos: {
        Row: {
          actualizado_en: string
          club_id: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          destacado: boolean
          fecha: string | null
          fecha_utc: string | null
          id: string
          id_externo: string | null
          jugador_id: string | null
          metadatos: Json | null
          origen: Database["public"]["Enums"]["origen_dato"]
          proveedor_externo: string | null
          tipo: Database["public"]["Enums"]["tipo_hito"]
          titulo: string
          verificado: boolean
        }
        Insert: {
          actualizado_en?: string
          club_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          destacado?: boolean
          fecha?: string | null
          fecha_utc?: string | null
          id?: string
          id_externo?: string | null
          jugador_id?: string | null
          metadatos?: Json | null
          origen?: Database["public"]["Enums"]["origen_dato"]
          proveedor_externo?: string | null
          tipo: Database["public"]["Enums"]["tipo_hito"]
          titulo: string
          verificado?: boolean
        }
        Update: {
          actualizado_en?: string
          club_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          destacado?: boolean
          fecha?: string | null
          fecha_utc?: string | null
          id?: string
          id_externo?: string | null
          jugador_id?: string | null
          metadatos?: Json | null
          origen?: Database["public"]["Enums"]["origen_dato"]
          proveedor_externo?: string | null
          tipo?: Database["public"]["Enums"]["tipo_hito"]
          titulo?: string
          verificado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "hitos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hitos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "hitos_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["rival_id"]
          },
          {
            foreignKeyName: "hitos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hitos_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hitos_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "totales_jugador"
            referencedColumns: ["jugador_id"]
          },
        ]
      }
      jugadores: {
        Row: {
          activo: boolean
          actualizado_en: string
          apellido: string | null
          apodo: string | null
          base_actualizada_en: string | null
          carrera_asistencias_base: number | null
          carrera_goles_base: number | null
          carrera_partidos_base: number | null
          club_actual_id: string | null
          creado_en: string
          debut: string | null
          debut_seleccion: string | null
          dorsal: number | null
          fecha_nacimiento: string | null
          fichaje: string | null
          foto_url: string | null
          id: string
          id_externo: string | null
          instagram: string | null
          nacionalidad: string | null
          nombre: string
          origen: Database["public"]["Enums"]["origen_dato"]
          payload_crudo: Json | null
          posicion: string | null
          proveedor_externo: string | null
          representante_id: string | null
          seleccion: string | null
          seleccion_goles_base: number | null
          seleccion_partidos_base: number | null
          sincronizado_en: string | null
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          apellido?: string | null
          apodo?: string | null
          base_actualizada_en?: string | null
          carrera_asistencias_base?: number | null
          carrera_goles_base?: number | null
          carrera_partidos_base?: number | null
          club_actual_id?: string | null
          creado_en?: string
          debut?: string | null
          debut_seleccion?: string | null
          dorsal?: number | null
          fecha_nacimiento?: string | null
          fichaje?: string | null
          foto_url?: string | null
          id?: string
          id_externo?: string | null
          instagram?: string | null
          nacionalidad?: string | null
          nombre: string
          origen?: Database["public"]["Enums"]["origen_dato"]
          payload_crudo?: Json | null
          posicion?: string | null
          proveedor_externo?: string | null
          representante_id?: string | null
          seleccion?: string | null
          seleccion_goles_base?: number | null
          seleccion_partidos_base?: number | null
          sincronizado_en?: string | null
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          apellido?: string | null
          apodo?: string | null
          base_actualizada_en?: string | null
          carrera_asistencias_base?: number | null
          carrera_goles_base?: number | null
          carrera_partidos_base?: number | null
          club_actual_id?: string | null
          creado_en?: string
          debut?: string | null
          debut_seleccion?: string | null
          dorsal?: number | null
          fecha_nacimiento?: string | null
          fichaje?: string | null
          foto_url?: string | null
          id?: string
          id_externo?: string | null
          instagram?: string | null
          nacionalidad?: string | null
          nombre?: string
          origen?: Database["public"]["Enums"]["origen_dato"]
          payload_crudo?: Json | null
          posicion?: string | null
          proveedor_externo?: string | null
          representante_id?: string | null
          seleccion?: string | null
          seleccion_goles_base?: number | null
          seleccion_partidos_base?: number | null
          sincronizado_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jugadores_club_actual_id_fkey"
            columns: ["club_actual_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jugadores_club_actual_id_fkey"
            columns: ["club_actual_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "jugadores_club_actual_id_fkey"
            columns: ["club_actual_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["rival_id"]
          },
          {
            foreignKeyName: "jugadores_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partidos: {
        Row: {
          actualizado_en: string
          ciudad: string | null
          club_local_id: string | null
          club_visitante_id: string | null
          competencia_id: string | null
          creado_en: string
          es_local: boolean | null
          estadio: string | null
          estado: Database["public"]["Enums"]["estado_partido"]
          id: string
          id_externo: string | null
          inicio_utc: string | null
          marcador_local: number | null
          marcador_visitante: number | null
          origen: Database["public"]["Enums"]["origen_dato"]
          payload_crudo: Json | null
          proveedor_externo: string | null
          ronda: string | null
          sincronizado_en: string | null
          tentativo: boolean
          zona_horaria_evento: string | null
        }
        Insert: {
          actualizado_en?: string
          ciudad?: string | null
          club_local_id?: string | null
          club_visitante_id?: string | null
          competencia_id?: string | null
          creado_en?: string
          es_local?: boolean | null
          estadio?: string | null
          estado?: Database["public"]["Enums"]["estado_partido"]
          id?: string
          id_externo?: string | null
          inicio_utc?: string | null
          marcador_local?: number | null
          marcador_visitante?: number | null
          origen?: Database["public"]["Enums"]["origen_dato"]
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          ronda?: string | null
          sincronizado_en?: string | null
          tentativo?: boolean
          zona_horaria_evento?: string | null
        }
        Update: {
          actualizado_en?: string
          ciudad?: string | null
          club_local_id?: string | null
          club_visitante_id?: string | null
          competencia_id?: string | null
          creado_en?: string
          es_local?: boolean | null
          estadio?: string | null
          estado?: Database["public"]["Enums"]["estado_partido"]
          id?: string
          id_externo?: string | null
          inicio_utc?: string | null
          marcador_local?: number | null
          marcador_visitante?: number | null
          origen?: Database["public"]["Enums"]["origen_dato"]
          payload_crudo?: Json | null
          proveedor_externo?: string | null
          ronda?: string | null
          sincronizado_en?: string | null
          tentativo?: boolean
          zona_horaria_evento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partidos_club_local_id_fkey"
            columns: ["club_local_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_club_local_id_fkey"
            columns: ["club_local_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "partidos_club_local_id_fkey"
            columns: ["club_local_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["rival_id"]
          },
          {
            foreignKeyName: "partidos_club_visitante_id_fkey"
            columns: ["club_visitante_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_club_visitante_id_fkey"
            columns: ["club_visitante_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["club_id"]
          },
          {
            foreignKeyName: "partidos_club_visitante_id_fkey"
            columns: ["club_visitante_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["rival_id"]
          },
          {
            foreignKeyName: "partidos_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["competencia_id"]
          },
        ]
      }
      partidos_jugadores: {
        Row: {
          actualizado_en: string
          con_seleccion: boolean
          convocado: boolean | null
          creado_en: string
          jugador_id: string
          partido_id: string
        }
        Insert: {
          actualizado_en?: string
          con_seleccion?: boolean
          convocado?: boolean | null
          creado_en?: string
          jugador_id: string
          partido_id: string
        }
        Update: {
          actualizado_en?: string
          con_seleccion?: boolean
          convocado?: boolean | null
          creado_en?: string
          jugador_id?: string
          partido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partidos_jugadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_jugadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "totales_jugador"
            referencedColumns: ["jugador_id"]
          },
          {
            foreignKeyName: "partidos_jugadores_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "partidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_jugadores_partido_id_fkey"
            columns: ["partido_id"]
            isOneToOne: false
            referencedRelation: "proximos_partidos"
            referencedColumns: ["partido_id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          actualizado_en: string
          avisos: Json
          cargo: string
          creado_en: string
          id: string
          nombre_completo: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          tema: string
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          avisos?: Json
          cargo?: string
          creado_en?: string
          id: string
          nombre_completo?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          tema?: string
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          avisos?: Json
          cargo?: string
          creado_en?: string
          id?: string
          nombre_completo?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          tema?: string
        }
        Relationships: []
      }
      piezas: {
        Row: {
          actualizado_en: string
          campana_id: string | null
          creado_en: string
          creado_por: string | null
          estado: Database["public"]["Enums"]["estado_pieza"]
          id: string
          jugador_id: string | null
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          campana_id?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_pieza"]
          id?: string
          jugador_id?: string | null
          titulo: string
        }
        Update: {
          actualizado_en?: string
          campana_id?: string | null
          creado_en?: string
          creado_por?: string | null
          estado?: Database["public"]["Enums"]["estado_pieza"]
          id?: string
          jugador_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "piezas_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "campanas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piezas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piezas_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piezas_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "totales_jugador"
            referencedColumns: ["jugador_id"]
          },
        ]
      }
      piezas_aprobaciones: {
        Row: {
          aprobador_id: string | null
          comentario: string | null
          creado_en: string
          estado_destino: Database["public"]["Enums"]["estado_pieza"]
          id: string
          pieza_id: string
        }
        Insert: {
          aprobador_id?: string | null
          comentario?: string | null
          creado_en?: string
          estado_destino: Database["public"]["Enums"]["estado_pieza"]
          id?: string
          pieza_id: string
        }
        Update: {
          aprobador_id?: string | null
          comentario?: string | null
          creado_en?: string
          estado_destino?: Database["public"]["Enums"]["estado_pieza"]
          id?: string
          pieza_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "piezas_aprobaciones_aprobador_id_fkey"
            columns: ["aprobador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piezas_aprobaciones_pieza_id_fkey"
            columns: ["pieza_id"]
            isOneToOne: false
            referencedRelation: "piezas"
            referencedColumns: ["id"]
          },
        ]
      }
      piezas_comentarios: {
        Row: {
          autor_id: string | null
          creado_en: string
          id: string
          pieza_id: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          creado_en?: string
          id?: string
          pieza_id: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          creado_en?: string
          id?: string
          pieza_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "piezas_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piezas_comentarios_pieza_id_fkey"
            columns: ["pieza_id"]
            isOneToOne: false
            referencedRelation: "piezas"
            referencedColumns: ["id"]
          },
        ]
      }
      piezas_versiones: {
        Row: {
          alto: number | null
          ancho: number | null
          creado_en: string
          creado_por: string | null
          formato: string | null
          hash: string | null
          id: string
          imagen_url: string
          peso_bytes: number | null
          pieza_id: string
        }
        Insert: {
          alto?: number | null
          ancho?: number | null
          creado_en?: string
          creado_por?: string | null
          formato?: string | null
          hash?: string | null
          id?: string
          imagen_url: string
          peso_bytes?: number | null
          pieza_id: string
        }
        Update: {
          alto?: number | null
          ancho?: number | null
          creado_en?: string
          creado_por?: string | null
          formato?: string | null
          hash?: string | null
          id?: string
          imagen_url?: string
          peso_bytes?: number | null
          pieza_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "piezas_versiones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piezas_versiones_pieza_id_fkey"
            columns: ["pieza_id"]
            isOneToOne: false
            referencedRelation: "piezas"
            referencedColumns: ["id"]
          },
        ]
      }
      sincronizaciones: {
        Row: {
          error_detalle: string | null
          estado: Database["public"]["Enums"]["estado_sync"] | null
          finalizado_en: string | null
          id: string
          iniciado_en: string
          parametros: Json | null
          proveedor: string
          recurso: Database["public"]["Enums"]["recurso_sync"]
          registros_afectados: number | null
        }
        Insert: {
          error_detalle?: string | null
          estado?: Database["public"]["Enums"]["estado_sync"] | null
          finalizado_en?: string | null
          id?: string
          iniciado_en?: string
          parametros?: Json | null
          proveedor: string
          recurso: Database["public"]["Enums"]["recurso_sync"]
          registros_afectados?: number | null
        }
        Update: {
          error_detalle?: string | null
          estado?: Database["public"]["Enums"]["estado_sync"] | null
          finalizado_en?: string | null
          id?: string
          iniciado_en?: string
          parametros?: Json | null
          proveedor?: string
          recurso?: Database["public"]["Enums"]["recurso_sync"]
          registros_afectados?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      agenda_anual: {
        Row: {
          club_id: string | null
          competencia_codigo: string | null
          cuando_utc: string | null
          dia_uy: string | null
          es_internacional: boolean | null
          fuente: string | null
          jugador_id: string | null
          ref_id: string | null
          tentativo: boolean | null
          titulo: string | null
        }
        Relationships: []
      }
      proximos_partidos: {
        Row: {
          ciudad: string | null
          club_escudo_url: string | null
          club_id: string | null
          club_nombre: string | null
          competencia_cobertura: boolean | null
          competencia_codigo: string | null
          competencia_id: string | null
          competencia_nombre: string | null
          competencia_tipo:
            | Database["public"]["Enums"]["tipo_competencia"]
            | null
          con_seleccion: boolean | null
          convocado: boolean | null
          dia_uy: string | null
          es_internacional: boolean | null
          es_local: boolean | null
          estadio: string | null
          estado: Database["public"]["Enums"]["estado_partido"] | null
          inicio_local_sede: string | null
          inicio_local_uy: string | null
          inicio_utc: string | null
          jugador_apodo: string | null
          jugador_foto_url: string | null
          jugador_id: string | null
          jugador_nombre: string | null
          jugador_seleccion: string | null
          marcador_local: number | null
          marcador_visitante: number | null
          partido_id: string | null
          rival_escudo_url: string | null
          rival_id: string | null
          rival_nombre: string | null
          ronda: string | null
          sincronizado_en: string | null
          tentativo: boolean | null
          zona_horaria_evento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partidos_jugadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_jugadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "totales_jugador"
            referencedColumns: ["jugador_id"]
          },
        ]
      }
      temporada_actual: {
        Row: {
          amarillas: number | null
          asistencias: number | null
          goles: number | null
          jugador_id: string | null
          minutos: number | null
          partidos: number | null
          rojas: number | null
          valoracion_promedio: number | null
        }
        Relationships: [
          {
            foreignKeyName: "partidos_jugadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "jugadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidos_jugadores_jugador_id_fkey"
            columns: ["jugador_id"]
            isOneToOne: false
            referencedRelation: "totales_jugador"
            referencedColumns: ["jugador_id"]
          },
        ]
      }
      totales_jugador: {
        Row: {
          carrera_asistencias: number | null
          carrera_goles: number | null
          carrera_partidos: number | null
          jugador_id: string | null
          seleccion_goles: number | null
          seleccion_partidos: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      es_usuario_activo: { Args: never; Returns: boolean }
    }
    Enums: {
      base_hito: "carrera" | "seleccion"
      estado_partido:
        | "programado"
        | "en_juego"
        | "finalizado"
        | "suspendido"
        | "sin_datos"
      estado_pieza:
        | "borrador"
        | "en_revision"
        | "cambios_pedidos"
        | "aprobada"
        | "publicada"
        | "archivada"
      estado_sync: "ok" | "error" | "parcial"
      metrica_hito: "pj" | "g" | "a"
      origen_dato: "api" | "manual" | "derivado"
      recurso_sync: "partidos" | "estadisticas" | "agenda" | "roster"
      rol_usuario: "usuario"
      tipo_competencia: "liga" | "copa" | "continental" | "seleccion"
      tipo_convocatoria: "club" | "seleccion"
      tipo_hito:
        | "debut"
        | "gol_numero"
        | "partido_numero"
        | "titulo"
        | "traspaso"
        | "cumpleanos"
        | "aniversario_club"
        | "renovacion"
        | "lesion"
        | "hito_interno"
        | "otro"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      base_hito: ["carrera", "seleccion"],
      estado_partido: [
        "programado",
        "en_juego",
        "finalizado",
        "suspendido",
        "sin_datos",
      ],
      estado_pieza: [
        "borrador",
        "en_revision",
        "cambios_pedidos",
        "aprobada",
        "publicada",
        "archivada",
      ],
      estado_sync: ["ok", "error", "parcial"],
      metrica_hito: ["pj", "g", "a"],
      origen_dato: ["api", "manual", "derivado"],
      recurso_sync: ["partidos", "estadisticas", "agenda", "roster"],
      rol_usuario: ["usuario"],
      tipo_competencia: ["liga", "copa", "continental", "seleccion"],
      tipo_convocatoria: ["club", "seleccion"],
      tipo_hito: [
        "debut",
        "gol_numero",
        "partido_numero",
        "titulo",
        "traspaso",
        "cumpleanos",
        "aniversario_club",
        "renovacion",
        "lesion",
        "hito_interno",
        "otro",
      ],
    },
  },
} as const
