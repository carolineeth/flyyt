
-- meeting_rotation table
CREATE TABLE public.meeting_rotation (
  id serial PRIMARY KEY,
  position integer NOT NULL UNIQUE CHECK (position BETWEEN 1 AND 6),
  leader_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  notetaker_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE
);
ALTER TABLE public.meeting_rotation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access select" ON public.meeting_rotation FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.meeting_rotation FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.meeting_rotation FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.meeting_rotation FOR DELETE TO authenticated USING (true);

-- Seed rotation
INSERT INTO public.meeting_rotation (position, leader_id, notetaker_id) VALUES
  (1, 'dc1d1833-1dd0-4744-9b3f-0364b8c73978', 'e7a65e29-7a68-49b7-9c49-f6d9aa4cab12'),
  (2, 'e7a65e29-7a68-49b7-9c49-f6d9aa4cab12', 'd7190a43-033c-4d01-a467-72817a357699'),
  (3, 'd7190a43-033c-4d01-a467-72817a357699', 'fb4303ae-d93a-4b39-acaf-9c876456150e'),
  (4, 'fb4303ae-d93a-4b39-acaf-9c876456150e', 'a6e1977a-f455-4d13-9619-48c9a4813936'),
  (5, 'a6e1977a-f455-4d13-9619-48c9a4813936', '750ea35f-dbe8-4818-b9d0-95c18737e834'),
  (6, '750ea35f-dbe8-4818-b9d0-95c18737e834', 'dc1d1833-1dd0-4744-9b3f-0364b8c73978');

-- recurring_meetings table
CREATE TABLE public.recurring_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.recurring_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access select" ON public.recurring_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.recurring_meetings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.recurring_meetings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.recurring_meetings FOR DELETE TO authenticated USING (true);

INSERT INTO public.recurring_meetings (day_of_week, start_time, end_time, label) VALUES
  (3, '12:00', '16:00', 'Gruppemøte onsdag'),
  (5, '10:00', '12:00', 'Gruppemøte fredag');

-- Update meetings table with new columns
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS week_number integer,
  ADD COLUMN IF NOT EXISTS recurring_meeting_id uuid REFERENCES public.recurring_meetings(id),
  ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES public.team_members(id),
  ADD COLUMN IF NOT EXISTS notetaker_id uuid REFERENCES public.team_members(id),
  ADD COLUMN IF NOT EXISTS rotation_position integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'upcoming',
  ADD COLUMN IF NOT EXISTS meeting_date date,
  ADD COLUMN IF NOT EXISTS actual_start_time time,
  ADD COLUMN IF NOT EXISTS actual_end_time time;

-- meeting_agenda_items table
CREATE TABLE public.meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title text NOT NULL,
  added_by uuid REFERENCES public.team_members(id),
  sort_order integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meeting_agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access select" ON public.meeting_agenda_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.meeting_agenda_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.meeting_agenda_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.meeting_agenda_items FOR DELETE TO authenticated USING (true);

-- meeting_sub_sessions table
CREATE TABLE public.meeting_sub_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  linked_activity_id uuid REFERENCES public.activities(id)
);
ALTER TABLE public.meeting_sub_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access select" ON public.meeting_sub_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.meeting_sub_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.meeting_sub_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.meeting_sub_sessions FOR DELETE TO authenticated USING (true);

-- meeting_sub_session_items table
CREATE TABLE public.meeting_sub_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_session_id uuid NOT NULL REFERENCES public.meeting_sub_sessions(id) ON DELETE CASCADE,
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.meeting_sub_session_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access select" ON public.meeting_sub_session_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.meeting_sub_session_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.meeting_sub_session_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.meeting_sub_session_items FOR DELETE TO authenticated USING (true);

-- Update meeting_action_points
ALTER TABLE public.meeting_action_points
  ADD COLUMN IF NOT EXISTS source_sub_session_id uuid REFERENCES public.meeting_sub_sessions(id);
