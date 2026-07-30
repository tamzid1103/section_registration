-- ────────────────────────────────────────────────────────────
-- BATCH 7: STUDENT PORTAL AND ELIGIBLE STUDENTS
-- ────────────────────────────────────────────────────────────

-- 1. Create allowed_students table
CREATE TABLE IF NOT EXISTS allowed_students (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on allowed_students
ALTER TABLE allowed_students ENABLE ROW LEVEL SECURITY;

-- 2. Update role constraint for authorized_staff to allow 'student'
ALTER TABLE authorized_staff DROP CONSTRAINT IF EXISTS authorized_staff_role_check;
ALTER TABLE authorized_staff ADD CONSTRAINT authorized_staff_role_check CHECK (role IN ('cr', 'advisor', 'admin', 'developer', 'student'));

-- 3. Add student_edit_count to registrations table
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS student_edit_count INTEGER DEFAULT 0;

-- 4. Update auth_user_role() function to detect student role from allowed_students table
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    staff_role TEXT;
    is_student BOOLEAN;
BEGIN
    -- Check authorized_staff first (cr, advisor, admin, developer)
    SELECT role INTO staff_role FROM authorized_staff WHERE LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', '')) LIMIT 1;
    IF staff_role IS NOT NULL THEN
        RETURN staff_role;
    END IF;

    -- Check allowed_students for student role
    SELECT EXISTS (
        SELECT 1 FROM allowed_students WHERE LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', ''))
    ) INTO is_student;

    IF is_student THEN
        RETURN 'student';
    END IF;

    RETURN NULL;
END;
$$;

-- 5. Set up policies for allowed_students
DROP POLICY IF EXISTS "Public read allowed_students" ON allowed_students;
CREATE POLICY "Public read allowed_students"
  ON allowed_students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manages allowed_students" ON allowed_students;
CREATE POLICY "Admin manages allowed_students"
  ON allowed_students FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

-- 6. Update registrations policies to allow student self-registration and edits
DROP POLICY IF EXISTS "CR inserts registrations" ON registrations;
CREATE POLICY "CR inserts registrations"
  ON registrations FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() IN ('cr', 'admin', 'developer')
    OR (
      (auth_user_role() = 'student' OR LOWER(auth.jwt()->>'email') IN (SELECT LOWER(email) FROM allowed_students))
      AND student_id = (SELECT student_id FROM allowed_students WHERE LOWER(email) = LOWER(auth.jwt()->>'email') LIMIT 1)
    )
  );

DROP POLICY IF EXISTS "CR updates registrations" ON registrations;
CREATE POLICY "CR updates registrations"
  ON registrations FOR UPDATE TO authenticated
  USING (
    auth_user_role() IN ('cr', 'advisor', 'admin', 'developer')
    OR (
      (auth_user_role() = 'student' OR LOWER(auth.jwt()->>'email') IN (SELECT LOWER(email) FROM allowed_students))
      AND student_id = (SELECT student_id FROM allowed_students WHERE LOWER(email) = LOWER(auth.jwt()->>'email') LIMIT 1)
      AND COALESCE(student_edit_count, 0) < 3
      AND COALESCE(advisor_completed, false) = false
    )
  )
  WITH CHECK (
    auth_user_role() IN ('cr', 'advisor', 'admin', 'developer')
    OR (
      (auth_user_role() = 'student' OR LOWER(auth.jwt()->>'email') IN (SELECT LOWER(email) FROM allowed_students))
      AND student_id = (SELECT student_id FROM allowed_students WHERE LOWER(email) = LOWER(auth.jwt()->>'email') LIMIT 1)
      AND COALESCE(student_edit_count, 0) <= 3
      AND COALESCE(advisor_completed, false) = false
    )
  );

DROP POLICY IF EXISTS "CR deletes registrations" ON registrations;
CREATE POLICY "CR deletes registrations"
  ON registrations FOR DELETE TO authenticated
  USING (
    auth_user_role() IN ('cr', 'admin', 'developer')
    OR (
      (auth_user_role() = 'student' OR LOWER(auth.jwt()->>'email') IN (SELECT LOWER(email) FROM allowed_students))
      AND student_id = (SELECT student_id FROM allowed_students WHERE LOWER(email) = LOWER(auth.jwt()->>'email') LIMIT 1)
    )
  );
