// Tipos do schema Supabase do Sistema HV.
// PLACEHOLDER — regenere com `npm run db:types` após aplicar migrations.
// Convenção: todas as tabelas/views/funcs do sistema usam prefixo `system_`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
          def_id: string;
          stage_slug: string;
          done: boolean;
          done_at: string | null;
          done_by: string | null;
          source: string;
          drive_file_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          case_id: string;
          def_id: string;
          stage_slug: string;
          done?: boolean;
          done_at?: string | null;
          done_by?: string | null;
          source?: string;
          drive_file_id?: string | null;
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
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_service_types"]["Insert"]>;
        Relationships: [];
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
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_pipeline_stages"]["Insert"]>;
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
          role: string;
          status: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          full_name?: string | null;
          role?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_users"]["Insert"]>;
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
      system_pipeline_stages_active: {
        Row: Database["public"]["Tables"]["system_pipeline_stages"]["Row"];
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
