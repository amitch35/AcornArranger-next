
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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_status_key: {
        Row: {
          created_at: string
          id: number
          status: string | null
          status_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          status?: string | null
          status_id: number
        }
        Update: {
          created_at?: string
          id?: number
          status?: string | null
          status_id?: number
        }
        Relationships: []
      }
      appointments_staff: {
        Row: {
          appointment_id: number | null
          created_at: string
          id: number
          staff_id: number | null
        }
        Insert: {
          appointment_id?: number | null
          created_at?: string
          id?: number
          staff_id?: number | null
        }
        Update: {
          appointment_id?: number | null
          created_at?: string
          id?: number
          staff_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_staff_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_details"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "appointments_staff_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "rc_appointments"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "appointments_staff_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "schedule_plan_details"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "appointments_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "rc_staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "appointments_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_details"
            referencedColumns: ["user_id"]
          },
        ]
      }
      error_log: {
        Row: {
          created_at: string
          error_message: string | null
          function_name: string | null
          id: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          function_name?: string | null
          id?: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          function_name?: string | null
          id?: number
        }
        Relationships: []
      }
      http_response: {
        Row: {
          content: string | null
          content_type: string | null
          created_at: string
          headers: string | null
          id: number
          status: number | null
        }
        Insert: {
          content?: string | null
          content_type?: string | null
          created_at?: string
          headers?: string | null
          id?: number
          status?: number | null
        }
        Update: {
          content?: string | null
          content_type?: string | null
          created_at?: string
          headers?: string | null
          id?: number
          status?: number | null
        }
        Relationships: []
      }
      plan_appointments: {
        Row: {
          appointment_id: number | null
          created_at: string
          id: number
          ord: number | null
          plan_id: number | null
          sent_to_rc: string | null
          valid: boolean
        }
        Insert: {
          appointment_id?: number | null
          created_at?: string
          id?: number
          ord?: number | null
          plan_id?: number | null
          sent_to_rc?: string | null
          valid?: boolean
        }
        Update: {
          appointment_id?: number | null
          created_at?: string
          id?: number
          ord?: number | null
          plan_id?: number | null
          sent_to_rc?: string | null
          valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "public_plan_appointments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_details"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "public_plan_appointments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "rc_appointments"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "public_plan_appointments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "schedule_plan_details"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "public_plan_appointments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planned_appointment_ids"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "public_plan_appointments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "schedule_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_staff: {
        Row: {
          created_at: string
          id: number
          plan_id: number | null
          staff_id: number | null
          valid: boolean
        }
        Insert: {
          created_at?: string
          id?: number
          plan_id?: number | null
          staff_id?: number | null
          valid?: boolean
        }
        Update: {
          created_at?: string
          id?: number
          plan_id?: number | null
          staff_id?: number | null
          valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "public_plan_staff_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planned_appointment_ids"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "public_plan_staff_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "schedule_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_plan_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "rc_staff"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "public_plan_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_details"
            referencedColumns: ["user_id"]
          },
        ]
      }
      property_status_key: {
        Row: {
          created_at: string
          id: number
          status: string | null
          status_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          status?: string | null
          status_id: number
        }
        Update: {
          created_at?: string
          id?: number
          status?: string | null
          status_id?: number
        }
        Relationships: []
      }
      rc_addresses: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          id: number
          location: unknown | null
          place_id: string | null
          postal_code: string | null
          state_name: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: number
          location?: unknown | null
          place_id?: string | null
          postal_code?: string | null
          state_name?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: number
          location?: unknown | null
          place_id?: string | null
          postal_code?: string | null
          state_name?: string | null
        }
        Relationships: []
      }
      rc_appointments: {
        Row: {
          app_status_id: number | null
          appointment_id: number | null
          arrival_time: string | null
          cancelled_date: string | null
          created_at: string
          departure_time: string | null
          id: number
          next_arrival_time: string | null
          property: number | null
          service: number | null
          turn_around: boolean | null
        }
        Insert: {
          app_status_id?: number | null
          appointment_id?: number | null
          arrival_time?: string | null
          cancelled_date?: string | null
          created_at?: string
          departure_time?: string | null
          id?: number
          next_arrival_time?: string | null
          property?: number | null
          service?: number | null
          turn_around?: boolean | null
        }
        Update: {
          app_status_id?: number | null
          appointment_id?: number | null
          arrival_time?: string | null
          cancelled_date?: string | null
          created_at?: string
          departure_time?: string | null
          id?: number
          next_arrival_time?: string | null
          property?: number | null
          service?: number | null
          turn_around?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rc_appointments_app_status_id_fkey"
            columns: ["app_status_id"]
            isOneToOne: false
            referencedRelation: "appointment_status_key"
            referencedColumns: ["status_id"]
          },
          {
            foreignKeyName: "rc_appointments_property_fkey"
            columns: ["property"]
            isOneToOne: false
            referencedRelation: "rc_properties"
            referencedColumns: ["properties_id"]
          },
          {
            foreignKeyName: "rc_appointments_service_fkey"
            columns: ["service"]
            isOneToOne: false
            referencedRelation: "service_key"
            referencedColumns: ["service_id"]
          },
        ]
      }
      rc_properties: {
        Row: {
          address: number | null
          created_at: string
          double_unit: number[] | null
          estimated_cleaning_mins: number | null
          id: number
          properties_id: number | null
          property_name: string | null
          status_id: number | null
        }
        Insert: {
          address?: number | null
          created_at?: string
          double_unit?: number[] | null
          estimated_cleaning_mins?: number | null
          id?: number
          properties_id?: number | null
          property_name?: string | null
          status_id?: number | null
        }
        Update: {
          address?: number | null
          created_at?: string
          double_unit?: number[] | null
          estimated_cleaning_mins?: number | null
          id?: number
          properties_id?: number | null
          property_name?: string | null
          status_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "public_rc_properties_address_fkey"
            columns: ["address"]
            isOneToOne: false
            referencedRelation: "rc_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rc_properties_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "property_status_key"
            referencedColumns: ["status_id"]
          },
        ]
      }
      rc_staff: {
        Row: {
          created_at: string
          first_name: string | null
          hb_user_id: number | null
          id: number
          last_name: string | null
          name: string | null
          role: number | null
          status_id: number | null
          user_id: number | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          hb_user_id?: number | null
          id?: number
          last_name?: string | null
          name?: string | null
          role?: number | null
          status_id?: number | null
          user_id?: number | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          hb_user_id?: number | null
          id?: number
          last_name?: string | null
          name?: string | null
          role?: number | null
          status_id?: number | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "public_rc_staff_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rc_staff_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "staff_status_key"
            referencedColumns: ["status_id"]
          },
        ]
      }
      rc_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expires: string | null
          id: number
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires?: string | null
          id?: number
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires?: string | null
          id?: number
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: number
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: number
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: number
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      roles: {
        Row: {
          can_clean: boolean
          can_lead_team: boolean
          created_at: string
          description: string | null
          id: number
          priority: number
          title: string | null
        }
        Insert: {
          can_clean?: boolean
          can_lead_team?: boolean
          created_at?: string
          description?: string | null
          id?: number
          priority?: number
          title?: string | null
        }
        Update: {
          can_clean?: boolean
          can_lead_team?: boolean
          created_at?: string
          description?: string | null
          id?: number
          priority?: number
          title?: string | null
        }
        Relationships: []
      }
      schedule_plans: {
        Row: {
          created_at: string
          id: number
          plan_date: string | null
          team: number | null
          valid: boolean
        }
        Insert: {
          created_at?: string
          id?: number
          plan_date?: string | null
          team?: number | null
          valid?: boolean
        }
        Update: {
          created_at?: string
          id?: number
          plan_date?: string | null
          team?: number | null
          valid?: boolean
        }
        Relationships: []
      }
      send_schedule_job_queue: {
        Row: {
          created_at: string
          id: number
          schedule_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          schedule_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          schedule_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      service_key: {
        Row: {
          created_at: string
          id: number
          name: string | null
          service_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string | null
          service_id: number
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          service_id?: number
        }
        Relationships: []
      }
      staff_status_key: {
        Row: {
          created_at: string
          id: number
          status: string | null
          status_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          status?: string | null
          status_id: number
        }
        Update: {
          created_at?: string
          id?: number
          status?: string | null
          status_id?: number
        }
        Relationships: []
      }
      travel_times: {
        Row: {
          created_at: string
          dest_address_id: number
          distance_in_meters: number | null
          id: number
          src_address_id: number
          travel_time_minutes: number
        }
        Insert: {
          created_at?: string
          dest_address_id: number
          distance_in_meters?: number | null
          id?: number
          src_address_id: number
          travel_time_minutes: number
        }
        Update: {
          created_at?: string
          dest_address_id?: number
          distance_in_meters?: number | null
          id?: number
          src_address_id?: number
          travel_time_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "public_travel_times_dest_address_id_fkey"
            columns: ["dest_address_id"]
            isOneToOne: false
            referencedRelation: "rc_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_travel_times_src_address_id_fkey"
            columns: ["src_address_id"]
            isOneToOne: false
            referencedRelation: "rc_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      appointment_details: {
        Row: {
          appointment_id: number | null
          departure_time: string | null
          next_arrival: string | null
          property_name: string | null
          service_name: string | null
          staff_name: string | null
          status: string | null
          turn_around: boolean | null
        }
        Relationships: []
      }
      decrypted_rc_tokens: {
        Row: {
          access_token: string | null
          created_at: string | null
          decrypted_access_token: string | null
          expires: string | null
          id: number | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          decrypted_access_token?: never
          expires?: string | null
          id?: number | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          decrypted_access_token?: never
          expires?: string | null
          id?: number | null
        }
        Relationships: []
      }
      planned_appointment_ids: {
        Row: {
          appointment_id: number | null
          plan_date: string | null
          plan_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "public_plan_appointments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_details"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "public_plan_appointments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "rc_appointments"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "public_plan_appointments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "schedule_plan_details"
            referencedColumns: ["appointment_id"]
          },
        ]
      }
      schedule_plan_details: {
        Row: {
          appointment_id: number | null
          departure_time: string | null
          estimated_cleaning_mins: number | null
          next_arrival: string | null
          ord: number | null
          property_name: string | null
          sent_to_rc: string | null
          service_name: string | null
          staff_name: string | null
          status: string | null
          team: number | null
        }
        Relationships: []
      }
      staff_details: {
        Row: {
          name: string | null
          status: string | null
          title: string | null
          user_id: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      authorize: {
        Args: {
          requested_permission: Database["public"]["Enums"]["app_permission"]
        }
        Returns: boolean
      }
      build_schedule_plan: {
        Args: {
          available_staff: number[]
          cleaning_window?: number
          date_to_schedule: string
          max_hours?: number
          office_location: unknown
          omissions: number[]
          routing_type?: number
          services: number[]
          target_staff_count?: number
        }
        Returns: undefined
      }
      copy_schedule_plan: {
        Args: { schedule_date: string }
        Returns: undefined
      }
      custom_access_token_hook: {
        Args: { event: Json }
        Returns: Json
      }
      get_geom_and_placeid_from_address: {
        Args: { address: string }
        Returns: Record<string, unknown>
      }
      get_geom_from_address: {
        Args: { address: string }
        Returns: unknown
      }
      get_rc_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_staff_shifts: {
        Args: { date_from: string; date_to: string }
        Returns: Json
      }
      get_total_time: {
        Args: {
          date_to_check: string
          office_location: unknown
          omissions: number[]
          services: number[]
        }
        Returns: Record<string, unknown>
      }
      http_get_appointments: {
        Args: { date_from: string; date_to: string }
        Returns: number
      }
      http_get_distance_matrix: {
        Args: { destination_place_ids: string[]; origin_place_ids: string[] }
        Returns: number
      }
      http_get_employees: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      http_get_geocode: {
        Args: { address: string }
        Returns: number
      }
      http_get_properties: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      http_get_shifts: {
        Args: { date_from: string; date_to: string }
        Returns: number
      }
      http_get_staff: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      http_put_appointment_staff: {
        Args: { appointment_id: number; assignment_json: Json }
        Returns: number
      }
      plan_add_appointment: {
        Args: { appointment_to_add: number; target_plan: number }
        Returns: undefined
      }
      plan_add_staff: {
        Args: { staff_to_add: number; target_plan: number }
        Returns: undefined
      }
      plan_create_new: {
        Args: { target_plan_date: string }
        Returns: {
          id: number
          plan_date: string
          team: number
        }[]
      }
      plan_remove_appointment: {
        Args: { appointment_to_remove: number; target_plan: number }
        Returns: undefined
      }
      plan_remove_staff: {
        Args: { staff_to_remove: number; target_plan: number }
        Returns: undefined
      }
      process_send_schedule_job_queue: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      schedule_send_rc_schedule_plans: {
        Args: { schedule_date: string }
        Returns: undefined
      }
      send_rc_schedule_plans: {
        Args: { schedule_date: string }
        Returns: boolean
      }
      set_rc_appointment_staff: {
        Args: { appointment_id: number; staff_ids: number[] }
        Returns: boolean
      }
      set_staff_group: {
        Args: { appt_id: number; staff_json: Json }
        Returns: undefined
      }
      set_travel_times: {
        Args: { address_id: number }
        Returns: undefined
      }
      update_appointments: {
        Args: { date_from: string; date_to: string }
        Returns: undefined
      }
      update_employee_roles: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_properties: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_staff: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_permission:
        | "rc_addresses.select"
        | "rc_appointments.select"
        | "rc_properties.select"
        | "rc_properties.update"
        | "rc_staff.select"
        | "rc_tokens.select"
        | "roles.select"
        | "roles.update"
        | "schedule_plans.select"
        | "schedule_plans.update"
        | "schedule_plans.insert"
        | "plan_appointments.select"
        | "plan_appointments.update"
        | "plan_appointments.insert"
        | "plan_staff.select"
        | "plan_staff.update"
        | "plan_staff.insert"
        | "service_key.select"
        | "appointment_status_key.select"
        | "property_status_key.select"
        | "staff_status_key.select"
        | "appointments_staff.select"
        | "error_log.select"
        | "error_log.insert"
        | "http_response.select"
        | "http_response.insert"
        | "travel_times.select"
        | "send_schedule_job_queue.insert"
      app_role: "authenticated" | "authorized_user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          format: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          format?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          level: number | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          level?: number | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      prefixes: {
        Row: {
          bucket_id: string
          created_at: string | null
          level: number
          name: string
          updated_at: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string | null
          level?: number
          name: string
          updated_at?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string | null
          level?: number
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prefixes_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string }
        Returns: undefined
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      delete_prefix: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      extension: {
        Args: { name: string }
        Returns: string
      }
      filename: {
        Args: { name: string }
        Returns: string
      }
      foldername: {
        Args: { name: string }
        Returns: string[]
      }
      get_level: {
        Args: { name: string }
        Returns: number
      }
      get_prefix: {
        Args: { name: string }
        Returns: string
      }
      get_prefixes: {
        Args: { name: string }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          start_after?: string
        }
        Returns: {
          id: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_legacy_v1: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v1_optimised: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_permission: [
        "rc_addresses.select",
        "rc_appointments.select",
        "rc_properties.select",
        "rc_properties.update",
        "rc_staff.select",
        "rc_tokens.select",
        "roles.select",
        "roles.update",
        "schedule_plans.select",
        "schedule_plans.update",
        "schedule_plans.insert",
        "plan_appointments.select",
        "plan_appointments.update",
        "plan_appointments.insert",
        "plan_staff.select",
        "plan_staff.update",
        "plan_staff.insert",
        "service_key.select",
        "appointment_status_key.select",
        "property_status_key.select",
        "staff_status_key.select",
        "appointments_staff.select",
        "error_log.select",
        "error_log.insert",
        "http_response.select",
        "http_response.insert",
        "travel_times.select",
        "send_schedule_job_queue.insert",
      ],
      app_role: ["authenticated", "authorized_user"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS"],
    },
  },
} as const
