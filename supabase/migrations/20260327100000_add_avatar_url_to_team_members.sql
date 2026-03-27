-- Add avatar_url column for profile image uploads
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;
