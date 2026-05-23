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
          tipo: string | null;
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
          tipo?: string | null;
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
    };
    Functions: {
      system_current_organization_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
