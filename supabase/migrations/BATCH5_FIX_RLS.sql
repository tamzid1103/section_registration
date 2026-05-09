-- Add this policy to allow Advisors to view approved CR applications
CREATE POLICY "Advisors can view approved CRs"
  ON cr_applications FOR SELECT TO authenticated
  USING (
    status = 'approved' AND auth_user_role() IN ('advisor', 'admin', 'developer')
  );
