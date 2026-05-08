-- ============================================================
--  DIU SMART SECTION PRE-REGISTRATION SYSTEM
--  SAMPLE DATA — For Testing and Demo Purposes
--
--  HOW TO USE:
--  Run this AFTER SCHEMA.sql has been applied.
--  This creates a sample semester, sections with lab groups,
--  and two sample advisors with student ID ranges.
--
--  NOTE: Developer accounts (tamzid.social@gmail.com and
--  tamjidul2003@gmail.com) are created via the API route,
--  not SQL, because they require Supabase Auth entries.
--  Visit /api/setup/seed-developers once after deployment.
-- ============================================================


-- ── 1. Active Semester ───────────────────────────────────────

INSERT INTO semesters (name, is_active)
VALUES ('Summer 2026', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;


-- ── 2. Sections (capacity fixed at 50 by schema default) ────

INSERT INTO sections (semester_id, name, capacity)
SELECT s.id, sec.name, 50
FROM semesters s,
     (VALUES ('66_A'), ('66_B'), ('66_C'), ('66_D'), ('66_E'), ('66_F'), ('66_G')) AS sec(name)
WHERE s.name = 'Summer 2026'
ON CONFLICT (semester_id, name) DO NOTHING;


-- ── 3. Lab Groups (auto-created; 2 per section, 25 seats each)

DO $$
DECLARE
    sec RECORD;
BEGIN
    FOR sec IN SELECT id, name FROM sections LOOP
        INSERT INTO lab_groups (section_id, name, capacity)
        VALUES
            (sec.id, sec.name || '1', 25),
            (sec.id, sec.name || '2', 25)
        ON CONFLICT (section_id, name) DO NOTHING;
    END LOOP;
END;
$$;


-- ── 4. Sample Advisors ───────────────────────────────────────

INSERT INTO advisors (name, email, phone, designation)
VALUES
  ('Dr. Md. Rafiqul Islam',   'rafiqul@diu.edu.bd', '01711-000001', 'Associate Professor'),
  ('Ms. Nadia Rahman',        'nadia@diu.edu.bd',   '01711-000002', 'Senior Lecturer')
ON CONFLICT (email) DO NOTHING;


-- ── 5. Advisor ID Ranges for Summer 2026 ─────────────────────
-- (start_id_numeric and end_id_numeric are filled by trigger)

INSERT INTO student_advisor_ranges (advisor_id, semester_id, start_id, end_id)
SELECT a.id, s.id, '241-15-001', '241-15-065'
FROM advisors a, semesters s
WHERE a.email = 'rafiqul@diu.edu.bd' AND s.name = 'Summer 2026'
ON CONFLICT DO NOTHING;

INSERT INTO student_advisor_ranges (advisor_id, semester_id, start_id, end_id)
SELECT a.id, s.id, '241-15-066', '241-15-130'
FROM advisors a, semesters s
WHERE a.email = 'nadia@diu.edu.bd' AND s.name = 'Summer 2026'
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- DONE — Sample data loaded.
-- You can now:
--   • Login as developer via /api/setup/seed-developers
--   • Create an Admin account via the Developer Console
--   • Register CRs via /auth/login → Register
--   • Test student search on the home page
-- ────────────────────────────────────────────────────────────
SELECT 'Sample data loaded successfully.' AS status;
