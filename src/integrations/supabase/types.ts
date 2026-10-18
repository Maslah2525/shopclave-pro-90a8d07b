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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line: string
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          phone: string | null
          state: string | null
          user_id: string
        }
        Insert: {
          address_line: string
          city: string
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          phone?: string | null
          state?: string | null
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          phone?: string | null
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_details: Json
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          order_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_details?: Json
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          order_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_details?: Json
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          order_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_commission_rates: {
        Row: {
          category_id: string
          commission_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id: string
          commission_pct: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string
          commission_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_commission_rates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string
          order_id: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id: string
          order_id?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string
          order_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_by_receiver: boolean
          deleted_by_sender: boolean
          edited_at: string | null
          id: string
          is_read: boolean
          is_system_message: boolean
          message: string
          message_type: string
          order_id: string | null
          original_attachment_size: number | null
          original_attachment_type: string | null
          original_attachment_url: string | null
          original_message: string | null
          product_id: string | null
          seen_at: string | null
          sender_id: string
          vendor_id: string
        }
        Insert: {
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_receiver?: boolean
          deleted_by_sender?: boolean
          edited_at?: string | null
          id?: string
          is_read?: boolean
          is_system_message?: boolean
          message: string
          message_type?: string
          order_id?: string | null
          original_attachment_size?: number | null
          original_attachment_type?: string | null
          original_attachment_url?: string | null
          original_message?: string | null
          product_id?: string | null
          seen_at?: string | null
          sender_id: string
          vendor_id: string
        }
        Update: {
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by_receiver?: boolean
          deleted_by_sender?: boolean
          edited_at?: string | null
          id?: string
          is_read?: boolean
          is_system_message?: boolean
          message?: string
          message_type?: string
          order_id?: string | null
          original_attachment_size?: number | null
          original_attachment_type?: string | null
          original_attachment_url?: string | null
          original_message?: string | null
          product_id?: string | null
          seen_at?: string | null
          sender_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consents: {
        Row: {
          analytics: boolean
          created_at: string
          essential: boolean
          id: string
          ip_country: string | null
          marketing: boolean
          preferences: boolean
          session_id: string
          user_id: string | null
        }
        Insert: {
          analytics?: boolean
          created_at?: string
          essential?: boolean
          id?: string
          ip_country?: string | null
          marketing?: boolean
          preferences?: boolean
          session_id: string
          user_id?: string | null
        }
        Update: {
          analytics?: boolean
          created_at?: string
          essential?: boolean
          id?: string
          ip_country?: string | null
          marketing?: boolean
          preferences?: boolean
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_notes: string | null
          closed_at: string | null
          id: string
          opened_at: string
          opened_by: string
          order_id: string
          reason: string
          status: string
        }
        Insert: {
          admin_notes?: string | null
          closed_at?: string | null
          id?: string
          opened_at?: string
          opened_by: string
          order_id: string
          reason: string
          status?: string
        }
        Update: {
          admin_notes?: string | null
          closed_at?: string | null
          id?: string
          opened_at?: string
          opened_by?: string
          order_id?: string
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          created_at: string
          cta_label: string | null
          desktop_image_url: string
          display_order: number
          ends_at: string | null
          id: string
          is_active: boolean
          link_url: string
          mobile_image_url: string | null
          starts_at: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          desktop_image_url: string
          display_order?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string
          mobile_image_url?: string | null
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          desktop_image_url?: string
          display_order?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string
          mobile_image_url?: string | null
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      message_edit_history: {
        Row: {
          edited_at: string
          edited_by: string
          id: string
          message_id: string
          new_text: string | null
          old_text: string | null
        }
        Insert: {
          edited_at?: string
          edited_by: string
          id?: string
          message_id: string
          new_text?: string | null
          old_text?: string | null
        }
        Update: {
          edited_at?: string
          edited_by?: string
          id?: string
          message_id?: string
          new_text?: string | null
          old_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_edit_history_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          recipient_id: string
          sender_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          recipient_id: string
          sender_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          recipient_id?: string
          sender_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          carrier: string | null
          commission_amount: number
          commission_pct: number | null
          created_at: string
          id: string
          label_url: string | null
          order_id: string
          payment_fee_amount: number | null
          paystack_split_code: string | null
          paystack_subaccount_code: string | null
          price: number
          product_id: string | null
          quantity: number
          refunded_amount: number
          refunded_amount_provider: number
          shipping_amount: number
          shipping_rate_id: string | null
          shippo_transaction_id: string | null
          status: string
          stripe_destination_account: string | null
          stripe_transfer_id: string | null
          tax_amount: number | null
          tax_breakdown: Json | null
          tax_category: string | null
          tracking_number: string | null
          variant_id: string | null
          variant_options: Json | null
          vendor_id: string | null
          vendor_payout: number | null
        }
        Insert: {
          carrier?: string | null
          commission_amount?: number
          commission_pct?: number | null
          created_at?: string
          id?: string
          label_url?: string | null
          order_id: string
          payment_fee_amount?: number | null
          paystack_split_code?: string | null
          paystack_subaccount_code?: string | null
          price: number
          product_id?: string | null
          quantity?: number
          refunded_amount?: number
          refunded_amount_provider?: number
          shipping_amount?: number
          shipping_rate_id?: string | null
          shippo_transaction_id?: string | null
          status?: string
          stripe_destination_account?: string | null
          stripe_transfer_id?: string | null
          tax_amount?: number | null
          tax_breakdown?: Json | null
          tax_category?: string | null
          tracking_number?: string | null
          variant_id?: string | null
          variant_options?: Json | null
          vendor_id?: string | null
          vendor_payout?: number | null
        }
        Update: {
          carrier?: string | null
          commission_amount?: number
          commission_pct?: number | null
          created_at?: string
          id?: string
          label_url?: string | null
          order_id?: string
          payment_fee_amount?: number | null
          paystack_split_code?: string | null
          paystack_subaccount_code?: string | null
          price?: number
          product_id?: string | null
          quantity?: number
          refunded_amount?: number
          refunded_amount_provider?: number
          shipping_amount?: number
          shipping_rate_id?: string | null
          shippo_transaction_id?: string | null
          status?: string
          stripe_destination_account?: string | null
          stripe_transfer_id?: string | null
          tax_amount?: number | null
          tax_breakdown?: Json | null
          tax_category?: string | null
          tracking_number?: string | null
          variant_id?: string | null
          variant_options?: Json | null
          vendor_id?: string | null
          vendor_payout?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tax_snapshots: {
        Row: {
          created_at: string
          engine_version: string
          id: string
          order_id: string
          province: string
          request: Json
          result: Json
          tax_point: string
        }
        Insert: {
          created_at?: string
          engine_version: string
          id?: string
          order_id: string
          province: string
          request: Json
          result: Json
          tax_point: string
        }
        Update: {
          created_at?: string
          engine_version?: string
          id?: string
          order_id?: string
          province?: string
          request?: Json
          result?: Json
          tax_point?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tax_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          charged_amount: number | null
          charged_currency: string | null
          created_at: string
          currency: string
          id: string
          payment_method: string | null
          payment_provider: string | null
          payment_status: string
          paystack_reference: string | null
          shipping_address: Json | null
          shipping_total: number
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tax_amount: number | null
          tax_breakdown: Json | null
          tax_engine_version: string | null
          tax_province: string | null
          tax_total: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          charged_amount?: number | null
          charged_currency?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_method?: string | null
          payment_provider?: string | null
          payment_status?: string
          paystack_reference?: string | null
          shipping_address?: Json | null
          shipping_total?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_amount?: number | null
          tax_breakdown?: Json | null
          tax_engine_version?: string | null
          tax_province?: string | null
          tax_total?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          charged_amount?: number | null
          charged_currency?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_method?: string | null
          payment_provider?: string | null
          payment_status?: string
          paystack_reference?: string | null
          shipping_address?: Json | null
          shipping_total?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_amount?: number | null
          tax_breakdown?: Json | null
          tax_engine_version?: string | null
          tax_province?: string | null
          tax_total?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_refunds: {
        Row: {
          amount: number
          created_at: string
          currency: string
          failure_reason: string | null
          fx_rate_used: number | null
          id: string
          order_id: string
          order_item_id: string | null
          paystack_reference: string
          provider_amount: number | null
          provider_currency: string | null
          provider_payload: Json | null
          provider_refund_id: string | null
          requested_by: string | null
          return_request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          fx_rate_used?: number | null
          id?: string
          order_id: string
          order_item_id?: string | null
          paystack_reference: string
          provider_amount?: number | null
          provider_currency?: string | null
          provider_payload?: Json | null
          provider_refund_id?: string | null
          requested_by?: string | null
          return_request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          fx_rate_used?: number | null
          id?: string
          order_id?: string
          order_item_id?: string | null
          paystack_reference?: string
          provider_amount?: number | null
          provider_currency?: string | null
          provider_payload?: Json | null
          provider_refund_id?: string | null
          requested_by?: string | null
          return_request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refunds_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: true
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fee_settings: {
        Row: {
          default_commission_pct: number
          id: number
          payment_processing_flat: number
          payment_processing_pct: number
          updated_at: string
        }
        Insert: {
          default_commission_pct?: number
          id?: number
          payment_processing_flat?: number
          payment_processing_pct?: number
          updated_at?: string
        }
        Update: {
          default_commission_pct?: number
          id?: number
          payment_processing_flat?: number
          payment_processing_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          position: number
          product_id: string
          url: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          product_id: string
          url: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          compare_at_price: number | null
          created_at: string
          id: string
          image_url: string | null
          price: number | null
          product_id: string
          sku: string | null
          stock: number
          variant_options: Json
        }
        Insert: {
          barcode?: string | null
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number | null
          product_id: string
          sku?: string | null
          stock?: number
          variant_options?: Json
        }
        Update: {
          barcode?: string | null
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          price?: number | null
          product_id?: string
          sku?: string | null
          stock?: number
          variant_options?: Json
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_backorders: boolean
          barcode: string | null
          brand: string | null
          category_id: string | null
          compare_at_price: number | null
          condition: string
          cost_per_item: number | null
          created_at: string
          customs_value_cad: number | null
          deal_ends_at: string | null
          description: string | null
          featured: boolean
          handling_time_days: number
          height_cm: number | null
          hs_code: string | null
          id: string
          international_shipping_enabled: boolean
          is_physical: boolean
          key_features: string[] | null
          length_cm: number | null
          low_stock_threshold: number | null
          max_order_qty: number | null
          min_order_qty: number
          mpn: string | null
          name: string
          price: number
          shipping_options: Json
          ships_from_country: string | null
          sku: string | null
          slug: string
          specifications: Json
          status: string
          stock: number
          tax_category: string
          track_inventory: boolean
          updated_at: string
          vendor_featured: boolean
          vendor_id: string
          video_url: string | null
          weight_g: number | null
          whats_in_box: string[] | null
          width_cm: number | null
        }
        Insert: {
          allow_backorders?: boolean
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          condition?: string
          cost_per_item?: number | null
          created_at?: string
          customs_value_cad?: number | null
          deal_ends_at?: string | null
          description?: string | null
          featured?: boolean
          handling_time_days?: number
          height_cm?: number | null
          hs_code?: string | null
          id?: string
          international_shipping_enabled?: boolean
          is_physical?: boolean
          key_features?: string[] | null
          length_cm?: number | null
          low_stock_threshold?: number | null
          max_order_qty?: number | null
          min_order_qty?: number
          mpn?: string | null
          name: string
          price: number
          shipping_options?: Json
          ships_from_country?: string | null
          sku?: string | null
          slug: string
          specifications?: Json
          status?: string
          stock?: number
          tax_category?: string
          track_inventory?: boolean
          updated_at?: string
          vendor_featured?: boolean
          vendor_id: string
          video_url?: string | null
          weight_g?: number | null
          whats_in_box?: string[] | null
          width_cm?: number | null
        }
        Update: {
          allow_backorders?: boolean
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          compare_at_price?: number | null
          condition?: string
          cost_per_item?: number | null
          created_at?: string
          customs_value_cad?: number | null
          deal_ends_at?: string | null
          description?: string | null
          featured?: boolean
          handling_time_days?: number
          height_cm?: number | null
          hs_code?: string | null
          id?: string
          international_shipping_enabled?: boolean
          is_physical?: boolean
          key_features?: string[] | null
          length_cm?: number | null
          low_stock_threshold?: number | null
          max_order_qty?: number | null
          min_order_qty?: number
          mpn?: string | null
          name?: string
          price?: number
          shipping_options?: Json
          ships_from_country?: string | null
          sku?: string | null
          slug?: string
          specifications?: Json
          status?: string
          stock?: number
          tax_category?: string
          track_inventory?: boolean
          updated_at?: string
          vendor_featured?: boolean
          vendor_id?: string
          video_url?: string | null
          weight_g?: number | null
          whats_in_box?: string[] | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          display_order: number
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          kind: string
          link_url: string
          placement: string
          starts_at: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          kind: string
          link_url?: string
          placement: string
          starts_at?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          kind?: string
          link_url?: string
          placement?: string
          starts_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          icon: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_feedback: {
        Row: {
          created_at: string
          helpful: boolean
          id: string
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          helpful: boolean
          id?: string
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          helpful?: boolean
          id?: string
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_feedback_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          position: number
          resource_id: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          position?: number
          resource_id: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          position?: number
          resource_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_images_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_progress: {
        Row: {
          id: string
          last_viewed_at: string
          progress_percent: number
          resource_id: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          last_viewed_at?: string
          progress_percent?: number
          resource_id: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          last_viewed_at?: string
          progress_percent?: number
          resource_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_progress_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          attachments: Json
          category_id: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string
          difficulty: string
          display_order: number
          duration_minutes: number
          id: string
          is_featured: boolean
          is_published: boolean
          resource_type: string
          slug: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          video_provider: string | null
          video_url: string | null
          view_count: number
        }
        Insert: {
          attachments?: Json
          category_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          difficulty?: string
          display_order?: number
          duration_minutes?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          resource_type?: string
          slug: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          video_provider?: string | null
          video_url?: string | null
          view_count?: number
        }
        Update: {
          attachments?: Json
          category_id?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string
          difficulty?: string
          display_order?: number
          duration_minutes?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          resource_type?: string
          slug?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          video_provider?: string | null
          video_url?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "resources_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "resource_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          order_id: string
          order_item_id: string | null
          quantity: number
          reason: string
          refund_amount_cad: number | null
          refund_reference: string | null
          return_carrier: string | null
          return_label_url: string | null
          return_tracking_number: string | null
          shipment_id: string | null
          status: string
          updated_at: string
          user_id: string
          vendor_id: string
          vendor_notes: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          order_id: string
          order_item_id?: string | null
          quantity?: number
          reason: string
          refund_amount_cad?: number | null
          refund_reference?: string | null
          return_carrier?: string | null
          return_label_url?: string | null
          return_tracking_number?: string | null
          shipment_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vendor_id: string
          vendor_notes?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          order_id?: string
          order_item_id?: string | null
          quantity?: number
          reason?: string
          refund_amount_cad?: number | null
          refund_reference?: string | null
          return_carrier?: string | null
          return_label_url?: string | null
          return_tracking_number?: string | null
          shipment_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vendor_id?: string
          vendor_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_agreement_acceptances: {
        Row: {
          accepted_at: string
          accepted_by: string
          application_id: string
          id: string
          policy_code: string
          policy_version: string
        }
        Insert: {
          accepted_at?: string
          accepted_by: string
          application_id: string
          id?: string
          policy_code: string
          policy_version: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string
          application_id?: string
          id?: string
          policy_code?: string
          policy_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_agreement_acceptances_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_application_events: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          id: string
          new_status: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          id?: string
          new_status: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          id?: string
          new_status?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_applications: {
        Row: {
          business_info: Json
          business_type: string | null
          country: string | null
          created_at: string
          current_step: number
          id: string
          kyc_status: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rules_version: string | null
          status: string
          store_info: Json
          submitted_at: string | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          business_info?: Json
          business_type?: string | null
          country?: string | null
          created_at?: string
          current_step?: number
          id?: string
          kyc_status?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules_version?: string | null
          status?: string
          store_info?: Json
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          business_info?: Json
          business_type?: string | null
          country?: string | null
          created_at?: string
          current_step?: number
          id?: string
          kyc_status?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules_version?: string | null
          status?: string
          store_info?: Json
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_applications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_country_requirements: {
        Row: {
          business_type: string
          conditional_requirements: Json
          country: string
          required_documents: string[]
          required_fields: string[]
          reviewed_at: string | null
          rules_version: string
          stripe_connect_enabled: boolean
        }
        Insert: {
          business_type: string
          conditional_requirements?: Json
          country: string
          required_documents?: string[]
          required_fields?: string[]
          reviewed_at?: string | null
          rules_version: string
          stripe_connect_enabled?: boolean
        }
        Update: {
          business_type?: string
          conditional_requirements?: Json
          country?: string
          required_documents?: string[]
          required_fields?: string[]
          reviewed_at?: string | null
          rules_version?: string
          stripe_connect_enabled?: boolean
        }
        Relationships: []
      }
      seller_document_access_events: {
        Row: {
          accessed_at: string
          action: string
          document_id: string
          id: string
          reviewer_id: string
        }
        Insert: {
          accessed_at?: string
          action: string
          document_id: string
          id?: string
          reviewer_id: string
        }
        Update: {
          accessed_at?: string
          action?: string
          document_id?: string
          id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_document_access_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "seller_verification_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_notification_outbox: {
        Row: {
          application_id: string
          attempts: number
          claim_token: string | null
          claimed_until: string | null
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          recipient_user_id: string
        }
        Insert: {
          application_id: string
          attempts?: number
          claim_token?: string | null
          claimed_until?: string | null
          created_at?: string
          delivered_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          recipient_user_id: string
        }
        Update: {
          application_id?: string
          attempts?: number
          claim_token?: string | null
          claimed_until?: string | null
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          recipient_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_notification_outbox_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payout_accounts: {
        Row: {
          application_id: string
          charges_enabled: boolean
          country: string
          currency: string | null
          id: string
          last_webhook_at: string | null
          payouts_enabled: boolean
          provider: string
          provider_account_id: string | null
          verification_status: string
        }
        Insert: {
          application_id: string
          charges_enabled?: boolean
          country: string
          currency?: string | null
          id?: string
          last_webhook_at?: string | null
          payouts_enabled?: boolean
          provider: string
          provider_account_id?: string | null
          verification_status?: string
        }
        Update: {
          application_id?: string
          charges_enabled?: boolean
          country?: string
          currency?: string | null
          id?: string
          last_webhook_at?: string | null
          payouts_enabled?: boolean
          provider?: string
          provider_account_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_payout_accounts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_policy_documents: {
        Row: {
          document_url: string
          policy_code: string
          policy_version: string
          published_at: string | null
          title: string
        }
        Insert: {
          document_url: string
          policy_code: string
          policy_version: string
          published_at?: string | null
          title: string
        }
        Update: {
          document_url?: string
          policy_code?: string
          policy_version?: string
          published_at?: string | null
          title?: string
        }
        Relationships: []
      }
      seller_stripe_webhook_events: {
        Row: {
          account_id: string
          event_id: string
          processed_at: string
        }
        Insert: {
          account_id: string
          event_id: string
          processed_at?: string
        }
        Update: {
          account_id?: string
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      seller_verification_documents: {
        Row: {
          application_id: string
          id: string
          private_storage_path: string
          requirement_code: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          uploaded_at: string
          verification_status: string
        }
        Insert: {
          application_id: string
          id?: string
          private_storage_path: string
          requirement_code: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          uploaded_at?: string
          verification_status?: string
        }
        Update: {
          application_id?: string
          id?: string
          private_storage_path?: string
          requirement_code?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          uploaded_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_verification_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "seller_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          created_at: string
          id: string
          order_item_id: string
          quantity: number
          shipment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id: string
          quantity?: number
          shipment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          commercial_invoice_url: string | null
          created_at: string
          delivered_at: string | null
          estimated_delivery: string | null
          fulfilment_mode: string
          fx_rate_to_cad: number
          id: string
          is_estimate: boolean
          label_error: string | null
          label_purchased_at: string | null
          label_url: string | null
          manual_booked_at: string | null
          manual_booking_reference: string | null
          manual_carrier: string | null
          manual_tracking_number: string | null
          order_id: string
          quote_id: string | null
          rate_id: string | null
          service: string | null
          shipping_amount_cad: number
          shipping_amount_original: number
          shipping_currency_original: string
          shippo_shipment_id: string | null
          shippo_transaction_id: string | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          carrier?: string | null
          commercial_invoice_url?: string | null
          created_at?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          fulfilment_mode?: string
          fx_rate_to_cad?: number
          id?: string
          is_estimate?: boolean
          label_error?: string | null
          label_purchased_at?: string | null
          label_url?: string | null
          manual_booked_at?: string | null
          manual_booking_reference?: string | null
          manual_carrier?: string | null
          manual_tracking_number?: string | null
          order_id: string
          quote_id?: string | null
          rate_id?: string | null
          service?: string | null
          shipping_amount_cad?: number
          shipping_amount_original?: number
          shipping_currency_original?: string
          shippo_shipment_id?: string | null
          shippo_transaction_id?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          carrier?: string | null
          commercial_invoice_url?: string | null
          created_at?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          fulfilment_mode?: string
          fx_rate_to_cad?: number
          id?: string
          is_estimate?: boolean
          label_error?: string | null
          label_purchased_at?: string | null
          label_url?: string | null
          manual_booked_at?: string | null
          manual_booking_reference?: string | null
          manual_carrier?: string | null
          manual_tracking_number?: string | null
          order_id?: string
          quote_id?: string | null
          rate_id?: string | null
          service?: string | null
          shipping_amount_cad?: number
          shipping_amount_original?: number
          shipping_currency_original?: string
          shippo_shipment_id?: string | null
          shippo_transaction_id?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "shipping_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_quotes: {
        Row: {
          address_fingerprint: string
          amount_cad: number
          amount_original: number
          consumed_order_id: string | null
          created_at: string
          currency_original: string
          duration_terms: string | null
          estimated_days: number | null
          expires_at: string
          fx_rate_to_cad: number
          id: string
          is_estimate: boolean
          items_fingerprint: string
          parcel: Json
          provider: string
          rate_id: string | null
          service: string
          source: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          address_fingerprint: string
          amount_cad: number
          amount_original: number
          consumed_order_id?: string | null
          created_at?: string
          currency_original: string
          duration_terms?: string | null
          estimated_days?: number | null
          expires_at: string
          fx_rate_to_cad?: number
          id?: string
          is_estimate?: boolean
          items_fingerprint: string
          parcel?: Json
          provider: string
          rate_id?: string | null
          service: string
          source?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          address_fingerprint?: string
          amount_cad?: number
          amount_original?: number
          consumed_order_id?: string | null
          created_at?: string
          currency_original?: string
          duration_terms?: string | null
          estimated_days?: number | null
          expires_at?: string
          fx_rate_to_cad?: number
          id?: string
          is_estimate?: boolean
          items_fingerprint?: string
          parcel?: Json
          provider?: string
          rate_id?: string | null
          service?: string
          source?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_quotes_consumed_order_id_fkey"
            columns: ["consumed_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          click_count: number
          code: string
          created_at: string
          created_by: string | null
          id: string
          target_url: string
        }
        Insert: {
          click_count?: number
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_url: string
        }
        Update: {
          click_count?: number
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_url?: string
        }
        Relationships: []
      }
      site_analytics_cache: {
        Row: {
          data: Json
          id: number
          updated_at: string | null
        }
        Insert: {
          data?: Json
          id?: number
          updated_at?: string | null
        }
        Update: {
          data?: Json
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      social_media_post_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ocoya_post_id: string | null
          payload: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ocoya_post_id?: string | null
          payload?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ocoya_post_id?: string | null
          payload?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      social_media_settings: {
        Row: {
          created_at: string
          id: string
          last_synced_at: string | null
          updated_at: string
          updated_by: string | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_synced_at?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          component: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          province: string
          rate_ppm: number
          shipping_taxable: boolean
        }
        Insert: {
          component: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          province: string
          rate_ppm: number
          shipping_taxable?: boolean
        }
        Update: {
          component?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          province?: string
          rate_ppm?: number
          shipping_taxable?: boolean
        }
        Relationships: []
      }
      tax_registrations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          key: string
          registration_number: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          key: string
          registration_number?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          key?: string
          registration_number?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          team_role_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          team_role_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          team_role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_role_id_fkey"
            columns: ["team_role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          occurred_at: string
          provider_event_key: string | null
          provider_status: string | null
          raw: Json
          shipment_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          provider_event_key?: string | null
          provider_status?: string | null
          raw?: Json
          shipment_id: string
          status: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          provider_event_key?: string | null
          provider_status?: string | null
          raw?: Json
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          accuracy: number | null
          latitude: number
          longitude: number
          raw: Json | null
          recorded_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          latitude: number
          longitude: number
          raw?: Json | null
          recorded_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          latitude?: number
          longitude?: number
          raw?: Json | null
          recorded_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_risk_flags: {
        Row: {
          created_at: string
          expires_at: string | null
          flag_type: string
          id: string
          reason: string | null
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          flag_type: string
          id?: string
          reason?: string | null
          score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          flag_type?: string
          id?: string
          reason?: string | null
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          product_id: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          product_id?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          product_id?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_analytics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_analytics_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_analytics_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_balances: {
        Row: {
          available_amount: number
          currency: string
          lifetime_sales: number
          pending_amount: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          available_amount?: number
          currency?: string
          lifetime_sales?: number
          pending_amount?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          available_amount?: number
          currency?: string
          lifetime_sales?: number
          pending_amount?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_follows: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_ledger: {
        Row: {
          amount: number
          created_at: string
          currency: string
          entry_type: string
          id: string
          notes: string | null
          order_item_id: string | null
          status: string
          stripe_reference: string | null
          vendor_id: string
          withdrawal_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          entry_type: string
          id?: string
          notes?: string | null
          order_item_id?: string | null
          status?: string
          stripe_reference?: string | null
          vendor_id: string
          withdrawal_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          entry_type?: string
          id?: string
          notes?: string | null
          order_item_id?: string | null
          status?: string
          stripe_reference?: string | null
          vendor_id?: string
          withdrawal_id?: string | null
        }
        Relationships: []
      }
      vendor_paystack_accounts: {
        Row: {
          account_name: string | null
          account_number_last4: string | null
          active: boolean
          bank_code: string
          bank_name: string | null
          business_name: string | null
          country: string | null
          created_at: string
          currency: string
          id: string
          percentage_charge: number
          subaccount_code: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          account_name?: string | null
          account_number_last4?: string | null
          active?: boolean
          bank_code: string
          bank_name?: string | null
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          percentage_charge?: number
          subaccount_code: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          account_name?: string | null
          account_number_last4?: string | null
          active?: boolean
          bank_code?: string
          bank_name?: string | null
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          percentage_charge?: number
          subaccount_code?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_paystack_accounts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_paystack_accounts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_settings_preferences: {
        Row: {
          section: string
          settings: Json
          updated_at: string
          vendor_id: string
        }
        Insert: {
          section: string
          settings?: Json
          updated_at?: string
          vendor_id: string
        }
        Update: {
          section?: string
          settings?: Json
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_settings_preferences_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_settings_preferences_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_stripe_accounts: {
        Row: {
          charges_enabled: boolean
          country: string | null
          created_at: string
          default_currency: string | null
          details_submitted: boolean
          payouts_enabled: boolean
          requirements_due: Json | null
          stripe_account_id: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean
          payouts_enabled?: boolean
          requirements_due?: Json | null
          stripe_account_id: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          charges_enabled?: boolean
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean
          payouts_enabled?: boolean
          requirements_due?: Json | null
          stripe_account_id?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_subscription_payments: {
        Row: {
          admin_notes: string | null
          created_at: string
          expires_days: number
          id: string
          max_listings: number
          notes: string | null
          payer_phone: string
          payment_method: string
          plan_name: string
          price: number
          status: string
          subscription_id: string | null
          transaction_code: string
          updated_at: string
          vendor_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          expires_days?: number
          id?: string
          max_listings?: number
          notes?: string | null
          payer_phone: string
          payment_method?: string
          plan_name: string
          price?: number
          status?: string
          subscription_id?: string | null
          transaction_code: string
          updated_at?: string
          vendor_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          expires_days?: number
          id?: string
          max_listings?: number
          notes?: string | null
          payer_phone?: string
          payment_method?: string
          plan_name?: string
          price?: number
          status?: string
          subscription_id?: string | null
          transaction_code?: string
          updated_at?: string
          vendor_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "vendor_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_subscription_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_subscription_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          max_listings: number
          plan_name: string
          price: number
          started_at: string
          status: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          max_listings?: number
          plan_name?: string
          price?: number
          started_at?: string
          status?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          max_listings?: number
          plan_name?: string
          price?: number
          started_at?: string
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_subscriptions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_subscriptions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_uploads: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          storage_path: string
          url: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          storage_path: string
          url: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          storage_path?: string
          url?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          banner_url: string | null
          commission_rate: number
          created_at: string
          default_currency: string | null
          id: string
          logo_url: string | null
          payment_details: Json | null
          phone: string | null
          phone2: string | null
          setup_completed_sections: string[]
          slug: string | null
          status: string
          store_description: string | null
          store_name: string
          store_settings: Json
          submitted_for_review_at: string | null
          updated_at: string
          user_id: string
          warehouse_address: Json | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          banner_url?: string | null
          commission_rate?: number
          created_at?: string
          default_currency?: string | null
          id?: string
          logo_url?: string | null
          payment_details?: Json | null
          phone?: string | null
          phone2?: string | null
          setup_completed_sections?: string[]
          slug?: string | null
          status?: string
          store_description?: string | null
          store_name: string
          store_settings?: Json
          submitted_for_review_at?: string | null
          updated_at?: string
          user_id: string
          warehouse_address?: Json | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          banner_url?: string | null
          commission_rate?: number
          created_at?: string
          default_currency?: string | null
          id?: string
          logo_url?: string | null
          payment_details?: Json | null
          phone?: string | null
          phone2?: string | null
          setup_completed_sections?: string[]
          slug?: string | null
          status?: string
          store_description?: string | null
          store_name?: string
          store_settings?: Json
          submitted_for_review_at?: string | null
          updated_at?: string
          user_id?: string
          warehouse_address?: Json | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_key: string
          id: string
          payload: Json
          processed_at: string
          provider: string
        }
        Insert: {
          event_key: string
          id?: string
          payload?: Json
          processed_at?: string
          provider: string
        }
        Update: {
          event_key?: string
          id?: string
          payload?: Json
          processed_at?: string
          provider?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          id: string
          payment_details: Json | null
          payment_method: string
          processed_at: string | null
          requested_at: string
          status: string
          vendor_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          id?: string
          payment_details?: Json | null
          payment_method?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          vendor_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          id?: string
          payment_details?: Json | null
          payment_method?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          completed_at: string | null
          currency: string
          failure_reason: string | null
          id: string
          requested_at: string
          status: string
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
          vendor_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          requested_at?: string
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          requested_at?: string
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          vendor_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      tax_remittance_report: {
        Row: {
          base_cents: number | null
          component: string | null
          period: string | null
          province: string | null
          tax_cents: number | null
        }
        Relationships: []
      }
      vendors_public: {
        Row: {
          banner_url: string | null
          id: string | null
          logo_url: string | null
          status: string | null
          store_description: string | null
          store_name: string | null
        }
        Insert: {
          banner_url?: string | null
          id?: string | null
          logo_url?: string | null
          status?: string | null
          store_description?: string | null
          store_name?: string | null
        }
        Update: {
          banner_url?: string | null
          id?: string | null
          logo_url?: string | null
          status?: string | null
          store_description?: string | null
          store_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_seller_agreements: { Args: { p_codes: string[] }; Returns: number }
      admin_get_message_originals: {
        Args: { _message_ids: string[] }
        Returns: {
          id: string
          original_attachment_size: number
          original_attachment_type: string
          original_attachment_url: string
          original_message: string
        }[]
      }
      admin_get_vendor_owner_email: {
        Args: { _vendor_id: string }
        Returns: string
      }
      approve_seller_application: {
        Args: { p_application_id: string }
        Returns: {
          business_info: Json
          business_type: string | null
          country: string | null
          created_at: string
          current_step: number
          id: string
          kyc_status: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rules_version: string | null
          status: string
          store_info: Json
          submitted_at: string | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "seller_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_manage_marketing: { Args: { _user_id: string }; Returns: boolean }
      can_manage_resources: { Args: { _user_id: string }; Returns: boolean }
      claim_seller_notifications: {
        Args: { p_limit?: number }
        Returns: {
          application_id: string
          attempts: number
          claim_token: string | null
          claimed_until: string | null
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          recipient_user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "seller_notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_seller_notification: {
        Args: {
          p_claim_token: string
          p_delivered: boolean
          p_error?: string
          p_id: string
        }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_message_for_everyone: {
        Args: { _message_id: string }
        Returns: undefined
      }
      delete_message_for_me: {
        Args: { _message_id: string }
        Returns: undefined
      }
      edit_message: {
        Args: { _message_id: string; _new_text: string }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_category_ancestors: {
        Args: { _category_id: string }
        Returns: {
          depth: number
          id: string
          name: string
          parent_id: string
          slug: string
        }[]
      }
      get_product_ratings: {
        Args: { product_ids: string[] }
        Returns: {
          avg_rating: number
          product_id: string
          review_count: number
          sold_count: number
        }[]
      }
      get_public_profiles: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          user_id: string
        }[]
      }
      get_top_level_category: {
        Args: { _category_id: string }
        Returns: string
      }
      get_vendor_follower_count: { Args: { v_id: string }; Returns: number }
      get_vendor_order_delivery_details: {
        Args: { p_order_ids: string[]; p_vendor_id: string }
        Returns: {
          created_at: string
          id: string
          payment_status: string
          shipping_address: Json
        }[]
      }
      get_vendor_payment_details: {
        Args: { _vendor_ids: string[] }
        Returns: {
          id: string
          payment_details: Json
          store_name: string
        }[]
      }
      get_vendor_private_fields: {
        Args: { _vendor_id: string }
        Returns: {
          id: string
          payment_details: Json
          warehouse_address: string
        }[]
      }
      get_vendor_private_fields_v2: {
        Args: { _vendor_id: string }
        Returns: {
          id: string
          payment_details: Json
          warehouse_address: Json
        }[]
      }
      has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_resource_view: {
        Args: { _resource_id: string }
        Returns: undefined
      }
      increment_short_link_click: {
        Args: { _code: string }
        Returns: undefined
      }
      log_system_event: {
        Args: { _details?: Json; _event_type: string; _order_id: string }
        Returns: undefined
      }
      mark_messages_seen: {
        Args: { _message_ids: string[] }
        Returns: undefined
      }
      mark_vendor_setup_section: {
        Args: { p_section: string }
        Returns: string[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      open_dispute: {
        Args: { _order_id: string; _reason: string }
        Returns: string
      }
      order_has_open_dispute: { Args: { _order_id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_vendor_balance: {
        Args: { _vendor_id: string }
        Returns: undefined
      }
      record_seller_kyc_review: {
        Args: { p_application_id: string; p_reason: string; p_result: string }
        Returns: {
          business_info: Json
          business_type: string | null
          country: string | null
          created_at: string
          current_step: number
          id: string
          kyc_status: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rules_version: string | null
          status: string
          store_info: Json
          submitted_at: string | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "seller_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_seller_stripe_account_event: {
        Args: {
          p_account_id: string
          p_charges_enabled: boolean
          p_created_at: string
          p_details_submitted: boolean
          p_event_id: string
          p_payouts_enabled: boolean
        }
        Returns: boolean
      }
      register_seller_kyc_upload: {
        Args: { p_requirement_code: string; p_storage_path: string }
        Returns: {
          application_id: string
          id: string
          private_storage_path: string
          requirement_code: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          uploaded_at: string
          verification_status: string
        }
        SetofOptions: {
          from: "*"
          to: "seller_verification_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_seller_application: {
        Args: { p_application_id: string; p_decision: string; p_reason: string }
        Returns: {
          business_info: Json
          business_type: string | null
          country: string | null
          created_at: string
          current_step: number
          id: string
          kyc_status: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rules_version: string | null
          status: string
          store_info: Json
          submitted_at: string | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "seller_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_seller_document: {
        Args: { p_decision: string; p_document_id: string; p_reason: string }
        Returns: {
          application_id: string
          id: string
          private_storage_path: string
          requirement_code: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          uploaded_at: string
          verification_status: string
        }
        SetofOptions: {
          from: "*"
          to: "seller_verification_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_seller_application_draft: {
        Args: {
          p_business_info: Json
          p_business_type: string
          p_country: string
          p_current_step: number
          p_store_info: Json
        }
        Returns: {
          business_info: Json
          business_type: string | null
          country: string | null
          created_at: string
          current_step: number
          id: string
          kyc_status: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rules_version: string | null
          status: string
          store_info: Json
          submitted_at: string | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "seller_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seller_conditional_requirements: {
        Args: { p_business_info: Json; p_rules: Json }
        Returns: Json
      }
      slugify: { Args: { _input: string }; Returns: string }
      submit_customer_return: {
        Args: { p_order_item_id: string; p_quantity: number; p_reason: string }
        Returns: string
      }
      submit_seller_application: {
        Args: never
        Returns: {
          business_info: Json
          business_type: string | null
          country: string | null
          created_at: string
          current_step: number
          id: string
          kyc_status: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rules_version: string | null
          status: string
          store_info: Json
          submitted_at: string | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "seller_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_vendor_for_review: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "vendor" | "customer"
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
      app_role: ["admin", "vendor", "customer"],
    },
  },
} as const
