// Tipos do schema Supabase do Sistema HV.
// PLACEHOLDER — regenere com `npm run db:types` após aplicar migrations.
// Mantém os clientes tipados (Database) sem quebrar build enquanto a migration
// não foi pushed no projeto remoto.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
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
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          cpf_cnpj: string;
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
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      client_documents: {
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
        Update: Partial<Database["public"]["Tables"]["client_documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_documents_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
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
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      clients_active: {
        Row: Database["public"]["Tables"]["clients"]["Row"];
        Relationships: [];
      };
      client_documents_active: {
        Row: Database["public"]["Tables"]["client_documents"]["Row"];
        Relationships: [];
      };
    };
    Functions: {
      current_organization_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
