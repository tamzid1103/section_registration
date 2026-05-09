-- ================================================================
-- BATCH 4 ADDITIONS — Run this in Supabase SQL Editor
-- This adds the advisor_note column to registrations.
-- ================================================================

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS advisor_note TEXT;

SELECT 'Batch 4 additions applied successfully.' AS status;
