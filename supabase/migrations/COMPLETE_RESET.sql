-- ============================================================
-- DIU SMART SECTION PRE-REGISTRATION: COMPLETE RESET SCHEMA
-- Run this entire file in the Supabase SQL Editor.
-- This drops everything and rebuilds cleanly.
-- ============================================================

-- STEP 1: Drop existing objects (order matters for FKs)
DROP VIEW IF EXISTS cr_registration_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS student_advisor_ranges CASCADE;
DROP TABLE IF EXISTS lab_groups CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS advisors CASCADE;
DROP TABLE IF EXISTS semesters CASCADE;
DROP TABLE IF EXISTS cr_applications CASCADE;
DROP TABLE IF EXISTS authorized_staff CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS advisor_activity_logs CASCADE;
DROP FUNCTION IF EXISTS public.normalize_student_id(text) CASCADE;
DROP FUNCTION IF EXISTS update_advisor_range_numerics() CASCADE;
DROP FUNCTION IF EXISTS auth_user_role() CASCADE;

-- STEP 2: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- STEP 3: Core tables

CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(semester_id, name)
);

CREATE TABLE lab_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(section_id, name)
);

-- Admin creates advisors (the master list). Email must match for auto-approval.
CREATE TABLE advisors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  designation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE student_advisor_ranges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advisor_id UUID REFERENCES advisors(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
  start_id TEXT NOT NULL,
  end_id TEXT NOT NULL,
  start_id_numeric BIGINT,
  end_id_numeric BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Authorized staff: CRs, Advisors, Admins, Developers with system access
CREATE TABLE authorized_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('cr', 'advisor', 'admin', 'developer')),
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cr_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  section_interested TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id)
);

-- entered_by references authorized_staff so we can join for logs
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id TEXT NOT NULL UNIQUE,
  student_name TEXT NOT NULL,
  section_id UUID REFERENCES sections(id),
  lab_group_id UUID REFERENCES lab_groups(id),
  advisor_id UUID REFERENCES advisors(id),
  entered_by UUID REFERENCES authorized_staff(id),
  note TEXT NOT NULL DEFAULT '',
  advisor_completed BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 4: Normalize student ID function (for advisor range matching)
CREATE OR REPLACE FUNCTION public.normalize_student_id(dashed_id text)
RETURNS bigint AS $$
BEGIN
    RETURN REPLACE(dashed_id, '-', '')::bigint;
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION update_advisor_range_numerics()
RETURNS TRIGGER AS $$
BEGIN
    NEW.start_id_numeric := public.normalize_student_id(NEW.start_id);
    NEW.end_id_numeric := public.normalize_student_id(NEW.end_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_advisor_range_numerics
BEFORE INSERT OR UPDATE ON student_advisor_ranges
FOR EACH ROW EXECUTE FUNCTION update_advisor_range_numerics();

-- Helper function to get current user's role (avoids recursive RLS)
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM authorized_staff WHERE email = auth.jwt()->>'email' LIMIT 1;
$$;

-- STEP 5: Enable RLS
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_advisor_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE cr_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- STEP 6: RLS Policies

-- Public read (needed for home page without login)
CREATE POLICY "Public read semesters"    ON semesters    FOR SELECT USING (true);
CREATE POLICY "Public read sections"     ON sections     FOR SELECT USING (true);
CREATE POLICY "Public read lab_groups"   ON lab_groups   FOR SELECT USING (true);
CREATE POLICY "Public read advisors"     ON advisors     FOR SELECT USING (true);
CREATE POLICY "Public read registrations" ON registrations FOR SELECT USING (true);
CREATE POLICY "Public read advisor_ranges" ON student_advisor_ranges FOR SELECT USING (true);

-- authorized_staff: user can read own record (base case, no recursion)
CREATE POLICY "Own staff record" ON authorized_staff
  FOR SELECT TO authenticated
  USING (email = auth.jwt()->>'email');

-- authorized_staff: admin/developer full control
CREATE POLICY "Admin manages staff" ON authorized_staff
  FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

-- cr_applications: user manages own
CREATE POLICY "Own CR application select" ON cr_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Own CR application insert" ON cr_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin manages CR applications" ON cr_applications
  FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

-- registrations: CR/admin/developer can insert and update
CREATE POLICY "CR inserts registrations" ON registrations
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('cr', 'admin', 'developer'));

CREATE POLICY "CR updates registrations" ON registrations
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('cr', 'advisor', 'admin', 'developer'));

CREATE POLICY "Admin deletes registrations" ON registrations
  FOR DELETE TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

-- semesters, sections, lab_groups, advisors: admin/dev manage
CREATE POLICY "Admin manages semesters" ON semesters
  FOR ALL TO authenticated USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Admin manages sections" ON sections
  FOR ALL TO authenticated USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Admin manages lab_groups" ON lab_groups
  FOR ALL TO authenticated USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Admin manages advisors" ON advisors
  FOR ALL TO authenticated USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Admin manages advisor_ranges" ON student_advisor_ranges
  FOR ALL TO authenticated USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Admin reads audit_logs" ON audit_logs
  FOR SELECT TO authenticated USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Insert audit_logs" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- STEP 7: Registration logs view
CREATE OR REPLACE VIEW cr_registration_logs AS
SELECT
  r.id,
  r.student_id,
  r.student_name,
  s.name AS section_name,
  sem.name AS semester_name,
  stf.name AS cr_name,
  stf.email AS cr_email,
  r.note,
  r.advisor_completed,
  r.timestamp AS created_at
FROM registrations r
LEFT JOIN sections s ON r.section_id = s.id
LEFT JOIN semesters sem ON s.semester_id = sem.id
LEFT JOIN authorized_staff stf ON r.entered_by = stf.id;

-- STEP 8: Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE sections;
ALTER PUBLICATION supabase_realtime ADD TABLE semesters;
