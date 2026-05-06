/** 
 * SIMPLIFIED SYSTEM SEED DATA (Section-Only Approach)
 * Run this in your Supabase SQL Editor to test the CR and Student Hub.
 */

-- 1. Insert Spring 2026 Semester
INSERT INTO semesters (name, is_active) 
VALUES ('Spring 2026', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- 2. Insert Sections directly (No Courses)
-- We'll use a descriptive naming convention or just numbers
INSERT INTO sections (semester_id, name, capacity)
SELECT s.id, '66_A', 50 FROM semesters s WHERE s.name = 'Spring 2026' LIMIT 1;

INSERT INTO sections (semester_id, name, capacity)
SELECT s.id, '66_B', 50 FROM semesters s WHERE s.name = 'Spring 2026' LIMIT 1;

INSERT INTO sections (semester_id, name, capacity)
SELECT s.id, '66_C', 50 FROM semesters s WHERE s.name = 'Spring 2026' LIMIT 1;

-- 3. Insert Lab Groups for Section 66_A
INSERT INTO lab_groups (section_id, name, capacity)
SELECT id, 'A1', 25 FROM sections WHERE name = '66_A' LIMIT 1;

INSERT INTO lab_groups (section_id, name, capacity)
SELECT id, 'A2', 25 FROM sections WHERE name = '66_A' LIMIT 1;

-- 4. Set up Advisors
INSERT INTO advisors (name, initial, email)
VALUES ('Prof. X', 'PX', 'prof.x@diu.edu.bd')
ON CONFLICT (email) DO NOTHING;

INSERT INTO advisors (name, initial, email)
VALUES ('Dr. Y', 'DY', 'dr.y@diu.edu.bd')
ON CONFLICT (email) DO NOTHING;

-- 5. Set up Advisor Ranges
-- Dr. Y handles IDs ending in 001-060 for 241-15 batch
INSERT INTO student_advisor_ranges (advisor_id, semester_id, start_id, end_id)
SELECT a.id, s.id, '241-15-001', '241-15-060'
FROM advisors a, semesters s 
WHERE a.initial = 'DY' AND s.name = 'Spring 2026' LIMIT 1;

-- Prof. X handles IDs ending in 061-120 for 241-15 batch
INSERT INTO student_advisor_ranges (advisor_id, semester_id, start_id, end_id)
SELECT a.id, s.id, '241-15-061', '241-15-120'
FROM advisors a, semesters s 
WHERE a.initial = 'PX' AND s.name = 'Spring 2026' LIMIT 1;
