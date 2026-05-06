-- Migration: Update to handle dash-formatted Student IDs for Batch/Dept/ID

-- 1. Create a function to convert dashed student IDs (e.g. 241-15-XXX) to plain numbers for comparison
CREATE OR REPLACE FUNCTION public.normalize_student_id(dashed_id text)
RETURNS bigint AS $$
BEGIN
    RETURN REPLACE(dashed_id, '-', '')::bigint;
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Add numeric columns to student_advisor_ranges for correct range calculations
ALTER TABLE student_advisor_ranges 
ADD COLUMN start_id_numeric bigint,
ADD COLUMN end_id_numeric bigint;

-- 3. Update existing ranges (if any)
UPDATE student_advisor_ranges 
SET 
  start_id_numeric = public.normalize_student_id(start_id),
  end_id_numeric = public.normalize_student_id(end_id);

-- 4. Create trigger to automatically fill numeric columns on insert/update
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
