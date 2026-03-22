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
          experiences: string | null
          id: string
          is_mandatory: boolean
          max_points: number | null
          name: string
          notes: string | null
          planned_week: number | null
          points: number
          reflections: string | null
          status: string
          timing_rationale: string | null
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
          experiences?: string | null
          id?: string
          is_mandatory?: boolean
          max_points?: number | null
          name: string
          notes?: string | null
          planned_week?: number | null
          points?: number
          reflections?: string | null
          status?: string
          timing_rationale?: string | null
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
          experiences?: string | null
          id?: string
          is_mandatory?: boolean
          max_points?: number | null
          name?: string
          notes?: string | null
          planned_week?: number | null
          points?: number
          reflections?: string | null
          status?: string
          timing_rationale?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      activity_catalog: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_mandatory: boolean
          max_occurrences: number
          meeting_type: string | null
          name: string
          period: string
          period_deadline: string | null
          points: number
          prosesslogg_template: string | null
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          max_occurrences?: number
          meeting_type?: string | null
          name: string
          period?: string
          period_deadline?: string | null
          points?: number
          prosesslogg_template?: string | null
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          max_occurrences?: number
          meeting_type?: string | null
          name?: string
          period?: string
          period_deadline?: string | null
          points?: number
          prosesslogg_template?: string | null
          sort_order?: number
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
      activity_registration_participants: {
        Row: {
          id: string
          member_id: string
          registration_id: string
        }
        Insert: {
          id?: string
          member_id: string
          registration_id: string
        }
        Update: {
          id?: string
          member_id?: string
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_registration_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_registration_participants_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "activity_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_registrations: {
        Row: {
          attachment_links: string[] | null
          catalog_id: string
          completed_date: string | null
          completed_week: number | null
          created_at: string
          description: string | null
          experiences: string | null
          id: string
          linked_meeting_id: string | null
          linked_sub_session_id: string | null
          occurrence_number: number
          planned_week: number | null
          reflections: string | null
          short_status: string | null
          status: string
          timing_rationale: string | null
        }
        Insert: {
          attachment_links?: string[] | null
          catalog_id: string
          completed_date?: string | null
          completed_week?: number | null
          created_at?: string
          description?: string | null
          experiences?: string | null
          id?: string
          linked_meeting_id?: string | null
          linked_sub_session_id?: string | null
          occurrence_number?: number
          planned_week?: number | null
          reflections?: string | null
          short_status?: string | null
          status?: string
          timing_rationale?: string | null
        }
        Update: {
          attachment_links?: string[] | null
          catalog_id?: string
          completed_date?: string | null
          completed_week?: number | null
          created_at?: string
          description?: string | null
          experiences?: string | null
          id?: string
          linked_meeting_id?: string | null
          linked_sub_session_id?: string | null
          occurrence_number?: number
          planned_week?: number | null
          reflections?: string | null
          short_status?: string | null
          status?: string
          timing_rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_registrations_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "activity_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_registrations_linked_meeting_id_fkey"
            columns: ["linked_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_registrations_linked_sub_session_id_fkey"
            columns: ["linked_sub_session_id"]
            isOneToOne: false
            referencedRelation: "meeting_sub_sessions"
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
      backlog_changelog: {
        Row: {
          backlog_item_id: string
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          backlog_item_id: string
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          backlog_item_id?: string
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backlog_changelog_backlog_item_id_fkey"
            columns: ["backlog_item_id"]
            isOneToOne: false
            referencedRelation: "backlog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backlog_changelog_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      backlog_items: {
        Row: {
          assignee_id: string | null
          collaborator_ids: string[] | null
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
          collaborator_ids?: string[] | null
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
          collaborator_ids?: string[] | null
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
      daily_updates: {
        Row: {
          backlog_item_id: string | null
          category: string | null
          content: string | null
          created_at: string
          entry_date: string
          id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          backlog_item_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          entry_date: string
          id?: string
          member_id: string
          updated_at?: string
        }
        Update: {
          backlog_item_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_updates_backlog_item_id_fkey"
            columns: ["backlog_item_id"]
            isOneToOne: false
            referencedRelation: "backlog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_updates_member_id_fkey"
            columns: ["member_id"]
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
          source_sub_session_id: string | null
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          is_completed?: boolean
          meeting_id: string
          source_sub_session_id?: string | null
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          is_completed?: boolean
          meeting_id?: string
          source_sub_session_id?: string | null
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
          {
            foreignKeyName: "meeting_action_points_source_sub_session_id_fkey"
            columns: ["source_sub_session_id"]
            isOneToOne: false
            referencedRelation: "meeting_sub_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_agenda_items: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          is_completed: boolean
          meeting_id: string
          sort_order: number
          title: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          meeting_id: string
          sort_order?: number
          title: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          meeting_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_agenda_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_rotation: {
        Row: {
          id: number
          leader_id: string
          notetaker_id: string
          position: number
        }
        Insert: {
          id?: number
          leader_id: string
          notetaker_id: string
          position: number
        }
        Update: {
          id?: number
          leader_id?: string
          notetaker_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_rotation_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_rotation_notetaker_id_fkey"
            columns: ["notetaker_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_sub_session_items: {
        Row: {
          content: string
          id: string
          sort_order: number
          sub_session_id: string
        }
        Insert: {
          content: string
          id?: string
          sort_order?: number
          sub_session_id: string
        }
        Update: {
          content?: string
          id?: string
          sort_order?: number
          sub_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_sub_session_items_sub_session_id_fkey"
            columns: ["sub_session_id"]
            isOneToOne: false
            referencedRelation: "meeting_sub_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_sub_sessions: {
        Row: {
          id: string
          linked_activity_id: string | null
          meeting_id: string
          notes: string | null
          sort_order: number
          title: string
          type: string
        }
        Insert: {
          id?: string
          linked_activity_id?: string | null
          meeting_id: string
          notes?: string | null
          sort_order?: number
          title: string
          type: string
        }
        Update: {
          id?: string
          linked_activity_id?: string | null
          meeting_id?: string
          notes?: string | null
          sort_order?: number
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_sub_sessions_linked_activity_id_fkey"
            columns: ["linked_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_sub_sessions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          created_at: string
          date: string
          duration_minutes: number | null
          facilitator_id: string | null
          id: string
          leader_id: string | null
          meeting_date: string | null
          note_taker_id: string | null
          notes: string | null
          notetaker_id: string | null
          participants: string[] | null
          planning_capacity: Json | null
          recurring_meeting_id: string | null
          related_activity_id: string | null
          review_feedback: string | null
          room: string | null
          rotation_position: number | null
          sprint_id: string | null
          status: string
          type: string
          week_number: number | null
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number | null
          facilitator_id?: string | null
          id?: string
          leader_id?: string | null
          meeting_date?: string | null
          note_taker_id?: string | null
          notes?: string | null
          notetaker_id?: string | null
          participants?: string[] | null
          planning_capacity?: Json | null
          recurring_meeting_id?: string | null
          related_activity_id?: string | null
          review_feedback?: string | null
          room?: string | null
          rotation_position?: number | null
          sprint_id?: string | null
          status?: string
          type?: string
          week_number?: number | null
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number | null
          facilitator_id?: string | null
          id?: string
          leader_id?: string | null
          meeting_date?: string | null
          note_taker_id?: string | null
          notes?: string | null
          notetaker_id?: string | null
          participants?: string[] | null
          planning_capacity?: Json | null
          recurring_meeting_id?: string | null
          related_activity_id?: string | null
          review_feedback?: string | null
          room?: string | null
          rotation_position?: number | null
          sprint_id?: string | null
          status?: string
          type?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_note_taker_id_fkey"
            columns: ["note_taker_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_notetaker_id_fkey"
            columns: ["notetaker_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_recurring_meeting_id_fkey"
            columns: ["recurring_meeting_id"]
            isOneToOne: false
            referencedRelation: "recurring_meetings"
            referencedColumns: ["id"]
          },
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
      milestones: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          is_completed: boolean
          is_fixed: boolean
          linked_activity_id: string | null
          linked_sprint_id: string | null
          priority: string
          title: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          is_completed?: boolean
          is_fixed?: boolean
          linked_activity_id?: string | null
          linked_sprint_id?: string | null
          priority?: string
          title: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          is_fixed?: boolean
          linked_activity_id?: string | null
          linked_sprint_id?: string | null
          priority?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_linked_activity_id_fkey"
            columns: ["linked_activity_id"]
            isOneToOne: false
            referencedRelation: "activity_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_linked_sprint_id_fkey"
            columns: ["linked_sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      prosesslogg_notes: {
        Row: {
          added_by: string | null
          category: string
          content: string
          created_at: string
          id: string
          is_resolved: boolean
          linked_registration_id: string | null
          resolved_at: string | null
        }
        Insert: {
          added_by?: string | null
          category?: string
          content: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          linked_registration_id?: string | null
          resolved_at?: string | null
        }
        Update: {
          added_by?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          linked_registration_id?: string | null
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prosesslogg_notes_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prosesslogg_notes_linked_registration_id_fkey"
            columns: ["linked_registration_id"]
            isOneToOne: false
            referencedRelation: "activity_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_meetings: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          label: string
          start_time: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          label: string
          start_time: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          label?: string
          start_time?: string
        }
        Relationships: []
      }
      report_sections: {
        Row: {
          assignee_id: string | null
          created_at: string
          id: string
          notes: string | null
          sort_order: number
          status: string
          title: string
          updated_at: string
          word_count_goal: number
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          word_count_goal?: number
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          word_count_goal?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_sections_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
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
      sprint_daily_stats: {
        Row: {
          completed_points: number
          date: string
          id: string
          remaining_points: number
          sprint_id: string
        }
        Insert: {
          completed_points?: number
          date: string
          id?: string
          remaining_points?: number
          sprint_id: string
        }
        Update: {
          completed_points?: number
          date?: string
          id?: string
          remaining_points?: number
          sprint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_daily_stats_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
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
      sprint_snapshots: {
        Row: {
          completed_item_titles: string[] | null
          completed_items: number
          completed_points: number
          created_at: string
          daily_burndown: Json | null
          id: string
          incomplete_item_titles: string[] | null
          items_by_person: Json | null
          items_by_type: Json | null
          sprint_id: string
          total_items: number
          total_points: number
        }
        Insert: {
          completed_item_titles?: string[] | null
          completed_items?: number
          completed_points?: number
          created_at?: string
          daily_burndown?: Json | null
          id?: string
          incomplete_item_titles?: string[] | null
          items_by_person?: Json | null
          items_by_type?: Json | null
          sprint_id: string
          total_items?: number
          total_points?: number
        }
        Update: {
          completed_item_titles?: string[] | null
          completed_items?: number
          completed_points?: number
          created_at?: string
          daily_burndown?: Json | null
          id?: string
          incomplete_item_titles?: string[] | null
          items_by_person?: Json | null
          items_by_type?: Json | null
          sprint_id?: string
          total_items?: number
          total_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "sprint_snapshots_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          completed_at: string | null
          created_at: string
          end_date: string
          goal: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          reflection: string | null
          sprint_review_notes: string | null
          start_date: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          end_date: string
          goal?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          reflection?: string | null
          sprint_review_notes?: string | null
          start_date: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          end_date?: string
          goal?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          reflection?: string | null
          sprint_review_notes?: string | null
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
      task_subtasks: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          category: string
          collaborator_ids: string[] | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          sort_order: number
          title: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string
          collaborator_ids?: string[] | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          assignee_id?: string | null
          category?: string
          collaborator_ids?: string[] | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          auth_user_id: string | null
          avatar_color: string
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_color?: string
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          auth_user_id?: string | null
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
      get_team_member_id_for_auth_user: {
        Args: { _auth_uid: string }
        Returns: string
      }
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
