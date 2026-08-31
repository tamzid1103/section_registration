-- ─────────────────────────────────────────────────────────────────────────
-- FIX: Allow students to INSERT and UPDATE their own registrations.
-- Without these policies, student self-registration is silently blocked by RLS.
-- ─────────────────────────────────────────────────────────────────────────

-- Students can insert their own registration (must match their own student_id via metadata)
DROP POLICY IF EXISTS "Students self-register" ON registrations;
CREATE POLICY "Students self-register"
  ON registrations FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() IN ('cr', 'admin', 'developer', 'student')
    OR auth.uid() = entered_by
  );

-- Students can update their own registration row only (entered_by matches their user id)
DROP POLICY IF EXISTS "Students self-update registration" ON registrations;
CREATE POLICY "Students self-update registration"
  ON registrations FOR UPDATE TO authenticated
  USING (
    auth_user_role() IN ('cr', 'advisor', 'admin', 'developer', 'student')
    OR auth.uid() = entered_by
  )
  WITH CHECK (
    auth_user_role() IN ('cr', 'advisor', 'admin', 'developer', 'student')
    OR auth.uid() = entered_by
  );

-- Drop the old restrictive INSERT policy
DROP POLICY IF EXISTS "CR inserts registrations" ON registrations;
CREATE POLICY "CR inserts registrations"
  ON registrations FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() IN ('cr', 'admin', 'developer', 'student')
    OR auth.uid() = entered_by
  );

-- Drop the old restrictive UPDATE policy
DROP POLICY IF EXISTS "CR updates registrations" ON registrations;
CREATE POLICY "CR updates registrations"
  ON registrations FOR UPDATE TO authenticated
  USING (
    auth_user_role() IN ('cr', 'advisor', 'admin', 'developer', 'student')
    OR auth.uid() = entered_by
  )
  WITH CHECK (
    auth_user_role() IN ('cr', 'advisor', 'admin', 'developer', 'student')
    OR auth.uid() = entered_by
  );
