
-- Fix 1: team_members - restrict UPDATE to self-linking only
DROP POLICY "Authenticated full access update" ON public.team_members;

-- Allow users to only link themselves to an unclaimed member, or update their own row
CREATE POLICY "Self-link only update" ON public.team_members
  FOR UPDATE TO authenticated
  USING (
    auth_user_id IS NULL
    OR auth_user_id = auth.uid()
  )
  WITH CHECK (
    auth_user_id = auth.uid()
  );

-- Fix 2: team_members - restrict DELETE (no one should delete team members via client)
DROP POLICY "Authenticated full access delete" ON public.team_members;

CREATE POLICY "No client delete" ON public.team_members
  FOR DELETE TO authenticated
  USING (false);

-- Fix 3: daily_updates - scope UPDATE to owner
DROP POLICY "Authenticated update" ON public.daily_updates;

CREATE POLICY "Owner update" ON public.daily_updates
  FOR UPDATE TO authenticated
  USING (
    member_id = public.get_team_member_id_for_auth_user(auth.uid())
  )
  WITH CHECK (
    member_id = public.get_team_member_id_for_auth_user(auth.uid())
  );

-- Fix 4: daily_updates - scope INSERT to own member_id
DROP POLICY "Authenticated insert" ON public.daily_updates;

CREATE POLICY "Owner insert" ON public.daily_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = public.get_team_member_id_for_auth_user(auth.uid())
  );

-- Fix 5: standup_entries - scope UPDATE/DELETE to owner
DROP POLICY "Authenticated full access update" ON public.standup_entries;
DROP POLICY "Authenticated full access delete" ON public.standup_entries;

CREATE POLICY "Owner update" ON public.standup_entries
  FOR UPDATE TO authenticated
  USING (
    member_id = public.get_team_member_id_for_auth_user(auth.uid())
  )
  WITH CHECK (
    member_id = public.get_team_member_id_for_auth_user(auth.uid())
  );

CREATE POLICY "Owner delete" ON public.standup_entries
  FOR DELETE TO authenticated
  USING (
    member_id = public.get_team_member_id_for_auth_user(auth.uid())
  );

-- Fix 6: retro_items - scope UPDATE/DELETE to owner (allow null member_id for anonymous)
DROP POLICY "Authenticated full access update" ON public.retro_items;
DROP POLICY "Authenticated full access delete" ON public.retro_items;

CREATE POLICY "Owner update" ON public.retro_items
  FOR UPDATE TO authenticated
  USING (
    member_id IS NULL
    OR member_id = public.get_team_member_id_for_auth_user(auth.uid())
  );

CREATE POLICY "Owner delete" ON public.retro_items
  FOR DELETE TO authenticated
  USING (
    member_id IS NULL
    OR member_id = public.get_team_member_id_for_auth_user(auth.uid())
  );
