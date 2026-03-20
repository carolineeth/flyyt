-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_color TEXT NOT NULL DEFAULT '#0F6E56',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activities
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 1,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  deadline_phase TEXT,
  deadline_date DATE,
  status TEXT NOT NULL DEFAULT 'not_started',
  completed_date DATE,
  completed_week INTEGER,
  notes TEXT,
  attachment_links TEXT[] DEFAULT '{}',
  max_points INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity participants
CREATE TABLE public.activity_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  UNIQUE(activity_id, member_id)
);

-- Sprints
CREATE TABLE public.sprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backlog items
CREATE TABLE public.backlog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'user_story',
  priority TEXT NOT NULL DEFAULT 'should_have',
  estimate INTEGER,
  status TEXT NOT NULL DEFAULT 'backlog',
  assignee_id UUID REFERENCES public.team_members(id),
  epic TEXT,
  labels TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sprint items
CREATE TABLE public.sprint_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sprint_id UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  backlog_item_id UUID NOT NULL REFERENCES public.backlog_items(id) ON DELETE CASCADE,
  column_name TEXT NOT NULL DEFAULT 'todo',
  column_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(sprint_id, backlog_item_id)
);

-- Subtasks
CREATE TABLE public.subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  backlog_item_id UUID NOT NULL REFERENCES public.backlog_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Decisions
CREATE TABLE public.decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  context TEXT,
  choice TEXT,
  rationale TEXT,
  source TEXT,
  participants TEXT[] DEFAULT '{}',
  related_backlog_items UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meetings
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  participants UUID[] DEFAULT '{}',
  related_activity_id UUID REFERENCES public.activities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meeting action points
CREATE TABLE public.meeting_action_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee_id UUID REFERENCES public.team_members(id),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Standup entries
CREATE TABLE public.standup_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  did_yesterday TEXT,
  doing_today TEXT,
  blockers TEXT,
  UNIQUE(meeting_id, member_id)
);

-- Resources
CREATE TABLE public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standup_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- RLS policies: all authenticated users have full access
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'team_members', 'activities', 'activity_participants', 'sprints',
    'backlog_items', 'sprint_items', 'subtasks', 'decisions',
    'meetings', 'meeting_action_points', 'standup_entries', 'resources'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "Authenticated full access select" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Authenticated full access insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Authenticated full access update" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Authenticated full access delete" ON public.%I FOR DELETE TO authenticated USING (true)', t);
  END LOOP;
END $$;

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_backlog_items_updated_at BEFORE UPDATE ON public.backlog_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence for backlog item IDs
CREATE SEQUENCE public.backlog_item_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_backlog_item_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_id IS NULL OR NEW.item_id = '' THEN
    NEW.item_id = 'VID-' || LPAD(nextval('public.backlog_item_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_backlog_item_id BEFORE INSERT ON public.backlog_items FOR EACH ROW EXECUTE FUNCTION public.generate_backlog_item_id();