-- ============================================================
--  DIU SMART SECTION PRE-REGISTRATION SYSTEM
--  COMPLETE DATABASE SCHEMA
--  Version: Final Production
--
--  HOW TO USE:
--  1. Open your Supabase project → SQL Editor
--  2. Paste and run this entire file
--  3. Optionally run SAMPLE_DATA.sql to seed test data
--  4. Visit /api/setup/seed-developers once to create dev accounts
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 1: Clean slate — drop everything in correct FK order
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS enforce_section_capacity   ON registrations;
DROP TRIGGER IF EXISTS enforce_lab_group_capacity ON registrations;
DROP TRIGGER IF EXISTS trg_update_advisor_range_numerics ON student_advisor_ranges;

DROP FUNCTION IF EXISTS check_section_capacity()          CASCADE;
DROP FUNCTION IF EXISTS check_lab_group_capacity()        CASCADE;
DROP FUNCTION IF EXISTS update_advisor_range_numerics()   CASCADE;
DROP FUNCTION IF EXISTS public.normalize_student_id(text) CASCADE;
DROP FUNCTION IF EXISTS auth_user_role()                  CASCADE;

DROP VIEW IF EXISTS cr_registration_logs CASCADE;

DROP TABLE IF EXISTS audit_logs             CASCADE;
DROP TABLE IF EXISTS registrations          CASCADE;
DROP TABLE IF EXISTS student_advisor_ranges CASCADE;
DROP TABLE IF EXISTS lab_groups             CASCADE;
DROP TABLE IF EXISTS sections               CASCADE;
DROP TABLE IF EXISTS advisors               CASCADE;
DROP TABLE IF EXISTS semesters              CASCADE;
DROP TABLE IF EXISTS cr_applications        CASCADE;
DROP TABLE IF EXISTS authorized_staff       CASCADE;
DROP TABLE IF EXISTS user_roles             CASCADE;
DROP TABLE IF EXISTS advisor_activity_logs  CASCADE;


-- ────────────────────────────────────────────────────────────
-- STEP 2: Extensions
-- ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ────────────────────────────────────────────────────────────
-- STEP 3: Core Tables
-- ────────────────────────────────────────────────────────────

-- Semesters (e.g. "Summer 2026")
CREATE TABLE semesters (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sections within a semester (e.g. "66_A")
-- Capacity is fixed at 50 and enforced by DB trigger
CREATE TABLE sections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  capacity    INTEGER DEFAULT 50,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(semester_id, name)
);

-- Lab groups under each section (e.g. "66_A1", "66_A2")
-- Capacity is fixed at 25 and enforced by DB trigger
CREATE TABLE lab_groups (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  capacity   INTEGER DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(section_id, name)
);

-- Advisor master list (created by admin)
-- When an advisor registers with this email, their account is auto-approved
CREATE TABLE advisors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  phone       TEXT,
  designation TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ID ranges that each advisor is responsible for per semester
-- Numeric columns are auto-populated by trigger for range lookups
CREATE TABLE student_advisor_ranges (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advisor_id        UUID REFERENCES advisors(id) ON DELETE CASCADE,
  semester_id       UUID REFERENCES semesters(id) ON DELETE CASCADE,
  start_id          TEXT NOT NULL,          -- e.g. "241-15-001"
  end_id            TEXT NOT NULL,          -- e.g. "241-15-065"
  start_id_numeric  BIGINT,                 -- auto-computed by trigger
  end_id_numeric    BIGINT,                 -- auto-computed by trigger
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unified role table: CRs, Advisors, Admins, Developers
-- All portal access is governed through this table
CREATE TABLE authorized_staff (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('cr', 'advisor', 'admin', 'developer')),
  name       TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CR registration requests (status=pending until admin approves)
CREATE TABLE cr_applications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES auth.users(id),
  full_name         TEXT NOT NULL,
  student_id        TEXT NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  section_interested TEXT NOT NULL,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  applied_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at      TIMESTAMP WITH TIME ZONE,
  processed_by      UUID REFERENCES auth.users(id)
);

