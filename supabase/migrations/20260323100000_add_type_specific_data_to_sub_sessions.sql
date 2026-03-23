ALTER TABLE public.meeting_sub_sessions
ADD COLUMN IF NOT EXISTS type_specific_data jsonb NOT NULL DEFAULT '{}';
