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
      activities: {
        Row: {
          attachment_links: string[] | null
          completed_date: string | null
          completed_week: number | null
          created_at: string
          deadline_date: string | null
          deadline_phase: string | null
          description: string | null
          id: string
          is_mandatory: boolean
          max_points: number | null
          name: string
          notes: string | null
          planned_week: number | null
          points: number
          status: string
          updated_at: string
        }
        Insert: {
          attachment_links?: string[] | null
          completed_date?: string | null
          completed_week?: number | null
          created_at?: string
          deadline_date?: string | null
          deadline_phase?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean
          max_points?: number | null
          name: string
          notes?: string | null
          planned_week?: number | null
          points?: number
          status?: string
          updated_at?: string
        }
        Update: {
          attachment_links?: string[] | null
          completed_date?: string | null
          completed_week?: number | null
          created_at?: string
          deadline_date?: string | null
          deadline_phase?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean
          max_points?: number | null
          name?: string
          notes?: string | null
          planned_week?: number | null
          points?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_participants: {
        Row: {
          activity_id: string
          id: string
          member_id: string
        }
        Insert: {
          activity_id: string
          id?: string
          member_id: string
        }
        Update: {
          activity_id?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_agenda_items: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          meeting_id: string
          question: string
          sort_order: number
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          question: string
          sort_order?: number
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          question?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "advisor_agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      backlog_items: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          epic: string | null
          estimate: number | null
          id: string
          item_id: string
          labels: string[] | null
          priority: string
          sort_order: number
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          epic?: string | null
          estimate?: number | null
          id?: string
          item_id: string
          labels?: string[] | null
          priority?: string
          sort_order?: number
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          epic?: string | null
          estimate?: number | null
          id?: string
          item_id?: string
          labels?: string[] | null
          priority?: string
          sort_order?: number
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlog_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          choice: string | null
          context: string | null
          created_at: string
          date: string
          id: string
          participants: string[] | null
          rationale: string | null
          related_backlog_items: string[] | null
          source: string | null
          title: string
        }
        Insert: {
          choice?: string | null
          context?: string | null
          created_at?: string
          date?: string
          id?: string
          participants?: string[] | null
          rationale?: string | null
          related_backlog_items?: string[] | null
          source?: string | null
          title: string
        }
        Update: {
          choice?: string | null
          context?: string | null
          created_at?: string
          date?: string
          id?: string
          participants?: string[] | null
          rationale?: string | null
          related_backlog_items?: string[] | null
          source?: string | null
          title?: string
        }
        Relationships: []
      }
      meeting_action_points: {
        Row: {
          assignee_id: string | null
          created_at: string
          deadline: string | null
          id: string
          is_completed: boolean
          meeting_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          is_completed?: boolean
          meeting_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          is_completed?: boolean
          meeting_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_points_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_points_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          date: string
          duration_minutes: number | null
          id: string
          notes: string | null
          participants: string[] | null
          planning_capacity: Json | null
          related_activity_id: string | null
          review_feedback: string | null
          sprint_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          participants?: string[] | null
          planning_capacity?: Json | null
          related_activity_id?: string | null
          review_feedback?: string | null
          sprint_id?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          date?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          participants?: string[] | null
          planning_capacity?: Json | null
          related_activity_id?: string | null
          review_feedback?: string | null
          sprint_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_related_activity_id_fkey"
            columns: ["related_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          title: string
          url: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          title: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      retro_items: {
        Row: {
          column_type: string
          created_at: string
          group_label: string | null
          id: string
          is_anonymous: boolean
          is_grouped: boolean
          meeting_id: string
          member_id: string | null
          text: string
        }
        Insert: {
          column_type: string
          created_at?: string
          group_label?: string | null
          id?: string
          is_anonymous?: boolean
          is_grouped?: boolean
          meeting_id: string
          member_id?: string | null
          text: string
        }
        Update: {
          column_type?: string
          created_at?: string
          group_label?: string | null
          id?: string
          is_anonymous?: boolean
          is_grouped?: boolean
          meeting_id?: string
          member_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "retro_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retro_items_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_items: {
        Row: {
          backlog_item_id: string
          column_name: string
          column_order: number
          id: string
          sprint_id: string
        }
        Insert: {
          backlog_item_id: string
          column_name?: string
          column_order?: number
          id?: string
          sprint_id: string
        }
        Update: {
          backlog_item_id?: string
          column_name?: string
          column_order?: number
          id?: string
          sprint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_items_backlog_item_id_fkey"
            columns: ["backlog_item_id"]
            isOneToOne: false
            referencedRelation: "backlog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_items_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          created_at: string
          end_date: string
          goal: string | null
          id: string
          is_active: boolean
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          goal?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          goal?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      standup_entries: {
        Row: {
          blockers: string | null
          did_yesterday: string | null
          doing_today: string | null
          id: string
          meeting_id: string
          member_id: string
        }
        Insert: {
          blockers?: string | null
          did_yesterday?: string | null
          doing_today?: string | null
          id?: string
          meeting_id: string
          member_id: string
        }
        Update: {
          blockers?: string | null
          did_yesterday?: string | null
          doing_today?: string | null
          id?: string
          meeting_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standup_entries_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standup_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          backlog_item_id: string
          created_at: string
          id: string
          is_completed: boolean
          title: string
        }
        Insert: {
          backlog_item_id: string
          created_at?: string
          id?: string
          is_completed?: boolean
          title: string
        }
        Update: {
          backlog_item_id?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_backlog_item_id_fkey"
            columns: ["backlog_item_id"]
            isOneToOne: false
            referencedRelation: "backlog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_color: string
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
