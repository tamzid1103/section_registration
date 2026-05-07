-- Update the role check constraint to include 'developer'
ALTER TABLE authorized_staff DROP CONSTRAINT IF EXISTS authorized_staff_role_check;
ALTER TABLE authorized_staff ADD CONSTRAINT authorized_staff_role_check CHECK (role IN ('cr', 'advisor', 'admin', 'developer'));

-- Update the RLS policy to allow developers full control as well
DROP POLICY IF EXISTS "Admins can manage staff" ON authorized_staff;
CREATE POLICY "Staff management policy" ON authorized_staff
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM authorized_staff 
        WHERE email = auth.jwt()->>'email' AND (role = 'admin' OR role = 'developer')
    )
);

-- Seed the initial developer account (Replace with your email)
-- Ideally run this in the SQL Editor
-- INSERT INTO authorized_staff (email, role, name) VALUES ('your-email@diu.edu.bd', 'developer', 'System Developer');
