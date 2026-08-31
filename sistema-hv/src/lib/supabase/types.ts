// Tipos do schema Supabase do Sistema HV.
// PLACEHOLDER — regenere com `npm run db:types` após aplicar migrations.
// Convenção: todas as tabelas/views/funcs do sistema usam prefixo `system_`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      system_distribution_simulations: {
        Row: {
          id: string;
          organization_id: string;
          simulation_run_id: string;
          simulated_at: string;
          simulation_mode: string;
          task_id: string;
          process_id: string;
          distribution_date: string;
          final_points: number;
          flow: string | null;
          base_date: string | null;
          applicable_limit: string | null;
          preferred_date: string | null;
          final_date: string | null;
          executor_id: string | null;
          preference_applied: boolean;
          alerts: string[];
          blocked: boolean;
        };
        Insert: {
          id?: string;
          organization_id: string;
          simulation_run_id: string;
          simulated_at?: string;
          simulation_mode: string;
          task_id: string;
          process_id: string;
          distribution_date: string;
          final_points?: number;
          flow?: string | null;
          base_date?: string | null;
          applicable_limit?: string | null;
          preferred_date?: string | null;
          final_date?: string | null;
          executor_id?: string | null;
          preference_applied?: boolean;
          alerts?: string[];
          blocked?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_simulations"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_results: {
        Row: {
          id: string;
          organization_id: string;
          task_id: string;
          process_id: string;
          distribution_date: string;
          final_points: number;
          flow: string;
          base_date: string;
          applicable_limit: string;
          preferred_date: string | null;
          final_date: string;
          executor_id: string;
          preference_applied: boolean;
          alerts: string[];
          writeback_pending: boolean;
          raw_data: Json | null;
          created_at: string;
          blocked: boolean;
          origem: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          task_id: string;
          process_id: string;
          distribution_date: string;
          final_points: number;
          flow: string;
          base_date: string;
          applicable_limit: string;
          preferred_date?: string | null;
          final_date: string;
          executor_id: string;
          preference_applied?: boolean;
          alerts?: string[];
          writeback_pending?: boolean;
          raw_data?: Json | null;
          created_at?: string;
          blocked?: boolean;
          origem?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_results"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_approvals: {
        Row: {
          id: string;
          organization_id: string;
          distribution_result_id: string;
          status: "pending" | "approved" | "rejected";
          decided_by: string | null;
          decided_at: string | null;
          reason: string | null;
          original_executor_id: string | null;
          override_executor_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          distribution_result_id: string;
          status?: "pending" | "approved" | "rejected";
          decided_by?: string | null;
          decided_at?: string | null;
          reason?: string | null;
          original_executor_id?: string | null;
          override_executor_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_approvals"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_calendar: {
        Row: {
          id: string;
          organization_id: string;
          date: string;
          block_type: string;
          executor_id: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          date: string;
          block_type: string;
          executor_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_calendar"]["Insert"]>;
        Relationships: [];
      };
      system_projuris_executor_mapping: {
        Row: {
          id: string;
          organization_id: string;
          projuris_responsavel_id: string;
          executor_id: string;
          active: boolean;
          created_at: string;
          updated_at: string;
          weight: number;
          eligible_complex: boolean;
          authorized_task_types: string[];
          authorized_themes: string[];
        };
        Insert: {
          id?: string;
          organization_id: string;
          projuris_responsavel_id: string;
          executor_id: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          weight?: number;
          eligible_complex?: boolean;
          authorized_task_types?: string[];
          authorized_themes?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["system_projuris_executor_mapping"]["Insert"]>;
        Relationships: [];
      };
      system_task_type_theme_exclusives: {
        Row: {
          id: string;
          organization_id: string;
          task_type_id: string;
          tema_id: string;
          executor_id: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          task_type_id: string;
          tema_id: string;
          executor_id: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["system_task_type_theme_exclusives"]["Insert"]
        >;
        Relationships: [];
      };
      system_distribution_movements: {
        Row: {
          id: string;
          organization_id: string;
          origem: string;
          projuris_id: string | null;
          projuris_processo_codigo: string | null;
          numero_cnj: string | null;
          descricao: string | null;
          cliente_nome: string | null;
          data_referencia: string | null;
          raw: Json | null;
          case_id: string | null;
          tema_id: string | null;
          decisao: string;
          task_type_id: string | null;
          decidido_por: string | null;
          decidido_em: string | null;
          created_at: string;
          updated_at: string;
          situacao_projuris: string | null;
          client_id: string | null;
          projuris_sync_at: string | null;
          projuris_sync_error: string | null;
          criado_por: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          origem: string;
          projuris_id?: string | null;
          projuris_processo_codigo?: string | null;
          numero_cnj?: string | null;
          descricao?: string | null;
          cliente_nome?: string | null;
          data_referencia?: string | null;
          raw?: Json | null;
          case_id?: string | null;
          tema_id?: string | null;
          decisao?: string;
          task_type_id?: string | null;
          decidido_por?: string | null;
          decidido_em?: string | null;
          created_at?: string;
          updated_at?: string;
          situacao_projuris?: string | null;
          client_id?: string | null;
          projuris_sync_at?: string | null;
          projuris_sync_error?: string | null;
          criado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_movements"]["Insert"]>;
        Relationships: [];
      };
      system_case_projuris_processos: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          codigo_processo: number;
          identificador: string | null;
          numero_cnj: string | null;
          assunto: string | null;
          principal: boolean;
          relacao: string | null;
          vinculado_por: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          codigo_processo: number;
          identificador?: string | null;
          numero_cnj?: string | null;
          assunto?: string | null;
          principal?: boolean;
          relacao?: string | null;
          vinculado_por?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_projuris_processos"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_staging: {
        Row: {
          id: string;
          organization_id: string;
          movement_id: string | null;
          case_id: string | null;
          tema_id: string | null;
          task_type_id: string | null;
          numero_cnj: string | null;
          cliente_nome: string | null;
          coletivo: boolean;
          complexo: boolean;
          urgente: boolean;
          exclusive_executor_id: string | null;
          data_prevista: string | null;
          data_fatal: string | null;
          pontos: number | null;
          overrides: Json;
          status: string;
          distribuido_em: string | null;
          distribuido_por: string | null;
          created_at: string;
          updated_at: string;
          preparado_por: string | null;
          projuris_codigo_tarefa: string | null;
          projuris_sync_at: string | null;
          projuris_sync_error: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          movement_id?: string | null;
          case_id?: string | null;
          tema_id?: string | null;
          task_type_id?: string | null;
          numero_cnj?: string | null;
          cliente_nome?: string | null;
          coletivo?: boolean;
          complexo?: boolean;
          urgente?: boolean;
          exclusive_executor_id?: string | null;
          data_prevista?: string | null;
          data_fatal?: string | null;
          pontos?: number | null;
          overrides?: Json;
          status?: string;
          distribuido_em?: string | null;
          distribuido_por?: string | null;
          created_at?: string;
          updated_at?: string;
          preparado_por?: string | null;
          projuris_codigo_tarefa?: string | null;
          projuris_sync_at?: string | null;
          projuris_sync_error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_staging"]["Insert"]>;
        Relationships: [];
      };
      system_case_judicial_andamento_pins: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          andamento_key: string;
          event_id: string | null;
          descricao: string | null;
          data_andamento: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          andamento_key: string;
          event_id?: string | null;
          descricao?: string | null;
          data_andamento?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["system_case_judicial_andamento_pins"]["Insert"]
        >;
        Relationships: [];
      };
      system_task_type_mapping: {
        Row: {
          id: string;
          organization_id: string;
          projuris_tipo_codigo: string;
          motor_task_type_id: string;
          points: number;
          complexity_level: number;
          temporal_level: number;
          active: boolean;
          created_at: string;
          updated_at: string;
          projuris_tipo_descricao: string | null;
          exclusive_executor_id: string | null;
          prazo_previsto_dias: number | null;
          prazo_fatal_dias: number | null;
          classe: string | null;
          aparece_no_motor: boolean;
          archived_at: string | null;
          sync_projuris: boolean;
          projuris_classificacao: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          projuris_tipo_codigo: string;
          motor_task_type_id: string;
          points?: number;
          complexity_level?: number;
          temporal_level?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          projuris_tipo_descricao?: string | null;
          exclusive_executor_id?: string | null;
          prazo_previsto_dias?: number | null;
          prazo_fatal_dias?: number | null;
          classe?: string | null;
          aparece_no_motor?: boolean;
          archived_at?: string | null;
          sync_projuris?: boolean;
          projuris_classificacao?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_task_type_mapping"]["Insert"]>;
        Relationships: [];
      };
      system_theme_mapping: {
        Row: {
          id: string;
          organization_id: string;
          projuris_tema_codigo: string;
          motor_theme_id: string;
          multiplier: number;
          temporal_level: number;
          active: boolean;
          created_at: string;
          updated_at: string;
          projuris_tema_descricao: string | null;
          exclusive_executor_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          projuris_tema_codigo: string;
          motor_theme_id: string;
          multiplier?: number;
          temporal_level?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          projuris_tema_descricao?: string | null;
          exclusive_executor_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_theme_mapping"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_config: {
        Row: {
          id: string;
          organization_id: string;
          mode: string;
          batch_hour: number;
          updated_at: string;
          updated_by: string | null;
          active: boolean;
          projuris_base_url: string | null;
          projuris_auth_type: string | null;
          projuris_username: string | null;
          projuris_password: string | null;
          projuris_token: string | null;
          projuris_api_key: string | null;
          pontos_dia_controle: number;
          pontos_dia_producao: number;
          projuris_writeback_ativo: boolean;
        };
        Insert: {
          id?: string;
          organization_id: string;
          mode?: string;
          batch_hour?: number;
          updated_at?: string;
          updated_by?: string | null;
          active?: boolean;
          projuris_base_url?: string | null;
          projuris_auth_type?: string | null;
          projuris_username?: string | null;
          projuris_password?: string | null;
          projuris_token?: string | null;
          projuris_api_key?: string | null;
          pontos_dia_controle?: number;
          pontos_dia_producao?: number;
          projuris_writeback_ativo?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_config"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_batch_logs: {
        Row: {
          id: string;
          organization_id: string;
          batch_date: string;
          started_at: string;
          completed_at: string | null;
          status: string;
          total_tasks: number;
          successful: number;
          failed: number;
          alerts_generated: number;
          error_message: string | null;
          metrics: Json | null;
          created_at: string;
          is_simulation: boolean;
        };
        Insert: {
          id?: string;
          organization_id: string;
          batch_date: string;
          started_at?: string;
          completed_at?: string | null;
          status?: string;
          total_tasks?: number;
          successful?: number;
          failed?: number;
          alerts_generated?: number;
          error_message?: string | null;
          metrics?: Json | null;
          created_at?: string;
          is_simulation?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_batch_logs"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_exceptions: {
        Row: {
          id: string;
          organization_id: string;
          distribution_result_id: string | null;
          task_id: string;
          alert_code: string;
          status: string;
          manual_executor_id: string | null;
          override_reason: string | null;
          ignore_reason: string | null;
          action_by: string | null;
          action_at: string | null;
          created_at: string;
          process_id: string | null;
          detail: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          distribution_result_id?: string | null;
          task_id: string;
          alert_code: string;
          status?: string;
          manual_executor_id?: string | null;
          override_reason?: string | null;
          ignore_reason?: string | null;
          action_by?: string | null;
          action_at?: string | null;
          created_at?: string;
          process_id?: string | null;
          detail?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_exceptions"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_kanban_tasks: {
        Row: {
          id: string;
          organization_id: string;
          task_id: string;
          process_id: string | null;
          process_nome: string | null;
          numero_processo: string | null;
          tipo_nome: string | null;
          situacao: string | null;
          situacao_col: string;
          concluida: boolean;
          responsavel_ids: string[];
          responsavel_nomes: string[];
          prazo_previsto: string | null;
          prazo_fatal: string | null;
          synced_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          task_id: string;
          process_id?: string | null;
          process_nome?: string | null;
          numero_processo?: string | null;
          tipo_nome?: string | null;
          situacao?: string | null;
          situacao_col?: string;
          concluida?: boolean;
          responsavel_ids?: string[];
          responsavel_nomes?: string[];
          prazo_previsto?: string | null;
          prazo_fatal?: string | null;
          synced_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_kanban_tasks"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_manual_assignments: {
        Row: {
          id: string;
          organization_id: string;
          task_id: string;
          distribution_date: string;
          projuris_responsavel_id: string | null;
          executor_id: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          task_id: string;
          distribution_date: string;
          projuris_responsavel_id?: string | null;
          executor_id?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["system_distribution_manual_assignments"]["Insert"]
        >;
        Relationships: [];
      };
      system_distribution_queue_state: {
        Row: {
          id: string;
          organization_id: string;
          batch_date: string;
          general_balances: Json;
          complex_balances: Json;
          rotating_order: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          batch_date: string;
          general_balances?: Json;
          complex_balances?: Json;
          rotating_order?: string[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_distribution_queue_state"]["Insert"]>;
        Relationships: [];
      };
      system_distribution_writeback_log: {
        Row: {
          id: string;
          organization_id: string;
          distribution_result_id: string;
          task_id: string;
          executor_id: string;
          projuris_responsavel_id: string;
          error: string | null;
          attempt: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          distribution_result_id: string;
          task_id: string;
          executor_id: string;
          projuris_responsavel_id: string;
          error?: string | null;
          attempt?: number;
          status?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["system_distribution_writeback_log"]["Insert"]
        >;
        Relationships: [];
      };
      system_organizations: {
        Row: {
          id: string;
          name: string;
          cnpj: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          cnpj?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_organizations"]["Insert"]>;
        Relationships: [];
      };
      system_clients: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          cpf_cnpj: string;
          rg: string | null;
          tipo: string | null;
          person_type: string | null;
          professional_data: Json | null;
          custom_fields: Json | null;
          email: string | null;
          phone: string | null;
          address: Json | null;
          drive_folder_id: string | null;
          drive_folder_url: string | null;
          drive_sync_failed: boolean;
          drive_sync_error: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          marcado_cliente_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          full_name: string;
          cpf_cnpj: string;
          rg?: string | null;
          tipo?: string | null;
          person_type?: string | null;
          professional_data?: Json | null;
          custom_fields?: Json | null;
          email?: string | null;
          phone?: string | null;
          address?: Json | null;
          drive_folder_id?: string | null;
          drive_folder_url?: string | null;
          drive_sync_failed?: boolean;
          drive_sync_error?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          marcado_cliente_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_clients"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_clients_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "system_organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      system_client_field_defs: {
        Row: {
          id: string;
          organization_id: string;
          key: string;
          label: string;
          field_type: string;
          options: Json | null;
          required: boolean;
          help_text: string | null;
          ordem: number;
          active: boolean;
          // B1 (2026-08-05) — o campo do cliente "aparece nos casos" (espelhado).
          appears_in_cases: boolean;
          // C1 (2026-08-26) — paridade com os campos do CASO.
          max_occurrences: number;
          initial_occurrences: number;
          subtitle_mode: string | null;
          subtitles: Json;
          parent_field_def_id: string | null;
          linked_field_def_id: string | null;
          hidden_in_list: boolean;
          hidden_in_filters: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          key: string;
          label: string;
          field_type: string;
          options?: Json | null;
          required?: boolean;
          help_text?: string | null;
          ordem?: number;
          active?: boolean;
          appears_in_cases?: boolean;
          max_occurrences?: number;
          initial_occurrences?: number;
          subtitle_mode?: string | null;
          subtitles?: Json;
          parent_field_def_id?: string | null;
          linked_field_def_id?: string | null;
          hidden_in_list?: boolean;
          hidden_in_filters?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_client_field_defs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_client_field_defs_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "system_organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      // B1 (2026-08-05) — vínculo N:N campo-do-cliente → tema. Ao vincular, o
      // backend reconcilia uma def-espelho (system_tema_field_defs scope='cliente')
      // no tema; ao desvincular (soft), oculta a espelho. Fonte única = cliente.
      system_client_field_tema_links: {
        Row: {
          id: string;
          organization_id: string;
          client_field_def_id: string;
          tema_id: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_field_def_id: string;
          tema_id: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_client_field_tema_links"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_client_field_tema_links_client_field_def_id_fkey";
            columns: ["client_field_def_id"];
            referencedRelation: "system_client_field_defs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_client_field_tema_links_tema_id_fkey";
            columns: ["tema_id"];
            referencedRelation: "system_temas";
            referencedColumns: ["id"];
          },
        ];
      };
      system_stage_checklist_defs: {
        Row: {
          id: string;
          organization_id: string;
          service_type_id: string;
          stage_slug: string;
          key: string;
          label: string;
          ordem: number;
          required: boolean;
          expected_doc_pattern: string | null;
          active: boolean;
          assigned_to: string | null;
          frente_slug: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          service_type_id: string;
          stage_slug: string;
          key: string;
          label: string;
          ordem?: number;
          required?: boolean;
          expected_doc_pattern?: string | null;
          active?: boolean;
          assigned_to?: string | null;
          frente_slug?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_stage_checklist_defs"]["Insert"]>;
        Relationships: [];
      };
      system_case_checklist_items: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          def_id: string | null;
          stage_slug: string;
          label: string | null;
          required: boolean;
          ordem: number;
          done: boolean;
          done_at: string | null;
          done_by: string | null;
          source: string;
          drive_file_id: string | null;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          def_id?: string | null;
          stage_slug: string;
          label?: string | null;
          required?: boolean;
          ordem?: number;
          done?: boolean;
          done_at?: string | null;
          done_by?: string | null;
          source?: string;
          drive_file_id?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_checklist_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_case_checklist_items_def_id_fkey";
            columns: ["def_id"];
            referencedRelation: "system_stage_checklist_defs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_case_checklist_items_case_id_fkey";
            columns: ["case_id"];
            referencedRelation: "system_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      system_case_checklist_item_assignees: {
        Row: {
          id: string;
          item_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["system_case_checklist_item_assignees"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "system_case_checklist_item_assignees_item_id_fkey";
            columns: ["item_id"];
            referencedRelation: "system_case_checklist_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_case_checklist_item_assignees_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "system_users";
            referencedColumns: ["id"];
          },
        ];
      };
      system_stage_checklist_def_assignees: {
        Row: {
          id: string;
          def_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          def_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["system_stage_checklist_def_assignees"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "system_stage_checklist_def_assignees_def_id_fkey";
            columns: ["def_id"];
            referencedRelation: "system_stage_checklist_defs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_stage_checklist_def_assignees_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "system_users";
            referencedColumns: ["id"];
          },
        ];
      };
      system_case_honorarios: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          percentual_honorarios: number | null;
          valor_parcela_centavos: number | null;
          desconto_avista_pct: number | null;
          forma_pagamento: string | null;
          honorarios_total_centavos: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          percentual_honorarios?: number | null;
          valor_parcela_centavos?: number | null;
          desconto_avista_pct?: number | null;
          forma_pagamento?: string | null;
          honorarios_total_centavos?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_honorarios"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_case_honorarios_case_id_fkey";
            columns: ["case_id"];
            referencedRelation: "system_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      system_client_documents: {
        Row: {
          id: string;
          client_id: string;
          organization_id: string;
          name: string;
          description: string | null;
          drive_file_id: string;
          drive_url: string;
          mime_type: string | null;
          size_bytes: number | null;
          sha256: string | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          organization_id: string;
          name: string;
          description?: string | null;
          drive_file_id: string;
          drive_url: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          sha256?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_client_documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_client_documents_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "system_clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_client_documents_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "system_organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      system_case_documents: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          document_number: number | null;
          title: string;
          description: string | null;
          status: string;
          source: string;
          template_id: string | null;
          google_doc_id: string | null;
          drive_file_id: string | null;
          drive_url: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          sha256: string | null;
          goes_to_zapsign: boolean;
          zapsign_doc_token: string | null;
          zapsign_sign_url: string | null;
          doc_kind: string | null;
          // C1 (2026-07-20) — valores dos placeholders usados na geração.
          values: Json | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          document_number?: number | null;
          title: string;
          description?: string | null;
          status?: string;
          source?: string;
          template_id?: string | null;
          google_doc_id?: string | null;
          drive_file_id?: string | null;
          drive_url?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          sha256?: string | null;
          goes_to_zapsign?: boolean;
          zapsign_doc_token?: string | null;
          zapsign_sign_url?: string | null;
          doc_kind?: string | null;
          values?: Json | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_documents"]["Insert"]>;
        Relationships: [];
      };
      system_document_templates: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          case_type: string | null;
          google_doc_id: string;
          fields: Json;
          goes_to_zapsign: boolean;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          case_type?: string | null;
          google_doc_id: string;
          fields?: Json;
          goes_to_zapsign?: boolean;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_document_templates"]["Insert"]>;
        Relationships: [];
      };
      system_webhook_dedupe: {
        Row: {
          id: string;
          provider: string;
          external_id: string;
          event_type: string | null;
          payload: Json | null;
          received_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          external_id: string;
          event_type?: string | null;
          payload?: Json | null;
          received_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_webhook_dedupe"]["Insert"]>;
        Relationships: [];
      };
      system_service_types: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          active: boolean;
          ordem: number;
          tema_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug: string;
          active?: boolean;
          ordem?: number;
          tema_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_service_types"]["Insert"]>;
        Relationships: [];
      };
      system_service_type_folders: {
        Row: {
          id: string;
          organization_id: string;
          service_type_id: string;
          kind: string;
          drive_folder_id: string;
          name: string;
          ordem: number;
          frente_slug: string | null;
          created_by: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          service_type_id: string;
          kind: string;
          drive_folder_id: string;
          name: string;
          ordem?: number;
          frente_slug?: string | null;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_service_type_folders"]["Insert"]>;
        Relationships: [];
      };
      system_temas: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          slug: string;
          active: boolean;
          ordem: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          drive_folder_id: string | null;
          drive_folder_url: string | null;
          drive_casos_folder_id: string | null;
          drive_contratacao_folder_id: string | null;
          // FN1 (2026-08-26) — Desenho 6: centro de custo e serviço do ContaAzul,
          // 1 por TEMA ("sempre que a gente for trabalhar um tema, ele é para tudo").
          contaazul_centro_custo_id: string | null;
          contaazul_centro_custo_nome: string | null;
          contaazul_servico_id: string | null;
          contaazul_servico_nome: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          slug: string;
          active?: boolean;
          ordem?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          drive_folder_id?: string | null;
          drive_folder_url?: string | null;
          drive_casos_folder_id?: string | null;
          drive_contratacao_folder_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_temas"]["Insert"]>;
        Relationships: [];
      };
      system_tema_frentes: {
        Row: {
          id: string;
          organization_id: string;
          tema_id: string;
          slug: string;
          label: string;
          ordem: number;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          tema_id: string;
          slug: string;
          label: string;
          ordem?: number;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_tema_frentes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_tema_frentes_tema_id_fkey";
            columns: ["tema_id"];
            referencedRelation: "system_temas";
            referencedColumns: ["id"];
          },
        ];
      };
      system_tema_field_defs: {
        Row: {
          id: string;
          organization_id: string;
          tema_id: string;
          frente_slug: string | null;
          key: string;
          label: string;
          type: string;
          options: Json | null;
          ordem: number;
          required: boolean;
          active: boolean;
          scope: string;
          hidden_in_list: boolean;
          hidden_in_filters: boolean;
          max_occurrences: number;
          initial_occurrences: number;
          move_to_stage_slug: string | null;
          parent_field_def_id: string | null;
          // C1 (2026-08-26) — campo VINCULADO (aparecem juntos na tela).
          linked_field_def_id: string | null;
          subtitle_mode: string | null;
          subtitles: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          tema_id: string;
          frente_slug?: string | null;
          key: string;
          label: string;
          type: string;
          options?: Json | null;
          ordem?: number;
          required?: boolean;
          active?: boolean;
          scope?: string;
          hidden_in_list?: boolean;
          hidden_in_filters?: boolean;
          max_occurrences?: number;
          initial_occurrences?: number;
          subtitle_mode?: string | null;
          subtitles?: Json;
          move_to_stage_slug?: string | null;
          parent_field_def_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_tema_field_defs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_tema_field_defs_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "system_organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_tema_field_defs_tema_id_fkey";
            columns: ["tema_id"];
            referencedRelation: "system_temas";
            referencedColumns: ["id"];
          },
        ];
      };
      system_pipeline_stages: {
        Row: {
          id: string;
          organization_id: string;
          service_type_id: string;
          kind: string;
          slug: string;
          label: string;
          stage_role: string;
          color: string | null;
          ordem: number;
          active: boolean;
          frente_slug: string | null;
          board_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          service_type_id: string;
          kind: string;
          slug: string;
          label: string;
          stage_role?: string;
          color?: string | null;
          ordem?: number;
          active?: boolean;
          frente_slug?: string | null;
          board_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_pipeline_stages"]["Insert"]>;
        Relationships: [];
      };
      system_pipeline_boards: {
        Row: {
          id: string;
          organization_id: string;
          service_type_id: string;
          slug: string;
          label: string;
          ordem: number;
          is_principal: boolean;
          kind: string | null;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          service_type_id: string;
          slug: string;
          label: string;
          ordem?: number;
          is_principal?: boolean;
          kind?: string | null;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_pipeline_boards"]["Insert"]>;
        Relationships: [];
      };
      system_case_board_positions: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          board_id: string;
          stage_id: string | null;
          stage_slug: string | null;
          entered_at: string;
          exclusive: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          board_id: string;
          stage_id?: string | null;
          stage_slug?: string | null;
          entered_at?: string;
          exclusive?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_board_positions"]["Insert"]>;
        Relationships: [];
      };
      system_tema_wiki_blocks: {
        Row: {
          id: string;
          organization_id: string;
          tema_id: string;
          titulo: string;
          itens: Json;
          ordem: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          tema_id: string;
          titulo: string;
          itens?: Json;
          ordem?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_tema_wiki_blocks"]["Insert"]>;
        Relationships: [];
      };
      system_parcelas: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          termo_id: string;
          numero: number;
          valor_centavos: number;
          vencimento: string;
          status: string;
          data_pagamento: string | null;
          valor_pago_centavos: number | null;
          metodo_pagamento: string | null;
          provider: string | null;
          provider_ext_id: string | null;
          boleto_url: string | null;
          contaazul_fatura_numero: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          termo_id: string;
          numero: number;
          valor_centavos: number;
          vencimento: string;
          status?: string;
          data_pagamento?: string | null;
          valor_pago_centavos?: number | null;
          metodo_pagamento?: string | null;
          provider?: string | null;
          provider_ext_id?: string | null;
          boleto_url?: string | null;
          contaazul_fatura_numero?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_parcelas"]["Insert"]>;
        Relationships: [];
      };
      system_termo_snapshots: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          version: number;
          supersedes: string | null;
          saldo_antes_centavos: number;
          saldo_depois_centavos: number;
          parcelas_pagas_centavos: number;
          valor_efetivo_centavos: number;
          percentual_honorarios: number;
          valor_total_centavos: number;
          valor_parcela_centavos: number;
          qtd_parcelas: number;
          valor_ultima_parcela_centavos: number;
          desconto_avista_pct: number;
          valor_avista_centavos: number;
          forma_pagamento: string;
          tipo_termo: string;
          status: string;
          elaborado_por_id: string | null;
          conferido_por_id: string | null;
          aprovado_por_id: string | null;
          aprovacao_automatica: boolean;
          criterios_aprovacao: Json | null;
          drive_file_id: string | null;
          drive_url: string | null;
          pdf_hash_sha256: string | null;
          remanescente_anterior_centavos: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          version?: number;
          supersedes?: string | null;
          saldo_antes_centavos: number;
          saldo_depois_centavos: number;
          parcelas_pagas_centavos?: number;
          valor_efetivo_centavos: number;
          percentual_honorarios?: number;
          valor_total_centavos: number;
          valor_parcela_centavos?: number;
          qtd_parcelas: number;
          valor_ultima_parcela_centavos?: number;
          desconto_avista_pct?: number;
          valor_avista_centavos: number;
          forma_pagamento?: string;
          tipo_termo?: string;
          status?: string;
          elaborado_por_id?: string | null;
          conferido_por_id?: string | null;
          aprovado_por_id?: string | null;
          aprovacao_automatica?: boolean;
          criterios_aprovacao?: Json | null;
          drive_file_id?: string | null;
          drive_url?: string | null;
          pdf_hash_sha256?: string | null;
          remanescente_anterior_centavos?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_termo_snapshots"]["Insert"]>;
        Relationships: [];
      };
      system_cases: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          case_code: string;
          case_type: string;
          macrostatus_op: string;
          macrostatus_fin: string;
          proximo_passo: string | null;
          responsavel: string | null;
          municipio: string | null;
          valor_centavos: number | null;
          inadimplente: boolean;
          status_changed_at: string;
          status_fin_changed_at: string;
          drive_folder_id: string | null;
          drive_folder_url: string | null;
          // D1 (2026-08-26) — subpasta "Documentos automáticos" (só o que o SHV gera).
          drive_auto_folder_id: string | null;
          drive_auto_folder_url: string | null;
          drive_sync_failed: boolean;
          drive_sync_error: string | null;
          service_type_id: string | null;
          stage_op_id: string | null;
          stage_fin_id: string | null;
          acerto_parcial: boolean;
          tem_pendencia_judicial: boolean;
          acerto_parcial_obs: string | null;
          removido_do_operacional_at: string | null;
          aguardando_assinatura_at: string | null;
          assinatura_liberada_at: string | null;
          assinatura_liberada_by: string | null;
          lifecycle: string;
          perdido_at: string | null;
          perdido_motivo: string | null;
          canonical_fields: Json | null;
          macrostatus_comercial: string | null;
          stage_comercial_id: string | null;
          procuracao_assinada_at: string | null;
          tema_id: string | null;
          frente_slug: string | null;
          caso_pasta_nome: string | null;
          caso_pasta_drive_id: string | null;
          projuris_codigo_processo: number | null;
          projuris_numero_processo: string | null;
          sigiloso: boolean;
          observacoes: string | null;
          distribution_urgency: string | null;
          fields_locked: boolean;
          honorarios_estimados_centavos: number | null;
          honorarios_provisionados_centavos: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          case_code: string;
          case_type: string;
          macrostatus_op?: string;
          macrostatus_fin?: string;
          proximo_passo?: string | null;
          responsavel?: string | null;
          municipio?: string | null;
          valor_centavos?: number | null;
          inadimplente?: boolean;
          status_changed_at?: string;
          status_fin_changed_at?: string;
          drive_folder_id?: string | null;
          drive_folder_url?: string | null;
          drive_auto_folder_id?: string | null;
          drive_auto_folder_url?: string | null;
          drive_sync_failed?: boolean;
          drive_sync_error?: string | null;
          service_type_id?: string | null;
          stage_op_id?: string | null;
          stage_fin_id?: string | null;
          acerto_parcial?: boolean;
          tem_pendencia_judicial?: boolean;
          acerto_parcial_obs?: string | null;
          removido_do_operacional_at?: string | null;
          aguardando_assinatura_at?: string | null;
          assinatura_liberada_at?: string | null;
          assinatura_liberada_by?: string | null;
          lifecycle?: string;
          perdido_at?: string | null;
          perdido_motivo?: string | null;
          canonical_fields?: Json | null;
          macrostatus_comercial?: string | null;
          stage_comercial_id?: string | null;
          procuracao_assinada_at?: string | null;
          tema_id?: string | null;
          frente_slug?: string | null;
          caso_pasta_nome?: string | null;
          caso_pasta_drive_id?: string | null;
          projuris_codigo_processo?: number | null;
          projuris_numero_processo?: string | null;
          sigiloso?: boolean;
          observacoes?: string | null;
          distribution_urgency?: string | null;
          fields_locked?: boolean;
          honorarios_estimados_centavos?: number | null;
          honorarios_provisionados_centavos?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_cases"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_cases_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "system_clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_cases_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "system_organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      system_workflow_rules: {
        Row: {
          id: string;
          organization_id: string;
          // W1 (2026-08-26) — identificador curto e imutável (WF-0007) + grupo visual.
          code: string | null;
          group_name: string | null;
          name: string;
          active: boolean;
          tema_id: string | null;
          trigger_type: string;
          trigger_config: Json;
          actions: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          code?: string | null;
          group_name?: string | null;
          name: string;
          active?: boolean;
          tema_id?: string | null;
          trigger_type: string;
          trigger_config?: Json;
          actions?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_workflow_rules"]["Insert"]>;
        Relationships: [];
      };
      system_workflow_runs: {
        Row: {
          id: string;
          organization_id: string;
          rule_id: string;
          case_id: string;
          event_key: string;
          status: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          rule_id: string;
          case_id: string;
          event_key: string;
          status?: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_workflow_runs"]["Insert"]>;
        Relationships: [];
      };
      system_case_links: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          linked_case_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          linked_case_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_links"]["Insert"]>;
        Relationships: [];
      };
      system_case_events: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          action: string;
          from_macrostatus_op: string | null;
          to_macrostatus_op: string | null;
          diff: Json | null;
          triggered_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          action: string;
          from_macrostatus_op?: string | null;
          to_macrostatus_op?: string | null;
          diff?: Json | null;
          triggered_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_case_events_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "system_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_case_events_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "system_cases_active";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_case_events_triggered_by";
            columns: ["triggered_by"];
            isOneToOne: false;
            referencedRelation: "system_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_case_events_triggered_by";
            columns: ["triggered_by"];
            isOneToOne: false;
            referencedRelation: "system_users_active";
            referencedColumns: ["id"];
          },
        ];
      };
      system_case_notes: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          body: string;
          scope: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          body: string;
          scope?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_notes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_case_notes_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "system_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      system_case_judicial_processos: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          projuris_codigo_processo: number | null;
          numero_processo: string | null;
          tribunal: string | null;
          orgao: string | null;
          fase: string | null;
          assunto: string | null;
          orgao_julgador: string | null;
          classe_cnj: string | null;
          situacao: string | null;
          instancia: string | null;
          vara: string | null;
          tipo_justica: string | null;
          data_distribuicao: string | null;
          valor_causa_centavos: number | null;
          monitoramento_push: boolean | null;
          data_julgamento: string | null;
          resultado_encerramento: string | null;
          descricao_encerramento: string | null;
          data_ultima_modificacao: string | null;
          raw: Json | null;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          projuris_codigo_processo?: number | null;
          numero_processo?: string | null;
          tribunal?: string | null;
          orgao?: string | null;
          fase?: string | null;
          assunto?: string | null;
          orgao_julgador?: string | null;
          classe_cnj?: string | null;
          situacao?: string | null;
          instancia?: string | null;
          vara?: string | null;
          tipo_justica?: string | null;
          data_distribuicao?: string | null;
          valor_causa_centavos?: number | null;
          monitoramento_push?: boolean | null;
          data_julgamento?: string | null;
          resultado_encerramento?: string | null;
          descricao_encerramento?: string | null;
          data_ultima_modificacao?: string | null;
          raw?: Json | null;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_judicial_processos"]["Insert"]>;
        Relationships: [];
      };
      system_case_judicial_tasks: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          projuris_codigo_tarefa: string;
          tipo_codigo: string | null;
          tipo_nome: string | null;
          responsavel_projuris_cod: string | null;
          responsavel_nome: string | null;
          situacao: string | null;
          concluida: boolean;
          prazo_previsto: string | null;
          prazo_fatal: string | null;
          raw: Json | null;
          synced_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          projuris_codigo_tarefa: string;
          tipo_codigo?: string | null;
          tipo_nome?: string | null;
          responsavel_projuris_cod?: string | null;
          responsavel_nome?: string | null;
          situacao?: string | null;
          concluida?: boolean;
          prazo_previsto?: string | null;
          prazo_fatal?: string | null;
          raw?: Json | null;
          synced_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_judicial_tasks"]["Insert"]>;
        Relationships: [];
      };
      system_case_sigilo_users: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          user_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          user_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_sigilo_users"]["Insert"]>;
        Relationships: [];
      };
      system_client_notes: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          body: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          body: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_client_notes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_client_notes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "system_clients";
            referencedColumns: ["id"];
          },
        ];
      };
      system_audit_log: {
        Row: {
          id: string;
          organization_id: string | null;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          diff: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          diff?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_audit_log"]["Insert"]>;
        Relationships: [];
      };
      // FN1 (2026-08-26) — FINANCEIRO DO CASO (doc 25.08 Financeiro SHV).
      system_fin_categorias: {
        Row: {
          id: string;
          organization_id: string;
          kind: string;
          codigo: string;
          nome: string;
          parent_id: string | null;
          reembolsavel: boolean;
          contaazul_id: string | null;
          ordem: number;
          active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          kind: string;
          codigo: string;
          nome: string;
          parent_id?: string | null;
          reembolsavel?: boolean;
          contaazul_id?: string | null;
          ordem?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_fin_categorias"]["Insert"]>;
        Relationships: [];
      };
      system_case_fin_entries: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          kind: string;
          tipo: string;
          categoria_id: string | null;
          status: string;
          descricao: string | null;
          valor_centavos: number;
          forma_pagamento: string | null;
          conta_financeira: string | null;
          data_vencimento: string | null;
          parcelas: number;
          periodicidade_meses: number;
          fornecedor: string | null;
          recorrente: boolean;
          reembolsavel: boolean;
          origem_despesa_id: string | null;
          contaazul_registro_id: string | null;
          contaazul_sync_at: string | null;
          contaazul_sync_error: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          kind: string;
          tipo: string;
          categoria_id?: string | null;
          status?: string;
          descricao?: string | null;
          valor_centavos: number;
          forma_pagamento?: string | null;
          conta_financeira?: string | null;
          data_vencimento?: string | null;
          parcelas?: number;
          periodicidade_meses?: number;
          fornecedor?: string | null;
          recorrente?: boolean;
          reembolsavel?: boolean;
          origem_despesa_id?: string | null;
          contaazul_registro_id?: string | null;
          contaazul_sync_at?: string | null;
          contaazul_sync_error?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_fin_entries"]["Insert"]>;
        Relationships: [];
      };
      system_case_fin_installments: {
        Row: {
          id: string;
          organization_id: string;
          entry_id: string;
          numero: number;
          data_vencimento: string;
          valor_centavos: number;
          status: string;
          valor_pago_centavos: number | null;
          data_pagamento: string | null;
          contaazul_parcela_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          entry_id: string;
          numero: number;
          data_vencimento: string;
          valor_centavos: number;
          status?: string;
          valor_pago_centavos?: number | null;
          data_pagamento?: string | null;
          contaazul_parcela_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_fin_installments"]["Insert"]>;
        Relationships: [];
      };
      system_case_tasks: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          assignee: string | null;
          assignee_id: string | null;
          due_date: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          task_type_id: string | null;
          // W1 (2026-08-26) — qual workflow criou a tarefa (NULL = criada por gente).
          created_by_workflow_id: string | null;
          // 31.08 — índice da AÇÃO da regra que criou (caminho de volta do encadeamento).
          created_by_workflow_action: number | null;
          // 2026-08-27 — espelho no ProJuris. `projuris_codigo_tarefa` é o
          // codigoTarefaEvento; NULL = tarefa que só existe no SHV.
          projuris_codigo_tarefa: string | null;
          projuris_sync_at: string | null;
          projuris_sync_error: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string;
          assignee?: string | null;
          assignee_id?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          task_type_id?: string | null;
          created_by_workflow_id?: string | null;
          created_by_workflow_action?: number | null;
          projuris_codigo_tarefa?: string | null;
          projuris_sync_at?: string | null;
          projuris_sync_error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_tasks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_case_tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "system_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_case_tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "system_users_active";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_case_tasks_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "system_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_case_tasks_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "system_cases_active";
            referencedColumns: ["id"];
          },
        ];
      };
      system_case_deadlines: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          title: string;
          tipo: string | null;
          fatal_date: string;
          recommended_date: string | null;
          status: string;
          responsible: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          title: string;
          tipo?: string | null;
          fatal_date: string;
          recommended_date?: string | null;
          status?: string;
          responsible?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_deadlines"]["Insert"]>;
        Relationships: [];
      };
      system_case_communications: {
        Row: {
          id: string;
          case_id: string;
          organization_id: string;
          channel: string;
          direction: string;
          summary: string;
          content: string | null;
          contact: string | null;
          occurred_at: string;
          created_by: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          case_id: string;
          organization_id: string;
          channel?: string;
          direction?: string;
          summary: string;
          content?: string | null;
          contact?: string | null;
          occurred_at?: string;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_communications"]["Insert"]>;
        Relationships: [];
      };
      system_users: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          role: string;
          status: string;
          perfil: string | null;
          cargo: string | null;
          unidade_organizacional: string | null;
          peticionante: boolean;
          participa_distribuicao_padrao: boolean;
          status_projuris: string | null;
          equipe: string | null;
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          role?: string;
          status?: string;
          perfil?: string | null;
          cargo?: string | null;
          unidade_organizacional?: string | null;
          peticionante?: boolean;
          participa_distribuicao_padrao?: boolean;
          status_projuris?: string | null;
          equipe?: string | null;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_users"]["Insert"]>;
        Relationships: [];
      };
      system_case_responsaveis: {
        Row: {
          id: string;
          organization_id: string;
          case_id: string;
          user_id: string;
          created_by: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          user_id: string;
          created_by?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_case_responsaveis"]["Insert"]>;
        Relationships: [];
      };
      system_consent_records: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string | null;
          cpf_cnpj: string | null;
          finalidade: string;
          policy_version: string;
          channel: string | null;
          ip_address: string | null;
          user_agent: string | null;
          granted_at: string;
          revoked_at: string | null;
          revoke_reason: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id?: string | null;
          cpf_cnpj?: string | null;
          finalidade: string;
          policy_version?: string;
          channel?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
          revoke_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_consent_records"]["Insert"]>;
        Relationships: [];
      };
      system_user_module_perms: {
        Row: {
          id: string;
          user_id: string;
          module: string;
          access: string | null;
          can_view_values: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          module: string;
          access?: string | null;
          can_view_values?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_user_module_perms"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "system_user_module_perms_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "system_users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      system_clients_active: {
        Row: Database["public"]["Tables"]["system_clients"]["Row"];
        Relationships: [];
      };
      system_client_documents_active: {
        Row: Database["public"]["Tables"]["system_client_documents"]["Row"];
        Relationships: [];
      };
      system_client_field_defs_active: {
        Row: Database["public"]["Tables"]["system_client_field_defs"]["Row"];
        Relationships: [];
      };
      system_client_field_tema_links_active: {
        Row: Database["public"]["Tables"]["system_client_field_tema_links"]["Row"];
        Relationships: [];
      };
      system_stage_checklist_defs_active: {
        Row: Database["public"]["Tables"]["system_stage_checklist_defs"]["Row"];
        Relationships: [];
      };
      system_case_checklist_items_active: {
        Row: Database["public"]["Tables"]["system_case_checklist_items"]["Row"];
        Relationships: [];
      };
      system_case_notes_active: {
        Row: Database["public"]["Tables"]["system_case_notes"]["Row"];
        Relationships: [];
      };
      system_client_notes_active: {
        Row: Database["public"]["Tables"]["system_client_notes"]["Row"];
        Relationships: [];
      };
      system_cases_active: {
        Row: Database["public"]["Tables"]["system_cases"]["Row"] & {
          client_name: string;
          client_cpf_cnpj: string;
        };
        Relationships: [];
      };
      system_case_tasks_active: {
        Row: Database["public"]["Tables"]["system_case_tasks"]["Row"];
        Relationships: [];
      };
      system_case_deadlines_active: {
        Row: Database["public"]["Tables"]["system_case_deadlines"]["Row"];
        Relationships: [];
      };
      system_case_communications_active: {
        Row: Database["public"]["Tables"]["system_case_communications"]["Row"];
        Relationships: [];
      };
      system_users_active: {
        Row: Database["public"]["Tables"]["system_users"]["Row"];
        Relationships: [];
      };
      system_case_responsaveis_active: {
        Row: Database["public"]["Tables"]["system_case_responsaveis"]["Row"];
        Relationships: [];
      };
      system_case_documents_active: {
        Row: Database["public"]["Tables"]["system_case_documents"]["Row"];
        Relationships: [];
      };
      system_document_templates_active: {
        Row: Database["public"]["Tables"]["system_document_templates"]["Row"];
        Relationships: [];
      };
      system_service_types_active: {
        Row: Database["public"]["Tables"]["system_service_types"]["Row"];
        Relationships: [];
      };
      system_service_type_folders_active: {
        Row: Database["public"]["Tables"]["system_service_type_folders"]["Row"];
        Relationships: [];
      };
      system_temas_active: {
        Row: Database["public"]["Tables"]["system_temas"]["Row"];
        Relationships: [];
      };
      system_tema_frentes_active: {
        Row: Database["public"]["Tables"]["system_tema_frentes"]["Row"];
        Relationships: [];
      };
      system_tema_field_defs_active: {
        Row: Database["public"]["Tables"]["system_tema_field_defs"]["Row"];
        Relationships: [];
      };
      system_pipeline_stages_active: {
        Row: Database["public"]["Tables"]["system_pipeline_stages"]["Row"];
        Relationships: [];
      };
      system_pipeline_boards_active: {
        Row: Database["public"]["Tables"]["system_pipeline_boards"]["Row"];
        Relationships: [];
      };
      system_case_board_positions_active: {
        Row: Database["public"]["Tables"]["system_case_board_positions"]["Row"];
        Relationships: [];
      };
      system_tema_wiki_blocks_active: {
        Row: Database["public"]["Tables"]["system_tema_wiki_blocks"]["Row"];
        Relationships: [];
      };
      system_termo_snapshots_active: {
        Row: Database["public"]["Tables"]["system_termo_snapshots"]["Row"];
        Relationships: [];
      };
      system_parcelas_active: {
        Row: Database["public"]["Tables"]["system_parcelas"]["Row"];
        Relationships: [];
      };
      system_case_honorarios_active: {
        Row: Database["public"]["Tables"]["system_case_honorarios"]["Row"];
        Relationships: [];
      };
    };
    Functions: {
      system_count_pending_exceptions: {
        Args: { p_org_id: string };
        Returns: number;
      };
      system_get_load_deviation: {
        Args: { p_org_id: string; p_start: string; p_end: string };
        Returns: number;
      };
      system_get_preference_rate: {
        Args: { p_org_id: string; p_start: string; p_end: string };
        Returns: number;
      };
      system_fn_bifurcar_financeiro: {
        Args: { p_case_id: string };
        Returns: undefined;
      };
      system_current_organization_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      system_current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      nextval_seq_system_case_code: {
        Args: Record<string, never>;
        Returns: number;
      };
      system_search_clients: {
        Args: { p_term: string };
        Returns: Database["public"]["Tables"]["system_clients"]["Row"][];
      };
      system_fn_purge_client_field: {
        Args: { p_org: string; p_key: string };
        Returns: undefined;
      };
      system_fn_instanciar_checklist: {
        Args: { p_case_id: string; p_stage_slug: string };
        Returns: undefined;
      };
      system_fn_avancar_se_checklist_ok: {
        Args: { p_case_id: string; p_triggered_by?: string | null };
        Returns: undefined;
      };
      // Merge ATÔMICO dos campos personalizados (migration 20260824000005) — evita
      // a perda de dados do read-modify-write em edição simultânea.
      system_merge_case_canonical_fields: {
        Args: { p_case_id: string; p_patch: Json };
        Returns: { canonical_fields: Json; mudou: boolean }[];
      };
      system_merge_client_custom_fields: {
        Args: { p_client_id: string; p_patch: Json };
        Returns: { custom_fields: Json; mudou: boolean }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
