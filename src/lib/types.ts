import type { Tables } from "@/integrations/supabase/types";

export type TeamMember = Tables<"team_members">;
export type Activity = Tables<"activities">;
export type ActivityParticipant = Tables<"activity_participants">;
export type BacklogItem = Tables<"backlog_items">;
export type Sprint = Tables<"sprints">;
export type SprintItem = Tables<"sprint_items">;
export type Subtask = Tables<"subtasks">;
export type Decision = Tables<"decisions">;
export type Meeting = Tables<"meetings">;
export type MeetingActionPoint = Tables<"meeting_action_points">;
export type StandupEntry = Tables<"standup_entries">;
export type Resource = Tables<"resources">;
export type Task = Tables<"tasks">;
