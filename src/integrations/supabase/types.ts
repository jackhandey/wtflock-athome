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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          event_id: string
          id: string
          plate: string
          reason: Database["public"]["Enums"]["watch_reason"]
          user_id: string
          watchlist_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          plate: string
          reason?: Database["public"]["Enums"]["watch_reason"]
          user_id: string
          watchlist_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          plate?: string
          reason?: Database["public"]["Enums"]["watch_reason"]
          user_id?: string
          watchlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlist_plates"
            referencedColumns: ["id"]
          },
        ]
      }
      cameras: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_seen_at: string | null
          location: string | null
          name: string
          poll_interval_seconds: number
          source_type: Database["public"]["Enums"]["camera_source"]
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_seen_at?: string | null
          location?: string | null
          name: string
          poll_interval_seconds?: number
          source_type?: Database["public"]["Enums"]["camera_source"]
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_seen_at?: string | null
          location?: string | null
          name?: string
          poll_interval_seconds?: number
          source_type?: Database["public"]["Enums"]["camera_source"]
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      device_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked?: boolean
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          camera_id: string
          captured_at: string
          created_at: string
          id: string
          image_path: string
          person_count: number
          plate_confidence: number | null
          plate_normalized: string | null
          plate_text: string | null
          summary: string | null
          user_id: string
          vehicle_color: string | null
          vehicle_count: number
          vehicle_make: string | null
          vehicle_type: string | null
        }
        Insert: {
          camera_id: string
          captured_at?: string
          created_at?: string
          id?: string
          image_path: string
          person_count?: number
          plate_confidence?: number | null
          plate_normalized?: string | null
          plate_text?: string | null
          summary?: string | null
          user_id: string
          vehicle_color?: string | null
          vehicle_count?: number
          vehicle_make?: string | null
          vehicle_type?: string | null
        }
        Update: {
          camera_id?: string
          captured_at?: string
          created_at?: string
          id?: string
          image_path?: string
          person_count?: number
          plate_confidence?: number | null
          plate_normalized?: string | null
          plate_text?: string | null
          summary?: string | null
          user_id?: string
          vehicle_color?: string | null
          vehicle_count?: number
          vehicle_make?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          alert_email: string | null
          retention_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_email?: string | null
          retention_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_email?: string | null
          retention_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist_plates: {
        Row: {
          created_at: string
          id: string
          label: string | null
          notes: string | null
          plate: string
          plate_normalized: string
          reason: Database["public"]["Enums"]["watch_reason"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          plate: string
          plate_normalized: string
          reason?: Database["public"]["Enums"]["watch_reason"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          plate?: string
          plate_normalized?: string
          reason?: Database["public"]["Enums"]["watch_reason"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      camera_source: "snapshot" | "rtsp"
      watch_reason: "expected" | "suspicious" | "blocked"
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
  public: {
    Enums: {
      camera_source: ["snapshot", "rtsp"],
      watch_reason: ["expected", "suspicious", "blocked"],
    },
  },
} as const
