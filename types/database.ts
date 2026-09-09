export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      agent_executions: {
        Row: {
          actor_id: string | null;
          agent: string;
          agent_version: string;
          business_id: string;
          claim_count: number;
          correlation_id: string;
          embedding_identity: Json | null;
          id: string;
          knowledge_pack_id: string | null;
          knowledge_version: string | null;
          model_version: string;
          occurred_at: string;
          outcome: string;
          prompt_version: string;
          query_representation_hash: string | null;
          ranking_config_version: string | null;
          retrieval_config_version: string | null;
          retrieval_filters: Json;
          retrieved_chunk_ids: string[];
          unresolved_count: number;
        };
        Insert: {
          actor_id?: string | null;
          agent: string;
          agent_version: string;
          business_id: string;
          claim_count?: number;
          correlation_id: string;
          embedding_identity?: Json | null;
          id?: string;
          knowledge_pack_id?: string | null;
          knowledge_version?: string | null;
          model_version: string;
          occurred_at?: string;
          outcome: string;
          prompt_version: string;
          query_representation_hash?: string | null;
          ranking_config_version?: string | null;
          retrieval_config_version?: string | null;
          retrieval_filters?: Json;
          retrieved_chunk_ids?: string[];
          unresolved_count?: number;
        };
        Update: {
          actor_id?: string | null;
          agent?: string;
          agent_version?: string;
          business_id?: string;
          claim_count?: number;
          correlation_id?: string;
          embedding_identity?: Json | null;
          id?: string;
          knowledge_pack_id?: string | null;
          knowledge_version?: string | null;
          model_version?: string;
          occurred_at?: string;
          outcome?: string;
          prompt_version?: string;
          query_representation_hash?: string | null;
          ranking_config_version?: string | null;
          retrieval_config_version?: string | null;
          retrieval_filters?: Json;
          retrieved_chunk_ids?: string[];
          unresolved_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_executions_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agent_executions_knowledge_pack_id_fkey';
            columns: ['knowledge_pack_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_packs';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          actor_id: string | null;
          business_id: string | null;
          correlation_id: string | null;
          event: string;
          id: number;
          ip_address: unknown;
          metadata: Json;
          occurred_at: string;
          user_agent: string | null;
        };
        Insert: {
          actor_id?: string | null;
          business_id?: string | null;
          correlation_id?: string | null;
          event: string;
          id?: never;
          ip_address?: unknown;
          metadata?: Json;
          occurred_at?: string;
          user_agent?: string | null;
        };
        Update: {
          actor_id?: string | null;
          business_id?: string | null;
          correlation_id?: string | null;
          event?: string;
          id?: never;
          ip_address?: unknown;
          metadata?: Json;
          occurred_at?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_documents: {
        Row: {
          business_id: string;
          byte_size: number | null;
          content_type: string | null;
          created_at: string;
          document_date: string | null;
          document_type: Database['public']['Enums']['business_document_type'];
          expiration_date: string | null;
          extraction_status: Database['public']['Enums']['document_extraction_status'];
          financial_period_id: string | null;
          id: string;
          metadata: Json;
          processing_status: Database['public']['Enums']['document_processing_status'];
          provenance: Database['public']['Enums']['fact_provenance'];
          storage_path: string | null;
          title: string;
          updated_at: string;
          verification_state: Database['public']['Enums']['verification_state'];
        };
        Insert: {
          business_id: string;
          byte_size?: number | null;
          content_type?: string | null;
          created_at?: string;
          document_date?: string | null;
          document_type: Database['public']['Enums']['business_document_type'];
          expiration_date?: string | null;
          extraction_status?: Database['public']['Enums']['document_extraction_status'];
          financial_period_id?: string | null;
          id?: string;
          metadata?: Json;
          processing_status?: Database['public']['Enums']['document_processing_status'];
          provenance?: Database['public']['Enums']['fact_provenance'];
          storage_path?: string | null;
          title: string;
          updated_at?: string;
          verification_state?: Database['public']['Enums']['verification_state'];
        };
        Update: {
          business_id?: string;
          byte_size?: number | null;
          content_type?: string | null;
          created_at?: string;
          document_date?: string | null;
          document_type?: Database['public']['Enums']['business_document_type'];
          expiration_date?: string | null;
          extraction_status?: Database['public']['Enums']['document_extraction_status'];
          financial_period_id?: string | null;
          id?: string;
          metadata?: Json;
          processing_status?: Database['public']['Enums']['document_processing_status'];
          provenance?: Database['public']['Enums']['fact_provenance'];
          storage_path?: string | null;
          title?: string;
          updated_at?: string;
          verification_state?: Database['public']['Enums']['verification_state'];
        };
        Relationships: [
          {
            foreignKeyName: 'bd_period_same_business';
            columns: ['business_id', 'financial_period_id'];
            isOneToOne: false;
            referencedRelation: 'business_financial_periods';
            referencedColumns: ['business_id', 'id'];
          },
          {
            foreignKeyName: 'business_documents_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_financial_periods: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          label: string | null;
          period_end: string;
          period_start: string;
          period_type: Database['public']['Enums']['financial_period_type'];
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          label?: string | null;
          period_end: string;
          period_start: string;
          period_type: Database['public']['Enums']['financial_period_type'];
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          label?: string | null;
          period_end?: string;
          period_start?: string;
          period_type?: Database['public']['Enums']['financial_period_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_financial_periods_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_goals: {
        Row: {
          business_id: string;
          created_at: string;
          description: string | null;
          goal_type: Database['public']['Enums']['business_goal_type'];
          id: string;
          provenance: Database['public']['Enums']['fact_provenance'];
          status: Database['public']['Enums']['business_goal_status'];
          target_currency: string | null;
          target_date: string | null;
          target_metric_key: Database['public']['Enums']['business_metric_key'] | null;
          target_value: number | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          description?: string | null;
          goal_type: Database['public']['Enums']['business_goal_type'];
          id?: string;
          provenance?: Database['public']['Enums']['fact_provenance'];
          status?: Database['public']['Enums']['business_goal_status'];
          target_currency?: string | null;
          target_date?: string | null;
          target_metric_key?: Database['public']['Enums']['business_metric_key'] | null;
          target_value?: number | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          description?: string | null;
          goal_type?: Database['public']['Enums']['business_goal_type'];
          id?: string;
          provenance?: Database['public']['Enums']['fact_provenance'];
          status?: Database['public']['Enums']['business_goal_status'];
          target_currency?: string | null;
          target_date?: string | null;
          target_metric_key?: Database['public']['Enums']['business_metric_key'] | null;
          target_value?: number | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_goals_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_identifiers: {
        Row: {
          business_id: string;
          created_at: string;
          id: string;
          identifier_type: Database['public']['Enums']['business_identifier_type'];
          label: string | null;
          provenance: Database['public']['Enums']['fact_provenance'];
          updated_at: string;
          value: string;
          verification_state: Database['public']['Enums']['verification_state'];
          verified_at: string | null;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          id?: string;
          identifier_type: Database['public']['Enums']['business_identifier_type'];
          label?: string | null;
          provenance?: Database['public']['Enums']['fact_provenance'];
          updated_at?: string;
          value: string;
          verification_state?: Database['public']['Enums']['verification_state'];
          verified_at?: string | null;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          id?: string;
          identifier_type?: Database['public']['Enums']['business_identifier_type'];
          label?: string | null;
          provenance?: Database['public']['Enums']['fact_provenance'];
          updated_at?: string;
          value?: string;
          verification_state?: Database['public']['Enums']['verification_state'];
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'business_identifiers_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_metrics: {
        Row: {
          as_of_date: string | null;
          business_id: string;
          created_at: string;
          currency: string | null;
          financial_period_id: string | null;
          id: string;
          label: string | null;
          metric_key: Database['public']['Enums']['business_metric_key'];
          provenance: Database['public']['Enums']['fact_provenance'];
          source_document_id: string | null;
          unit: string | null;
          updated_at: string;
          value: number;
          verification_state: Database['public']['Enums']['verification_state'];
        };
        Insert: {
          as_of_date?: string | null;
          business_id: string;
          created_at?: string;
          currency?: string | null;
          financial_period_id?: string | null;
          id?: string;
          label?: string | null;
          metric_key: Database['public']['Enums']['business_metric_key'];
          provenance?: Database['public']['Enums']['fact_provenance'];
          source_document_id?: string | null;
          unit?: string | null;
          updated_at?: string;
          value: number;
          verification_state?: Database['public']['Enums']['verification_state'];
        };
        Update: {
          as_of_date?: string | null;
          business_id?: string;
          created_at?: string;
          currency?: string | null;
          financial_period_id?: string | null;
          id?: string;
          label?: string | null;
          metric_key?: Database['public']['Enums']['business_metric_key'];
          provenance?: Database['public']['Enums']['fact_provenance'];
          source_document_id?: string | null;
          unit?: string | null;
          updated_at?: string;
          value?: number;
          verification_state?: Database['public']['Enums']['verification_state'];
        };
        Relationships: [
          {
            foreignKeyName: 'bm_document_same_business';
            columns: ['business_id', 'source_document_id'];
            isOneToOne: false;
            referencedRelation: 'business_documents';
            referencedColumns: ['business_id', 'id'];
          },
          {
            foreignKeyName: 'bm_period_same_business';
            columns: ['business_id', 'financial_period_id'];
            isOneToOne: false;
            referencedRelation: 'business_financial_periods';
            referencedColumns: ['business_id', 'id'];
          },
          {
            foreignKeyName: 'business_metrics_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_profiles: {
        Row: {
          business_activities: string | null;
          business_id: string;
          business_stage: string | null;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          employee_count: number | null;
          founder_goals: string | null;
          funding_requirement_amount: number | null;
          funding_requirement_currency: string | null;
          id: string;
          last_completed_step: number;
          location: string | null;
          operating_status: string | null;
          products_services: string | null;
          responses: Json;
          target_customers: string | null;
          updated_at: string;
        };
        Insert: {
          business_activities?: string | null;
          business_id: string;
          business_stage?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          employee_count?: number | null;
          founder_goals?: string | null;
          funding_requirement_amount?: number | null;
          funding_requirement_currency?: string | null;
          id?: string;
          last_completed_step?: number;
          location?: string | null;
          operating_status?: string | null;
          products_services?: string | null;
          responses?: Json;
          target_customers?: string | null;
          updated_at?: string;
        };
        Update: {
          business_activities?: string | null;
          business_id?: string;
          business_stage?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          employee_count?: number | null;
          founder_goals?: string | null;
          funding_requirement_amount?: number | null;
          funding_requirement_currency?: string | null;
          id?: string;
          last_completed_step?: number;
          location?: string | null;
          operating_status?: string | null;
          products_services?: string | null;
          responses?: Json;
          target_customers?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_profiles_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: true;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
        ];
      };
      business_regulatory_requirements: {
        Row: {
          active_at: string | null;
          approved_at: string | null;
          business_id: string;
          created_at: string;
          expired_at: string | null;
          id: string;
          last_evaluated_at: string | null;
          missing_information: Json;
          reason: string | null;
          renewal_due_at: string | null;
          required_documents: Json;
          requirement_id: string;
          started_at: string | null;
          state: string;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          active_at?: string | null;
          approved_at?: string | null;
          business_id: string;
          created_at?: string;
          expired_at?: string | null;
          id?: string;
          last_evaluated_at?: string | null;
          missing_information?: Json;
          reason?: string | null;
          renewal_due_at?: string | null;
          required_documents?: Json;
          requirement_id: string;
          started_at?: string | null;
          state?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          active_at?: string | null;
          approved_at?: string | null;
          business_id?: string;
          created_at?: string;
          expired_at?: string | null;
          id?: string;
          last_evaluated_at?: string | null;
          missing_information?: Json;
          reason?: string | null;
          renewal_due_at?: string | null;
          required_documents?: Json;
          requirement_id?: string;
          started_at?: string | null;
          state?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_regulatory_requirements_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'business_regulatory_requirements_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      businesses: {
        Row: {
          archived_at: string | null;
          business_mode: Database['public']['Enums']['business_mode'];
          business_type: string | null;
          country_code: string;
          created_at: string;
          id: string;
          industry: string | null;
          legal_name: string | null;
          name: string;
          owner_id: string;
          status: Database['public']['Enums']['business_status'];
          trading_name: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          business_mode?: Database['public']['Enums']['business_mode'];
          business_type?: string | null;
          country_code: string;
          created_at?: string;
          id?: string;
          industry?: string | null;
          legal_name?: string | null;
          name: string;
          owner_id: string;
          status?: Database['public']['Enums']['business_status'];
          trading_name?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          business_mode?: Database['public']['Enums']['business_mode'];
          business_type?: string | null;
          country_code?: string;
          created_at?: string;
          id?: string;
          industry?: string | null;
          legal_name?: string | null;
          name?: string;
          owner_id?: string;
          status?: Database['public']['Enums']['business_status'];
          trading_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'businesses_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
        ];
      };
      countries: {
        Row: {
          code: string;
          created_at: string;
          currency_code: string;
          is_active: boolean;
          name: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          currency_code: string;
          is_active?: boolean;
          name: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          currency_code?: string;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      knowledge_chunk_relations: {
        Row: {
          applies_if: Json | null;
          created_at: string;
          from_chunk_id: string;
          id: string;
          relation_type: string;
          to_chunk_id: string | null;
        };
        Insert: {
          applies_if?: Json | null;
          created_at?: string;
          from_chunk_id: string;
          id?: string;
          relation_type: string;
          to_chunk_id?: string | null;
        };
        Update: {
          applies_if?: Json | null;
          created_at?: string;
          from_chunk_id?: string;
          id?: string;
          relation_type?: string;
          to_chunk_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'knowledge_chunk_relations_from_chunk_id_fkey';
            columns: ['from_chunk_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_chunks';
            referencedColumns: ['chunk_id'];
          },
          {
            foreignKeyName: 'knowledge_chunk_relations_to_chunk_id_fkey';
            columns: ['to_chunk_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_chunks';
            referencedColumns: ['chunk_id'];
          },
        ];
      };
      knowledge_chunks: {
        Row: {
          amends_provision: string | null;
          body: string;
          chunk_id: string;
          chunk_index: number;
          chunk_version: number;
          clause: string | null;
          content_hash: string;
          country_code: string;
          created_at: string;
          effective_date: string | null;
          industry: string | null;
          instrument_role: Database['public']['Enums']['instrument_role'];
          keywords: string[];
          knowledge_pack_id: string;
          knowledge_source_id: string;
          legal_source_category: Database['public']['Enums']['legal_source_category'];
          page: number | null;
          provision_id: string | null;
          regulatory_domain: string | null;
          section_reference: string | null;
          source_authority: number;
          title: string | null;
        };
        Insert: {
          amends_provision?: string | null;
          body: string;
          chunk_id: string;
          chunk_index: number;
          chunk_version?: number;
          clause?: string | null;
          content_hash: string;
          country_code: string;
          created_at?: string;
          effective_date?: string | null;
          industry?: string | null;
          instrument_role?: Database['public']['Enums']['instrument_role'];
          keywords?: string[];
          knowledge_pack_id: string;
          knowledge_source_id: string;
          legal_source_category: Database['public']['Enums']['legal_source_category'];
          page?: number | null;
          provision_id?: string | null;
          regulatory_domain?: string | null;
          section_reference?: string | null;
          source_authority: number;
          title?: string | null;
        };
        Update: {
          amends_provision?: string | null;
          body?: string;
          chunk_id?: string;
          chunk_index?: number;
          chunk_version?: number;
          clause?: string | null;
          content_hash?: string;
          country_code?: string;
          created_at?: string;
          effective_date?: string | null;
          industry?: string | null;
          instrument_role?: Database['public']['Enums']['instrument_role'];
          keywords?: string[];
          knowledge_pack_id?: string;
          knowledge_source_id?: string;
          legal_source_category?: Database['public']['Enums']['legal_source_category'];
          page?: number | null;
          provision_id?: string | null;
          regulatory_domain?: string | null;
          section_reference?: string | null;
          source_authority?: number;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'knowledge_chunks_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'knowledge_chunks_knowledge_pack_id_fkey';
            columns: ['knowledge_pack_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_packs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'knowledge_chunks_knowledge_source_id_fkey';
            columns: ['knowledge_source_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_sources';
            referencedColumns: ['id'];
          },
        ];
      };
      knowledge_embedding_manifests: {
        Row: {
          chunk_version: number;
          dimensions: number;
          generated_at: string;
          id: string;
          knowledge_pack_id: string;
          model: string;
          model_version: string;
          provider: string;
          retrieval_config_version: string;
          status: string;
        };
        Insert: {
          chunk_version: number;
          dimensions: number;
          generated_at?: string;
          id?: string;
          knowledge_pack_id: string;
          model: string;
          model_version: string;
          provider: string;
          retrieval_config_version: string;
          status?: string;
        };
        Update: {
          chunk_version?: number;
          dimensions?: number;
          generated_at?: string;
          id?: string;
          knowledge_pack_id?: string;
          model?: string;
          model_version?: string;
          provider?: string;
          retrieval_config_version?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'knowledge_embedding_manifests_knowledge_pack_id_fkey';
            columns: ['knowledge_pack_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_packs';
            referencedColumns: ['id'];
          },
        ];
      };
      knowledge_packs: {
        Row: {
          approval_note: string | null;
          commercial_publication_eligibility: Database['public']['Enums']['commercial_publication_eligibility'];
          country_code: string;
          created_at: string;
          id: string;
          notes: string | null;
          published_at: string | null;
          published_by: string | null;
          status: Database['public']['Enums']['knowledge_pack_status'];
          superseded_at: string | null;
          superseded_by_id: string | null;
          updated_at: string;
          version: string;
        };
        Insert: {
          approval_note?: string | null;
          commercial_publication_eligibility?: Database['public']['Enums']['commercial_publication_eligibility'];
          country_code: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          status?: Database['public']['Enums']['knowledge_pack_status'];
          superseded_at?: string | null;
          superseded_by_id?: string | null;
          updated_at?: string;
          version: string;
        };
        Update: {
          approval_note?: string | null;
          commercial_publication_eligibility?: Database['public']['Enums']['commercial_publication_eligibility'];
          country_code?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          status?: Database['public']['Enums']['knowledge_pack_status'];
          superseded_at?: string | null;
          superseded_by_id?: string | null;
          updated_at?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'knowledge_packs_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'knowledge_packs_superseded_by_id_fkey';
            columns: ['superseded_by_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_packs';
            referencedColumns: ['id'];
          },
        ];
      };
      knowledge_source_validations: {
        Row: {
          classification_valid: boolean;
          failure_reasons: Json;
          id: string;
          knowledge_source_id: string;
          metadata_valid: boolean;
          outcome: Database['public']['Enums']['validation_outcome'];
          provenance_valid: boolean;
          reviewer_notes: string | null;
          source_valid: boolean;
          structure_valid: boolean;
          validated_at: string;
          validator: string;
        };
        Insert: {
          classification_valid: boolean;
          failure_reasons?: Json;
          id?: string;
          knowledge_source_id: string;
          metadata_valid: boolean;
          outcome: Database['public']['Enums']['validation_outcome'];
          provenance_valid: boolean;
          reviewer_notes?: string | null;
          source_valid: boolean;
          structure_valid: boolean;
          validated_at?: string;
          validator: string;
        };
        Update: {
          classification_valid?: boolean;
          failure_reasons?: Json;
          id?: string;
          knowledge_source_id?: string;
          metadata_valid?: boolean;
          outcome?: Database['public']['Enums']['validation_outcome'];
          provenance_valid?: boolean;
          reviewer_notes?: string | null;
          source_valid?: boolean;
          structure_valid?: boolean;
          validated_at?: string;
          validator?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'knowledge_source_validations_knowledge_source_id_fkey';
            columns: ['knowledge_source_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_sources';
            referencedColumns: ['id'];
          },
        ];
      };
      knowledge_sources: {
        Row: {
          accessed_at: string | null;
          agency: string;
          content_hash: string | null;
          content_media_type: string | null;
          country_code: string;
          created_at: string;
          effective_date: string | null;
          expiry_date: string | null;
          freshness_state: Database['public']['Enums']['knowledge_freshness_state'];
          id: string;
          knowledge_pack_id: string;
          last_reviewed_date: string | null;
          legal_source_category: Database['public']['Enums']['legal_source_category'];
          legal_status: Database['public']['Enums']['knowledge_source_legal_status'];
          manifest_id: string | null;
          municipality: string | null;
          publication_date: string | null;
          region: string | null;
          review_due_at: string | null;
          source_authority: number;
          source_type: Database['public']['Enums']['knowledge_source_type'];
          source_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          accessed_at?: string | null;
          agency: string;
          content_hash?: string | null;
          content_media_type?: string | null;
          country_code: string;
          created_at?: string;
          effective_date?: string | null;
          expiry_date?: string | null;
          freshness_state: Database['public']['Enums']['knowledge_freshness_state'];
          id?: string;
          knowledge_pack_id: string;
          last_reviewed_date?: string | null;
          legal_source_category: Database['public']['Enums']['legal_source_category'];
          legal_status?: Database['public']['Enums']['knowledge_source_legal_status'];
          manifest_id?: string | null;
          municipality?: string | null;
          publication_date?: string | null;
          region?: string | null;
          review_due_at?: string | null;
          source_authority: number;
          source_type: Database['public']['Enums']['knowledge_source_type'];
          source_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          accessed_at?: string | null;
          agency?: string;
          content_hash?: string | null;
          content_media_type?: string | null;
          country_code?: string;
          created_at?: string;
          effective_date?: string | null;
          expiry_date?: string | null;
          freshness_state?: Database['public']['Enums']['knowledge_freshness_state'];
          id?: string;
          knowledge_pack_id?: string;
          last_reviewed_date?: string | null;
          legal_source_category?: Database['public']['Enums']['legal_source_category'];
          legal_status?: Database['public']['Enums']['knowledge_source_legal_status'];
          manifest_id?: string | null;
          municipality?: string | null;
          publication_date?: string | null;
          region?: string | null;
          review_due_at?: string | null;
          source_authority?: number;
          source_type?: Database['public']['Enums']['knowledge_source_type'];
          source_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'knowledge_sources_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['code'];
          },
          {
            foreignKeyName: 'knowledge_sources_knowledge_pack_id_fkey';
            columns: ['knowledge_pack_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_packs';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limit_counters: {
        Row: {
          count: number;
          scope: string;
          subject_id: string;
          updated_at: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          scope: string;
          subject_id: string;
          updated_at?: string;
          window_start: string;
        };
        Update: {
          count?: number;
          scope?: string;
          subject_id?: string;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      regulatory_actions: {
        Row: {
          action_type: string;
          agency_name: string | null;
          created_at: string;
          description: string;
          id: string;
          name: string;
          official_url: string | null;
          pathway_step_id: string | null;
          requirement_id: string;
          requires_human_approval: boolean;
          status: string;
          system_name: string | null;
          updated_at: string;
        };
        Insert: {
          action_type: string;
          agency_name?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          name: string;
          official_url?: string | null;
          pathway_step_id?: string | null;
          requirement_id: string;
          requires_human_approval?: boolean;
          status?: string;
          system_name?: string | null;
          updated_at?: string;
        };
        Update: {
          action_type?: string;
          agency_name?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          official_url?: string | null;
          pathway_step_id?: string | null;
          requirement_id?: string;
          requires_human_approval?: boolean;
          status?: string;
          system_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'regulatory_actions_pathway_step_id_fkey';
            columns: ['pathway_step_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_pathway_steps';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'regulatory_actions_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      regulatory_applicability_rules: {
        Row: {
          created_at: string;
          expected_value: Json;
          explanation: string | null;
          field_path: string;
          id: string;
          operator: string;
          requirement_id: string;
          rule_type: string;
        };
        Insert: {
          created_at?: string;
          expected_value: Json;
          explanation?: string | null;
          field_path: string;
          id?: string;
          operator: string;
          requirement_id: string;
          rule_type: string;
        };
        Update: {
          created_at?: string;
          expected_value?: Json;
          explanation?: string | null;
          field_path?: string;
          id?: string;
          operator?: string;
          requirement_id?: string;
          rule_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'regulatory_applicability_rules_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      regulatory_pathway_steps: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          name: string;
          pathway_id: string;
          requirement_id: string | null;
          status: string;
          step_number: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          name: string;
          pathway_id: string;
          requirement_id?: string | null;
          status?: string;
          step_number: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          pathway_id?: string;
          requirement_id?: string | null;
          status?: string;
          step_number?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'regulatory_pathway_steps_pathway_id_fkey';
            columns: ['pathway_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_pathways';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'regulatory_pathway_steps_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      regulatory_pathways: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          jurisdiction: string;
          name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          jurisdiction: string;
          name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          jurisdiction?: string;
          name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      regulatory_requirement_dependencies: {
        Row: {
          created_at: string;
          depends_on_requirement_id: string;
          description: string | null;
          id: string;
          relationship_type: string;
          requirement_id: string;
        };
        Insert: {
          created_at?: string;
          depends_on_requirement_id: string;
          description?: string | null;
          id?: string;
          relationship_type: string;
          requirement_id: string;
        };
        Update: {
          created_at?: string;
          depends_on_requirement_id?: string;
          description?: string | null;
          id?: string;
          relationship_type?: string;
          requirement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'regulatory_requirement_dependenc_depends_on_requirement_id_fkey';
            columns: ['depends_on_requirement_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_requirements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'regulatory_requirement_dependencies_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      regulatory_requirement_evidence: {
        Row: {
          created_at: string;
          evidence_role: string;
          id: string;
          knowledge_chunk_id: string;
          knowledge_pack_id: string;
          knowledge_source_id: string;
          requirement_id: string;
          source_locator: string | null;
        };
        Insert: {
          created_at?: string;
          evidence_role?: string;
          id?: string;
          knowledge_chunk_id: string;
          knowledge_pack_id: string;
          knowledge_source_id: string;
          requirement_id: string;
          source_locator?: string | null;
        };
        Update: {
          created_at?: string;
          evidence_role?: string;
          id?: string;
          knowledge_chunk_id?: string;
          knowledge_pack_id?: string;
          knowledge_source_id?: string;
          requirement_id?: string;
          source_locator?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'regulatory_requirement_evidence_knowledge_chunk_id_fkey';
            columns: ['knowledge_chunk_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_chunks';
            referencedColumns: ['chunk_id'];
          },
          {
            foreignKeyName: 'regulatory_requirement_evidence_knowledge_pack_id_fkey';
            columns: ['knowledge_pack_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_packs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'regulatory_requirement_evidence_knowledge_source_id_fkey';
            columns: ['knowledge_source_id'];
            isOneToOne: false;
            referencedRelation: 'knowledge_sources';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'regulatory_requirement_evidence_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      regulatory_requirement_outputs: {
        Row: {
          business_knowledge_field: string | null;
          created_at: string;
          description: string;
          id: string;
          name: string;
          output_type: string;
          required_for_downstream: boolean;
          requirement_id: string;
          updated_at: string;
        };
        Insert: {
          business_knowledge_field?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          name: string;
          output_type: string;
          required_for_downstream?: boolean;
          requirement_id: string;
          updated_at?: string;
        };
        Update: {
          business_knowledge_field?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          name?: string;
          output_type?: string;
          required_for_downstream?: boolean;
          requirement_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'regulatory_requirement_outputs_requirement_id_fkey';
            columns: ['requirement_id'];
            isOneToOne: false;
            referencedRelation: 'regulatory_requirements';
            referencedColumns: ['id'];
          },
        ];
      };
      regulatory_requirements: {
        Row: {
          created_at: string;
          description: string;
          effective_from: string | null;
          effective_until: string | null;
          id: string;
          jurisdiction: string;
          regulatory_domain: string;
          requirement_type: string;
          source_locator: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          effective_from?: string | null;
          effective_until?: string | null;
          id?: string;
          jurisdiction: string;
          regulatory_domain: string;
          requirement_type: string;
          source_locator?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          effective_from?: string | null;
          effective_until?: string | null;
          id?: string;
          jurisdiction?: string;
          regulatory_domain?: string;
          requirement_type?: string;
          source_locator?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_rate_limit: {
        Args: {
          p_limit: number;
          p_scope: string;
          p_subject_id: string;
          p_window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          current_count: number;
          retry_after_seconds: number;
          window_started_at: string;
        }[];
      };
      publish_knowledge_pack: {
        Args: {
          p_approval_note?: string;
          p_approved_by: string;
          p_pack_id: string;
        };
        Returns: {
          approval_note: string | null;
          commercial_publication_eligibility: Database['public']['Enums']['commercial_publication_eligibility'];
          country_code: string;
          created_at: string;
          id: string;
          notes: string | null;
          published_at: string | null;
          published_by: string | null;
          status: Database['public']['Enums']['knowledge_pack_status'];
          superseded_at: string | null;
          superseded_by_id: string | null;
          updated_at: string;
          version: string;
        };
        SetofOptions: {
          from: '*';
          to: 'knowledge_packs';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      business_document_type:
        | 'financial_statement'
        | 'profit_loss'
        | 'sales_report'
        | 'tax_document'
        | 'invoice'
        | 'expense_report'
        | 'bank_statement'
        | 'payroll_report'
        | 'inventory_report'
        | 'registration'
        | 'licence'
        | 'certificate'
        | 'other';
      business_goal_status: 'proposed' | 'active' | 'achieved' | 'on_hold' | 'abandoned';
      business_goal_type:
        | 'revenue_target'
        | 'launch_product'
        | 'open_location'
        | 'hire'
        | 'expand_market'
        | 'improve_profitability'
        | 'increase_sales'
        | 'obtain_licence'
        | 'other';
      business_identifier_type:
        | 'company_registration_number'
        | 'business_licence_number'
        | 'tax_identification_number'
        | 'vat_registration_number'
        | 'nib_employer_number'
        | 'other';
      business_metric_key:
        | 'revenue'
        | 'expenses'
        | 'net_profit'
        | 'gross_margin'
        | 'cash_flow'
        | 'sales_count'
        | 'customer_count'
        | 'other';
      business_mode: 'build' | 'manage';
      business_status:
        | 'draft'
        | 'intake_started'
        | 'intake_complete'
        | 'launch_plan_generated'
        | 'active'
        | 'archived';
      commercial_publication_eligibility: 'restricted' | 'cleared';
      document_extraction_status:
        'not_started' | 'pending' | 'extracted' | 'failed' | 'unavailable';
      document_processing_status: 'pending' | 'stored' | 'processing' | 'processed' | 'failed';
      fact_provenance:
        | 'founder_provided'
        | 'evidence_verified'
        | 'ai_inferred'
        | 'external_public_data'
        | 'user_document';
      financial_period_type: 'month' | 'quarter' | 'year' | 'custom';
      instrument_role: 'substantive' | 'amending_instruction' | 'unknown';
      knowledge_freshness_state:
        'current' | 'review_due' | 'changed_pending_assessment' | 'stale' | 'withdrawn';
      knowledge_pack_status:
        'draft' | 'validating' | 'staged' | 'published' | 'superseded' | 'rolled_back';
      knowledge_source_legal_status:
        | 'in_force'
        | 'base_text_amended'
        | 'enacted_not_in_force'
        | 'repealed'
        | 'spent'
        | 'superseded'
        | 'unresolved';
      knowledge_source_type:
        | 'act'
        | 'regulation'
        | 'statutory_instrument'
        | 'gazette_notice'
        | 'guidance_note'
        | 'agency_page'
        | 'form'
        | 'fee_schedule';
      legal_source_category:
        | 'constitution'
        | 'primary_legislation'
        | 'regulation'
        | 'ministerial_order'
        | 'official_guidance'
        | 'agency_publication';
      validation_outcome: 'validated' | 'partially_validated' | 'unverified' | 'rejected';
      verification_state: 'unverified' | 'verified' | 'verification_unavailable';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      business_document_type: [
        'financial_statement',
        'profit_loss',
        'sales_report',
        'tax_document',
        'invoice',
        'expense_report',
        'bank_statement',
        'payroll_report',
        'inventory_report',
        'registration',
        'licence',
        'certificate',
        'other',
      ],
      business_goal_status: ['proposed', 'active', 'achieved', 'on_hold', 'abandoned'],
      business_goal_type: [
        'revenue_target',
        'launch_product',
        'open_location',
        'hire',
        'expand_market',
        'improve_profitability',
        'increase_sales',
        'obtain_licence',
        'other',
      ],
      business_identifier_type: [
        'company_registration_number',
        'business_licence_number',
        'tax_identification_number',
        'vat_registration_number',
        'nib_employer_number',
        'other',
      ],
      business_metric_key: [
        'revenue',
        'expenses',
        'net_profit',
        'gross_margin',
        'cash_flow',
        'sales_count',
        'customer_count',
        'other',
      ],
      business_mode: ['build', 'manage'],
      business_status: [
        'draft',
        'intake_started',
        'intake_complete',
        'launch_plan_generated',
        'active',
        'archived',
      ],
      commercial_publication_eligibility: ['restricted', 'cleared'],
      document_extraction_status: ['not_started', 'pending', 'extracted', 'failed', 'unavailable'],
      document_processing_status: ['pending', 'stored', 'processing', 'processed', 'failed'],
      fact_provenance: [
        'founder_provided',
        'evidence_verified',
        'ai_inferred',
        'external_public_data',
        'user_document',
      ],
      financial_period_type: ['month', 'quarter', 'year', 'custom'],
      instrument_role: ['substantive', 'amending_instruction', 'unknown'],
      knowledge_freshness_state: [
        'current',
        'review_due',
        'changed_pending_assessment',
        'stale',
        'withdrawn',
      ],
      knowledge_pack_status: [
        'draft',
        'validating',
        'staged',
        'published',
        'superseded',
        'rolled_back',
      ],
      knowledge_source_legal_status: [
        'in_force',
        'base_text_amended',
        'enacted_not_in_force',
        'repealed',
        'spent',
        'superseded',
        'unresolved',
      ],
      knowledge_source_type: [
        'act',
        'regulation',
        'statutory_instrument',
        'gazette_notice',
        'guidance_note',
        'agency_page',
        'form',
        'fee_schedule',
      ],
      legal_source_category: [
        'constitution',
        'primary_legislation',
        'regulation',
        'ministerial_order',
        'official_guidance',
        'agency_publication',
      ],
      validation_outcome: ['validated', 'partially_validated', 'unverified', 'rejected'],
      verification_state: ['unverified', 'verified', 'verification_unavailable'],
    },
  },
} as const;
