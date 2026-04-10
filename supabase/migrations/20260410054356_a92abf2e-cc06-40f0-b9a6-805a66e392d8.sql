ALTER TABLE public.meeting_sub_sessions
ADD COLUMN type_specific_data jsonb DEFAULT '{}'::jsonb;