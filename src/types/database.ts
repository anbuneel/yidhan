export type Database = {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string;
          created_at: string;
          display_updated_at: string;
          updated_at: string;
          pinned: boolean;
          deleted_at: string | null;
          encrypted_payload: string | null;
          encryption_iv: string | null;
          encryption_version: number | null;
          content_hash: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          created_at?: string;
          display_updated_at?: string;
          updated_at?: string;
          pinned?: boolean;
          deleted_at?: string | null;
          encrypted_payload?: string | null;
          encryption_iv?: string | null;
          encryption_version?: number | null;
          content_hash?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string;
          created_at?: string;
          display_updated_at?: string;
          updated_at?: string;
          pinned?: boolean;
          deleted_at?: string | null;
          encrypted_payload?: string | null;
          encryption_iv?: string | null;
          encryption_version?: number | null;
          content_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'notes_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tags_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      note_tags: {
        Row: {
          note_id: string;
          tag_id: string;
        };
        Insert: {
          note_id: string;
          tag_id: string;
        };
        Update: {
          note_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'note_tags_note_id_fkey';
            columns: ['note_id'];
            referencedRelation: 'notes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'note_tags_tag_id_fkey';
            columns: ['tag_id'];
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          }
        ];
      };
      note_shares: {
        Row: {
          id: string;
          note_id: string;
          user_id: string;
          share_token: string;
          expires_at: string | null;
          created_at: string;
          encrypted_payload: string | null;
          iv: string | null;
          encryption_version: number;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          note_id: string;
          user_id?: string;
          share_token: string;
          expires_at?: string | null;
          created_at?: string;
          encrypted_payload: string;
          iv: string;
          encryption_version: number;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          note_id?: string;
          user_id?: string;
          share_token?: string;
          expires_at?: string | null;
          created_at?: string;
          encrypted_payload?: string;
          iv?: string;
          encryption_version?: number;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'note_shares_note_id_fkey';
            columns: ['note_id'];
            referencedRelation: 'notes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'note_shares_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      account_deletion_requests: {
        Row: {
          user_id: string;
          requested_at: string;
          release_at: string;
          cancelled_at: string | null;
          status: 'pending' | 'processing' | 'cancelled' | 'released' | 'failed';
          attempt_count: number;
          last_attempt_at: string | null;
          next_attempt_at: string | null;
          processing_started_at: string | null;
          processing_worker_id: string | null;
          released_at: string | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          requested_at?: string;
          release_at: string;
          cancelled_at?: string | null;
          status?: 'pending' | 'processing' | 'cancelled' | 'released' | 'failed';
          attempt_count?: number;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          processing_started_at?: string | null;
          processing_worker_id?: string | null;
          released_at?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          requested_at?: string;
          release_at?: string;
          cancelled_at?: string | null;
          status?: 'pending' | 'processing' | 'cancelled' | 'released' | 'failed';
          attempt_count?: number;
          last_attempt_at?: string | null;
          next_attempt_at?: string | null;
          processing_started_at?: string | null;
          processing_worker_id?: string | null;
          released_at?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'account_deletion_requests_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      sensitive_action_confirmations: {
        Row: {
          id: string;
          user_id: string;
          action: 'account_deletion';
          token_hash: string;
          method: 'password' | 'oauth' | 'email_otp';
          created_at: string;
          expires_at: string;
          consumed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: 'account_deletion';
          token_hash: string;
          method: 'password' | 'oauth' | 'email_otp';
          created_at?: string;
          expires_at: string;
          consumed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: 'account_deletion';
          token_hash?: string;
          method?: 'password' | 'oauth' | 'email_otp';
          created_at?: string;
          expires_at?: string;
          consumed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sensitive_action_confirmations_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      account_deletion_audit: {
        Row: {
          id: number;
          user_id: string | null;
          user_id_hash: string | null;
          requested_at: string | null;
          release_at: string | null;
          attempt_count: number | null;
          outcome: 'processing_started' | 'released' | 'failed' | 'skipped_cancelled' | 'no_op';
          detail: string | null;
          worker_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          user_id_hash?: string | null;
          requested_at?: string | null;
          release_at?: string | null;
          attempt_count?: number | null;
          outcome: 'processing_started' | 'released' | 'failed' | 'skipped_cancelled' | 'no_op';
          detail?: string | null;
          worker_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string | null;
          user_id_hash?: string | null;
          requested_at?: string | null;
          release_at?: string | null;
          attempt_count?: number | null;
          outcome?: 'processing_started' | 'released' | 'failed' | 'skipped_cancelled' | 'no_op';
          detail?: string | null;
          worker_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      fetch_shared_note: {
        Args: { share_token_param: string };
        Returns: Array<{
          encrypted_payload: string;
          iv: string;
          encryption_version: number;
        }>;
      };
      request_account_deletion: {
        Args: { confirmation_token: string };
        Returns: Database['public']['Tables']['account_deletion_requests']['Row'];
      };
      cancel_account_deletion: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Tables']['account_deletion_requests']['Row'] | null;
      };
      claim_due_account_deletions: {
        Args: { batch_limit?: number; worker_id?: string | null };
        Returns: Database['public']['Tables']['account_deletion_requests']['Row'][];
      };
      delete_account_app_data: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
      mark_account_deletion_failed: {
        Args: { target_user_id: string; failure_detail: string };
        Returns: Database['public']['Tables']['account_deletion_requests']['Row'] | null;
      };
      mark_account_deletion_skipped_cancelled: {
        Args: { target_user_id: string };
        Returns: Database['public']['Tables']['account_deletion_requests']['Row'] | null;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type DbNote = Database['public']['Tables']['notes']['Row'];
export type DbTag = Database['public']['Tables']['tags']['Row'];
export type DbNoteShare = Database['public']['Tables']['note_shares']['Row'];
export type DbAccountDeletionRequest = Database['public']['Tables']['account_deletion_requests']['Row'];
