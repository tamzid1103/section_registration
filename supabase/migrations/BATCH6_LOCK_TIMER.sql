-- ================================================================
-- BATCH 6 ADDITIONS — Semester lock + reminder timer settings
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1) Semester lock fields
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS auto_lock_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_semesters_auto_lock_at
  ON semesters(auto_lock_at)
  WHERE auto_lock_at IS NOT NULL AND is_locked = FALSE;

-- 2) Global reminder timer settings (singleton row: id=1)
CREATE TABLE IF NOT EXISTS system_settings (
  id                    SMALLINT PRIMARY KEY CHECK (id = 1),
  timer_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  registration_start_at TIMESTAMP WITH TIME ZONE,
  registration_end_at   TIMESTAMP WITH TIME ZONE,
  timezone              TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  updated_by            UUID REFERENCES auth.users(id),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (id, timer_enabled, timezone)
VALUES (1, FALSE, 'Asia/Dhaka')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read system settings" ON system_settings;
CREATE POLICY "Public read system settings"
  ON system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manages system settings" ON system_settings;
CREATE POLICY "Admin manages system settings"
  ON system_settings FOR ALL TO authenticated
  USING (auth_user_role() IN ('admin', 'developer'))
  WITH CHECK (auth_user_role() IN ('admin', 'developer'));

-- 3) CR/student write lock on registrations when semester is locked
CREATE OR REPLACE FUNCTION prevent_locked_semester_registration_changes()
RETURNS TRIGGER AS $$
DECLARE
  role_text TEXT;
  section_to_check UUID;
  semester_locked BOOLEAN;
BEGIN
  IF auth.role() = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  role_text := COALESCE(auth_user_role(), '');

  -- Admin/developer/advisor are allowed even when locked.
  IF role_text IN ('admin', 'developer', 'advisor') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  section_to_check := CASE WHEN TG_OP = 'DELETE' THEN OLD.section_id ELSE NEW.section_id END;
  IF section_to_check IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT sem.is_locked
  INTO semester_locked
  FROM sections sec
  JOIN semesters sem ON sem.id = sec.semester_id
  WHERE sec.id = section_to_check;

  IF COALESCE(semester_locked, FALSE) THEN
    RAISE EXCEPTION 'semester_locked: this semester is locked for CR/student updates';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_locked_semester_registration_changes ON registrations;
CREATE TRIGGER trg_prevent_locked_semester_registration_changes
BEFORE INSERT OR UPDATE OR DELETE ON registrations
FOR EACH ROW EXECUTE FUNCTION prevent_locked_semester_registration_changes();

SELECT 'Batch 6 lock + timer additions applied successfully.' AS status;
