
-- Add auth_user_id column to team_members
ALTER TABLE public.team_members ADD COLUMN auth_user_id uuid UNIQUE;

-- Create index for fast lookup
CREATE INDEX idx_team_members_auth_user_id ON public.team_members(auth_user_id);

-- Create a security definer function to get team member id from auth uid
CREATE OR REPLACE FUNCTION public.get_team_member_id_for_auth_user(_auth_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.team_members WHERE auth_user_id = _auth_uid LIMIT 1;
$$;