-- Student registration entries (one per student globally)
-- entered_by references authorized_staff for CR name lookup
CREATE TABLE registrations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       TEXT NOT NULL UNIQUE,
  student_name     TEXT NOT NULL,
  section_id       UUID REFERENCES sections(id),
  lab_group_id     UUID REFERENCES lab_groups(id),
  advisor_id       UUID REFERENCES advisors(id),
  entered_by       UUID REFERENCES authorized_staff(id),
  note             TEXT NOT NULL DEFAULT '',
  advisor_completed BOOLEAN DEFAULT FALSE,
  timestamp        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Change history for all CR add/edit/delete actions
CREATE TABLE audit_logs (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID REFERENCES auth.users(id),
  role      TEXT NOT NULL,
  action    TEXT NOT NULL,         -- 'ADD', 'EDIT', 'DELETE'
  note      TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────
-- STEP 4: Helper Functions
-- ────────────────────────────────────────────────────────────

-- Strip dashes from student IDs for numeric range comparison
-- e.g. "241-15-001" → 24115001
CREATE OR REPLACE FUNCTION public.normalize_student_id(dashed_id TEXT)
RETURNS BIGINT AS $$
BEGIN
    RETURN REPLACE(dashed_id, '-', '')::BIGINT;
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-populate numeric columns when an advisor range is saved
CREATE OR REPLACE FUNCTION update_advisor_range_numerics()
RETURNS TRIGGER AS $$
BEGIN
    NEW.start_id_numeric := public.normalize_student_id(NEW.start_id);
    NEW.end_id_numeric   := public.normalize_student_id(NEW.end_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_advisor_range_numerics
BEFORE INSERT OR UPDATE ON student_advisor_ranges
FOR EACH ROW EXECUTE FUNCTION update_advisor_range_numerics();

-- Returns the current user's role without triggering recursive RLS
-- Used inside all RLS policies
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM authorized_staff WHERE email = auth.jwt()->>'email' LIMIT 1;
$$;


-- ────────────────────────────────────────────────────────────
-- STEP 5: Capacity Enforcement Triggers
-- Fixed limits: 50 students/section, 25 students/lab group
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_section_capacity()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_capacity  INTEGER;
BEGIN
    SELECT COUNT(*) INTO current_count
    FROM registrations WHERE section_id = NEW.section_id;

    SELECT capacity INTO max_capacity
    FROM sections WHERE id = NEW.section_id;

    IF current_count >= max_capacity THEN
        RAISE EXCEPTION 'Section is full. % of % seats are taken.', current_count, max_capacity;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_section_capacity
BEFORE INSERT ON registrations
FOR EACH ROW EXECUTE FUNCTION check_section_capacity();

CREATE OR REPLACE FUNCTION check_lab_group_capacity()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_capacity  INTEGER;
BEGIN
    IF NEW.lab_group_id IS NULL THEN RETURN NEW; END IF;

    SELECT COUNT(*) INTO current_count
    FROM registrations WHERE lab_group_id = NEW.lab_group_id;

    SELECT capacity INTO max_capacity
    FROM lab_groups WHERE id = NEW.lab_group_id;

    IF current_count >= max_capacity THEN
        RAISE EXCEPTION 'Lab group is full. % of % seats are taken.', current_count, max_capacity;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_lab_group_capacity
BEFORE INSERT ON registrations
FOR EACH ROW EXECUTE FUNCTION check_lab_group_capacity();


-- ────────────────────────────────────────────────────────────
-- STEP 6: Row Level Security
-- ────────────────────────────────────────────────────────────

ALTER TABLE semesters             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections              ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_advisor_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_staff      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cr_applications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- ── Public read (home page, no login required) ───────────────
CREATE POLICY "Public read semesters"
  ON semesters FOR SELECT USING (true);

CREATE POLICY "Public read sections"
  ON sections FOR SELECT USING (true);

CREATE POLICY "Public read lab_groups"
  ON lab_groups FOR SELECT USING (true);

CREATE POLICY "Public read advisors"
  ON advisors FOR SELECT USING (true);

CREATE POLICY "Public read registrations"
  ON registrations FOR SELECT USING (true);

CREATE POLICY "Public read advisor_ranges"
  ON student_advisor_ranges FOR SELECT USING (true);

-- ── authorized_staff ─────────────────────────────────────────
-- Every authenticated user can read their own staff record (for role lookup)
CREATE POLICY "Own staff record"
  ON authorized_staff FOR SELECT TO authenticated
  USING (email = auth.jwt()->>'email');

-- Admins and developers have full control over all staff records
CREATE POLICY "Admin manages staff"
  ON authorized_staff FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

-- ── cr_applications ──────────────────────────────────────────
-- A user can only see and insert their own application
CREATE POLICY "Own CR application select"
  ON cr_applications FOR SELECT TO authenticated
  USING (
    email = auth.jwt()->>'email'
    OR auth_user_role() IN ('admin', 'developer')
  );

CREATE POLICY "Own CR application insert"
  ON cr_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins and developers manage all applications (approve / reject)
CREATE POLICY "Admin manages CR applications"
  ON cr_applications FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

-- ── registrations ────────────────────────────────────────────
CREATE POLICY "CR inserts registrations"
  ON registrations FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('cr', 'admin', 'developer'));

CREATE POLICY "CR updates registrations"
  ON registrations FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('cr', 'advisor', 'admin', 'developer'));

