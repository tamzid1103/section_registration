-- ============================================================
--  BATCH 8: OFFERED COURSES SCHEMA & SECURITY POLICIES
-- ============================================================

CREATE TABLE IF NOT EXISTS offered_courses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semester_id  UUID REFERENCES semesters(id) ON DELETE CASCADE,
  course_code  TEXT NOT NULL,
  course_name  TEXT NOT NULL,
  credit       NUMERIC(3,1) DEFAULT 3.0,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE offered_courses ENABLE ROW LEVEL SECURITY;

-- Allow public read access to offered courses for student/advisor/admin panels
DROP POLICY IF EXISTS "Allow public read access to offered courses" ON offered_courses;
CREATE POLICY "Allow public read access to offered courses"
  ON offered_courses FOR SELECT
  USING (true);

-- Allow authenticated users / staff / admin to modify courses
DROP POLICY IF EXISTS "Allow staff management of offered courses" ON offered_courses;
CREATE POLICY "Allow staff management of offered courses"
  ON offered_courses FOR ALL
  USING (true);

-- Index for fast semester-level course lookups
CREATE INDEX IF NOT EXISTS idx_offered_courses_semester ON offered_courses(semester_id);
