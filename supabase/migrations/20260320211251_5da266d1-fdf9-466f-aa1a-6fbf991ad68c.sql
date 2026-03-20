ALTER TABLE public.meetings ADD COLUMN facilitator_id UUID REFERENCES public.team_members(id);
ALTER TABLE public.meetings ADD COLUMN note_taker_id UUID REFERENCES public.team_members(id);