CREATE POLICY "CR deletes registrations"
  ON registrations FOR DELETE TO authenticated
  USING (auth_user_role() IN ('cr', 'admin', 'developer'));

-- ── audit_logs ───────────────────────────────────────────────
-- All authenticated staff can write logs; everyone can read them
CREATE POLICY "Staff inserts audit_logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff reads audit_logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (auth_user_role() IN ('cr', 'advisor', 'admin', 'developer'));

-- ── Admin-only tables ────────────────────────────────────────
CREATE POLICY "Admin manages semesters"
  ON semesters FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Admin manages sections"
  ON sections FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Admin manages lab_groups"
  ON lab_groups FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Admin manages advisors"
  ON advisors FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));

CREATE POLICY "Admin manages advisor_ranges"
  ON student_advisor_ranges FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'));


-- ────────────────────────────────────────────────────────────
-- STEP 7: Convenience View
-- cr_registration_logs — easy overview of who registered whom
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW cr_registration_logs AS
SELECT
  r.id,
  r.student_id,
  r.student_name,
  s.name           AS section_name,
  lg.name          AS lab_group_name,
  sem.name         AS semester_name,
  stf.name         AS cr_name,
  stf.email        AS cr_email,
  adv.name         AS advisor_name,
  r.note,
  r.advisor_completed,
  r.timestamp      AS created_at
FROM registrations r
LEFT JOIN sections        s   ON r.section_id    = s.id
LEFT JOIN lab_groups      lg  ON r.lab_group_id  = lg.id
LEFT JOIN semesters       sem ON s.semester_id   = sem.id
LEFT JOIN authorized_staff stf ON r.entered_by   = stf.id
LEFT JOIN advisors        adv ON r.advisor_id    = adv.id;


-- ────────────────────────────────────────────────────────────
-- STEP 8: Realtime Subscriptions
-- ────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE sections;
ALTER PUBLICATION supabase_realtime ADD TABLE semesters;
ALTER PUBLICATION supabase_realtime ADD TABLE cr_applications;


-- ────────────────────────────────────────────────────────────
-- DONE
-- Next steps:
--   1. Run SAMPLE_DATA.sql (optional, for testing)
--   2. Visit /api/setup/seed-developers in your browser once
--      to create the two developer accounts
-- ────────────────────────────────────────────────────────────
SELECT 'Schema created successfully.' AS status;
