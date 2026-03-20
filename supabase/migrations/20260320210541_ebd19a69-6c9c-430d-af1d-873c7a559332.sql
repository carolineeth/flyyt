-- Add duration and sprint reference to meetings
ALTER TABLE public.meetings ADD COLUMN duration_minutes INTEGER;
ALTER TABLE public.meetings ADD COLUMN sprint_id UUID REFERENCES public.sprints(id);
ALTER TABLE public.meetings ADD COLUMN planning_capacity JSONB DEFAULT '{}';
ALTER TABLE public.meetings ADD COLUMN review_feedback TEXT;

-- Retro items for sailboat retrospective
CREATE TABLE public.retro_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  column_type TEXT NOT NULL, -- wind, anchor, rock, island
  text TEXT NOT NULL,
  member_id UUID REFERENCES public.team_members(id),
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  is_grouped BOOLEAN NOT NULL DEFAULT false,
  group_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Advisor meeting agenda items (prepared beforehand)
CREATE TABLE public.advisor_agenda_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add deadline to action points
ALTER TABLE public.meeting_action_points ADD COLUMN deadline DATE;

-- Enable RLS
ALTER TABLE public.retro_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_agenda_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated full access select" ON public.retro_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.retro_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.retro_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.retro_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated full access select" ON public.advisor_agenda_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.advisor_agenda_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.advisor_agenda_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.advisor_agenda_items FOR DELETE TO authenticated USING (true);