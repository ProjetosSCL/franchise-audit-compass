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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          action: string
          audit_period_id: string | null
          cost_usd: number | null
          created_at: string
          finding_id: string | null
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          requested_by: string | null
          updated_at: string
        }
        Insert: {
          action: string
          audit_period_id?: string | null
          cost_usd?: number | null
          created_at?: string
          finding_id?: string | null
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          requested_by?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          audit_period_id?: string | null
          cost_usd?: number | null
          created_at?: string
          finding_id?: string | null
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          requested_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_audit_period_id_fkey"
            columns: ["audit_period_id"]
            isOneToOne: false
            referencedRelation: "audit_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "audit_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_findings: {
        Row: {
          ai_contestation_text: string | null
          ai_explanation: string | null
          audit_period_id: string
          cidade: string | null
          created_at: string
          data_atendimento: string | null
          detail: string | null
          diferenca: number | null
          franchise_id: string
          grupo_servico: string | null
          id: string
          observation: string | null
          os: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          rule_id: number
          severity: string
          stonecode: string | null
          tecnico: string | null
          title: string
          updated_at: string
          valor_base_os: number | null
          valor_pago: number | null
        }
        Insert: {
          ai_contestation_text?: string | null
          ai_explanation?: string | null
          audit_period_id: string
          cidade?: string | null
          created_at?: string
          data_atendimento?: string | null
          detail?: string | null
          diferenca?: number | null
          franchise_id: string
          grupo_servico?: string | null
          id?: string
          observation?: string | null
          os?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_id: number
          severity: string
          stonecode?: string | null
          tecnico?: string | null
          title: string
          updated_at?: string
          valor_base_os?: number | null
          valor_pago?: number | null
        }
        Update: {
          ai_contestation_text?: string | null
          ai_explanation?: string | null
          audit_period_id?: string
          cidade?: string | null
          created_at?: string
          data_atendimento?: string | null
          detail?: string | null
          diferenca?: number | null
          franchise_id?: string
          grupo_servico?: string | null
          id?: string
          observation?: string | null
          os?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_id?: number
          severity?: string
          stonecode?: string | null
          tecnico?: string | null
          title?: string
          updated_at?: string
          valor_base_os?: number | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_audit_period_id_fkey"
            columns: ["audit_period_id"]
            isOneToOne: false
            referencedRelation: "audit_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_findings_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "audit_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_periods: {
        Row: {
          consolidado_bobina: number | null
          consolidado_stone: number | null
          consolidado_ton: number | null
          consolidado_total: number | null
          consolidado_triagem: number | null
          created_at: string
          created_by: string | null
          franchise_id: string
          id: string
          open_findings_count: number
          processed_at: string | null
          realigned_rows_count: number
          reference_month: string
          status: string
          stone_file_id: string | null
          total_difference: number | null
          total_validation_diff: number | null
          total_valor_base: number | null
          total_valor_pago: number | null
          updated_at: string
          value_at_risk: number
          workinfinity_file_id: string | null
        }
        Insert: {
          consolidado_bobina?: number | null
          consolidado_stone?: number | null
          consolidado_ton?: number | null
          consolidado_total?: number | null
          consolidado_triagem?: number | null
          created_at?: string
          created_by?: string | null
          franchise_id: string
          id?: string
          open_findings_count?: number
          processed_at?: string | null
          realigned_rows_count?: number
          reference_month: string
          status?: string
          stone_file_id?: string | null
          total_difference?: number | null
          total_validation_diff?: number | null
          total_valor_base?: number | null
          total_valor_pago?: number | null
          updated_at?: string
          value_at_risk?: number
          workinfinity_file_id?: string | null
        }
        Update: {
          consolidado_bobina?: number | null
          consolidado_stone?: number | null
          consolidado_ton?: number | null
          consolidado_total?: number | null
          consolidado_triagem?: number | null
          created_at?: string
          created_by?: string | null
          franchise_id?: string
          id?: string
          open_findings_count?: number
          processed_at?: string | null
          realigned_rows_count?: number
          reference_month?: string
          status?: string
          stone_file_id?: string | null
          total_difference?: number | null
          total_validation_diff?: number | null
          total_valor_base?: number | null
          total_valor_pago?: number | null
          updated_at?: string
          value_at_risk?: number
          workinfinity_file_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_periods_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_periods_stone_file_id_fkey"
            columns: ["stone_file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_periods_workinfinity_file_id_fkey"
            columns: ["workinfinity_file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_rules: {
        Row: {
          created_at: string
          description: string | null
          id: number
          is_enabled: boolean
          name: string
          rule_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: number
          is_enabled?: boolean
          name: string
          rule_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          is_enabled?: boolean
          name?: string
          rule_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      franchise_name_aliases: {
        Row: {
          created_at: string
          created_by: string | null
          franchise_id: string
          id: string
          raw_name: string
          raw_name_normalized: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          franchise_id: string
          id?: string
          raw_name: string
          raw_name_normalized: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          franchise_id?: string
          id?: string
          raw_name?: string
          raw_name_normalized?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "franchise_name_aliases_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      franchises: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      price_table_entries: {
        Row: {
          created_at: string
          expected_valor_base: number
          grupo_servico: string
          id: string
          is_manual_override: boolean
          produto: string
          raio: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          expected_valor_base: number
          grupo_servico: string
          id?: string
          is_manual_override?: boolean
          produto: string
          raio: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          expected_valor_base?: number
          grupo_servico?: string
          id?: string
          is_manual_override?: boolean
          produto?: string
          raio?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      stone_bonificacao_records: {
        Row: {
          aproveitamento_triagem: number | null
          audit_period_id: string
          ciclo: string | null
          created_at: string
          id: string
          retirados: number | null
          rv_payload: Json | null
          tma_stone: number | null
          tma_ton: number | null
          triados: number | null
          triados_good: number | null
          updated_at: string
        }
        Insert: {
          aproveitamento_triagem?: number | null
          audit_period_id: string
          ciclo?: string | null
          created_at?: string
          id?: string
          retirados?: number | null
          rv_payload?: Json | null
          tma_stone?: number | null
          tma_ton?: number | null
          triados?: number | null
          triados_good?: number | null
          updated_at?: string
        }
        Update: {
          aproveitamento_triagem?: number | null
          audit_period_id?: string
          ciclo?: string | null
          created_at?: string
          id?: string
          retirados?: number | null
          rv_payload?: Json | null
          tma_stone?: number | null
          tma_ton?: number | null
          triados?: number | null
          triados_good?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stone_bonificacao_records_audit_period_id_fkey"
            columns: ["audit_period_id"]
            isOneToOne: false
            referencedRelation: "audit_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      stone_os_records: {
        Row: {
          abono: string | null
          atraso: string | null
          atraso_dias_uteis: number | null
          audit_period_id: string
          cidade: string | null
          created_at: string
          data_abertura: string | null
          data_atendimento: string | null
          data_limite_atendimento: string | null
          dias_ate_atendimento: number | null
          distancia_km: number | null
          em_auditoria: number | null
          grupo_servico: string | null
          id: string
          motivo_cancelamento: string | null
          multa: number | null
          nome_tecnico: string | null
          os: string
          os_key: string
          produto: string | null
          raio: string | null
          status: string | null
          status_pagamento: string | null
          stonecode: string | null
          uf: string | null
          updated_at: string
          valor_base_os: number | null
          valor_pago: number | null
          visitas: number | null
          was_realigned: boolean
        }
        Insert: {
          abono?: string | null
          atraso?: string | null
          atraso_dias_uteis?: number | null
          audit_period_id: string
          cidade?: string | null
          created_at?: string
          data_abertura?: string | null
          data_atendimento?: string | null
          data_limite_atendimento?: string | null
          dias_ate_atendimento?: number | null
          distancia_km?: number | null
          em_auditoria?: number | null
          grupo_servico?: string | null
          id?: string
          motivo_cancelamento?: string | null
          multa?: number | null
          nome_tecnico?: string | null
          os: string
          os_key: string
          produto?: string | null
          raio?: string | null
          status?: string | null
          status_pagamento?: string | null
          stonecode?: string | null
          uf?: string | null
          updated_at?: string
          valor_base_os?: number | null
          valor_pago?: number | null
          visitas?: number | null
          was_realigned?: boolean
        }
        Update: {
          abono?: string | null
          atraso?: string | null
          atraso_dias_uteis?: number | null
          audit_period_id?: string
          cidade?: string | null
          created_at?: string
          data_abertura?: string | null
          data_atendimento?: string | null
          data_limite_atendimento?: string | null
          dias_ate_atendimento?: number | null
          distancia_km?: number | null
          em_auditoria?: number | null
          grupo_servico?: string | null
          id?: string
          motivo_cancelamento?: string | null
          multa?: number | null
          nome_tecnico?: string | null
          os?: string
          os_key?: string
          produto?: string | null
          raio?: string | null
          status?: string | null
          status_pagamento?: string | null
          stonecode?: string | null
          uf?: string | null
          updated_at?: string
          valor_base_os?: number | null
          valor_pago?: number | null
          visitas?: number | null
          was_realigned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "stone_os_records_audit_period_id_fkey"
            columns: ["audit_period_id"]
            isOneToOne: false
            referencedRelation: "audit_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      stone_triagem_records: {
        Row: {
          audit_period_id: string
          created_at: string
          id: string
          mes_ref: string | null
          serial: string | null
          status_triagem: string | null
          updated_at: string
          valor_triagem: number | null
        }
        Insert: {
          audit_period_id: string
          created_at?: string
          id?: string
          mes_ref?: string | null
          serial?: string | null
          status_triagem?: string | null
          updated_at?: string
          valor_triagem?: number | null
        }
        Update: {
          audit_period_id?: string
          created_at?: string
          id?: string
          mes_ref?: string | null
          serial?: string | null
          status_triagem?: string | null
          updated_at?: string
          valor_triagem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stone_triagem_records_audit_period_id_fkey"
            columns: ["audit_period_id"]
            isOneToOne: false
            referencedRelation: "audit_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_files: {
        Row: {
          created_at: string
          detected_raw_name: string | null
          dropped_pii_columns: boolean
          file_kind: string
          franchise_id: string | null
          id: string
          original_filename: string
          reference_month: string
          row_count: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          detected_raw_name?: string | null
          dropped_pii_columns?: boolean
          file_kind: string
          franchise_id?: string | null
          id?: string
          original_filename: string
          reference_month: string
          row_count?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          detected_raw_name?: string | null
          dropped_pii_columns?: boolean
          file_kind?: string
          franchise_id?: string | null
          id?: string
          original_filename?: string
          reference_month?: string
          row_count?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_files_franchise_id_fkey"
            columns: ["franchise_id"]
            isOneToOne: false
            referencedRelation: "franchises"
            referencedColumns: ["id"]
          },
        ]
      }
      workinfinity_records: {
        Row: {
          abono: string | null
          audit_period_id: string
          chamado: string
          chamado_key: string
          cidade: string | null
          contratante: string | null
          created_at: string
          data_atendimento: string | null
          descricao_motivo: string | null
          grupo_servico: string | null
          id: string
          numero_visitas: number | null
          prestador: string | null
          serial_instalado: string | null
          serial_retirado: string | null
          status: string | null
          tecnico: string | null
          updated_at: string
        }
        Insert: {
          abono?: string | null
          audit_period_id: string
          chamado: string
          chamado_key: string
          cidade?: string | null
          contratante?: string | null
          created_at?: string
          data_atendimento?: string | null
          descricao_motivo?: string | null
          grupo_servico?: string | null
          id?: string
          numero_visitas?: number | null
          prestador?: string | null
          serial_instalado?: string | null
          serial_retirado?: string | null
          status?: string | null
          tecnico?: string | null
          updated_at?: string
        }
        Update: {
          abono?: string | null
          audit_period_id?: string
          chamado?: string
          chamado_key?: string
          cidade?: string | null
          contratante?: string | null
          created_at?: string
          data_atendimento?: string | null
          descricao_motivo?: string | null
          grupo_servico?: string | null
          id?: string
          numero_visitas?: number | null
          prestador?: string | null
          serial_instalado?: string | null
          serial_retirado?: string | null
          status?: string | null
          tecnico?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workinfinity_records_audit_period_id_fkey"
            columns: ["audit_period_id"]
            isOneToOne: false
            referencedRelation: "audit_periods"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_month_import: {
        Args: {
          p_data: Json
          p_file: Json
          p_franchise_id: string
          p_save_alias?: boolean
          p_user_id: string
        }
        Returns: string
      }
      get_dashboard_cards: {
        Args: { p_reference_month: string }
        Returns: {
          audit_period_id: string
          display_name: string
          franchise_id: string
          open_findings_count: number
          status: string
          total_difference: number
          total_validation_diff: number
          total_valor_base: number
          total_valor_pago: number
          value_at_risk: number
        }[]
      }
      get_findings: {
        Args: {
          p_audit_period_id: string
          p_cidade?: string
          p_grupo_servico?: string
          p_review_status?: string
          p_rule_id?: number
          p_severity?: string
          p_tecnico?: string
        }
        Returns: {
          ai_contestation_text: string
          ai_explanation: string
          audit_period_id: string
          cidade: string
          data_atendimento: string
          detail: string
          diferenca: number
          franchise_id: string
          grupo_servico: string
          id: string
          observation: string
          os: string
          review_status: string
          rule_id: number
          rule_key: string
          rule_name: string
          severity: string
          stonecode: string
          tecnico: string
          title: string
          valor_base_os: number
          valor_pago: number
        }[]
      }
      get_franchise_reconciliation: {
        Args: { p_audit_period_id: string }
        Returns: {
          consolidado_bobina: number
          consolidado_stone: number
          consolidado_ton: number
          consolidado_total: number
          consolidado_triagem: number
          realigned_rows_count: number
          total_difference: number
          total_validation_diff: number
          total_valor_base: number
          total_valor_pago: number
        }[]
      }
      get_trend_series: {
        Args: { p_consolidated: boolean; p_franchise_id: string }
        Returns: {
          is_atypical_variation: boolean
          pct_valor_base_retido: number
          qtd_os: number
          reference_month: string
          retencao_por_regra: Json
          value_at_risk: number
        }[]
      }
      get_unmatched_os: {
        Args: { p_audit_period_id: string }
        Returns: {
          classification: string
          direction: string
          key: string
          os: string
          status: string
          valor_base_os: number
          valor_pago: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
