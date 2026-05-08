-- ================================================================
-- BATCH 3 ADDITIONS — Run this in Supabase SQL Editor
-- This fixes the issue of late advisor assignments.
-- ================================================================

-- 1. Create the auto-assign function
CREATE OR REPLACE FUNCTION auto_assign_advisor_to_existing_registrations()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE registrations
    SET advisor_id = NEW.advisor_id
    WHERE public.normalize_student_id(student_id) >= NEW.start_id_numeric
      AND public.normalize_student_id(student_id) <= NEW.end_id_numeric;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the trigger to student_advisor_ranges
DROP TRIGGER IF EXISTS trg_auto_assign_advisor ON student_advisor_ranges;
CREATE TRIGGER trg_auto_assign_advisor
AFTER INSERT OR UPDATE ON student_advisor_ranges
FOR EACH ROW EXECUTE FUNCTION auto_assign_advisor_to_existing_registrations();

-- 3. IMMEDIATELY update all existing registrations that are missing an advisor
-- (This runs once right now to fix the students you already added)
UPDATE registrations r
SET advisor_id = a.advisor_id
FROM student_advisor_ranges a
WHERE r.advisor_id IS NULL
  AND public.normalize_student_id(r.student_id) >= a.start_id_numeric
  AND public.normalize_student_id(r.student_id) <= a.end_id_numeric;

SELECT 'Batch 3 additions applied and existing students updated successfully.' AS status;
