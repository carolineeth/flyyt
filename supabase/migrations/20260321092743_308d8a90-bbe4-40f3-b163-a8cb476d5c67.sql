
-- Add collaborator_ids to backlog_items
ALTER TABLE public.backlog_items
  ADD COLUMN collaborator_ids uuid[] DEFAULT '{}';

-- Add collaborator_ids to tasks
ALTER TABLE public.tasks
  ADD COLUMN collaborator_ids uuid[] DEFAULT '{}';

-- Create task_subtasks table
CREATE TABLE public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated select" ON public.task_subtasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.task_subtasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON public.task_subtasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON public.task_subtasks FOR DELETE TO authenticated USING (true);
