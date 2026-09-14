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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          org_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          org_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          org_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          org_id: string
          sensor_id: string | null
          severity: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          org_id: string
          sensor_id?: string | null
          severity?: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          org_id?: string
          sensor_id?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_stage_thresholds: {
        Row: {
          created_at: string
          crop_stage_id: string
          id: string
          max_value: number | null
          min_value: number | null
          sensor_type_id: string
        }
        Insert: {
          created_at?: string
          crop_stage_id: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          sensor_type_id: string
        }
        Update: {
          created_at?: string
          crop_stage_id?: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          sensor_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crop_stage_thresholds_crop_stage_id_fkey"
            columns: ["crop_stage_id"]
            isOneToOne: false
            referencedRelation: "crop_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_stage_thresholds_sensor_type_id_fkey"
            columns: ["sensor_type_id"]
            isOneToOne: false
            referencedRelation: "sensor_types"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_stages: {
        Row: {
          created_at: string
          crop_id: string
          description: string | null
          id: string
          name: string
          stage_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          crop_id: string
          description?: string | null
          id?: string
          name: string
          stage_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          crop_id?: string
          description?: string | null
          id?: string
          name?: string
          stage_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crop_stages_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      crops: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crops_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_entries: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          org_id: string
          recorded_at: string
          sensor_id: string | null
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          recorded_at?: string
          sensor_id?: string | null
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          recorded_at?: string
          sensor_id?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_entries_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sensor_readings: {
        Row: {
          battery_v: number | null
          channel: string | null
          checksum_valid: boolean | null
          conductivity: number | null
          dev_eui: string | null
          device_id: number | null
          id: string
          moisture_pct: number | null
          nitrogen: number | null
          packet_type: number | null
          ph: number | null
          phosphorus: number | null
          potassium: number | null
          recorded_at: string
          report_cycle_s: number | null
          salinity: number | null
          sensor_id: string | null
          serial_number: number | null
          temperature_c: number | null
          value: number | null
        }
        Insert: {
          battery_v?: number | null
          channel?: string | null
          checksum_valid?: boolean | null
          conductivity?: number | null
          dev_eui?: string | null
          device_id?: number | null
          id?: string
          moisture_pct?: number | null
          nitrogen?: number | null
          packet_type?: number | null
          ph?: number | null
          phosphorus?: number | null
          potassium?: number | null
          recorded_at?: string
          report_cycle_s?: number | null
          salinity?: number | null
          sensor_id?: string | null
          serial_number?: number | null
          temperature_c?: number | null
          value?: number | null
        }
        Update: {
          battery_v?: number | null
          channel?: string | null
          checksum_valid?: boolean | null
          conductivity?: number | null
          dev_eui?: string | null
          device_id?: number | null
          id?: string
          moisture_pct?: number | null
          nitrogen?: number | null
          packet_type?: number | null
          ph?: number | null
          phosphorus?: number | null
          potassium?: number | null
          recorded_at?: string
          report_cycle_s?: number | null
          salinity?: number | null
          sensor_id?: string | null
          serial_number?: number | null
          temperature_c?: number | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_types: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          max_value: number | null
          min_value: number | null
          name: string
          unit: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          name: string
          unit: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          max_value?: number | null
          min_value?: number | null
          name?: string
          unit?: string
        }
        Relationships: []
      }
      sensors: {
        Row: {
          created_at: string
          dev_eui: string | null
          device_id: number | null
          id: string
          ip_address: string | null
          is_active: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          map_x: number | null
          map_y: number | null
          name: string
          notes: string | null
          org_id: string
          sensor_type_id: string
          status: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          dev_eui?: string | null
          device_id?: number | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          map_x?: number | null
          map_y?: number | null
          name: string
          notes?: string | null
          org_id: string
          sensor_type_id: string
          status?: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          dev_eui?: string | null
          device_id?: number | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          map_x?: number | null
          map_y?: number | null
          name?: string
          notes?: string | null
          org_id?: string
          sensor_type_id?: string
          status?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensors_sensor_type_id_fkey"
            columns: ["sensor_type_id"]
            isOneToOne: false
            referencedRelation: "sensor_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensors_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          background_image_url: string | null
          boundaries: Json | null
          color: string
          created_at: string
          crop_id: string | null
          crop_stage_id: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          background_image_url?: string | null
          boundaries?: Json | null
          color?: string
          created_at?: string
          crop_id?: string | null
          crop_stage_id?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          background_image_url?: string | null
          boundaries?: Json | null
          color?: string
          created_at?: string
          crop_id?: string | null
          crop_stage_id?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_crop_stage_id_fkey"
            columns: ["crop_stage_id"]
            isOneToOne: false
            referencedRelation: "crop_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_sensor_reading: {
        Args: {
          p_battery_v: number
          p_channel: string
          p_checksum_valid: boolean
          p_conductivity: number
          p_dev_eui: string
          p_device_id: number
          p_moisture_pct: number
          p_nitrogen: number
          p_packet_type: number
          p_ph: number
          p_phosphorus: number
          p_potassium: number
          p_report_cycle_s: number
          p_salinity: number
          p_serial_number: number
          p_temperature_c: number
        }
        Returns: Json
      }
      is_master_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      master_admin_overview: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer" | "master_admin"
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
      app_role: ["admin", "operator", "viewer", "master_admin"],
    },
  },
} as const
