-- ────────────────────────────────────────────────────────────
-- BATCH 10: LAB GROUP CAPACITY (25) & SECTION CAPACITY (50) ENFORCEMENT
-- Enforce limits on both INSERT and UPDATE of registrations
-- ────────────────────────────────────────────────────────────

-- 1. Section capacity enforcement function
CREATE OR REPLACE FUNCTION check_section_capacity()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_capacity  INTEGER;
BEGIN
    IF NEW.section_id IS NULL THEN RETURN NEW; END IF;

    -- Count existing students registered in this section (excluding self on update)
    SELECT COUNT(*) INTO current_count
    FROM registrations 
    WHERE section_id = NEW.section_id
      AND (TG_OP = 'INSERT' OR id != NEW.id);

    SELECT capacity INTO max_capacity
    FROM sections WHERE id = NEW.section_id;

    IF max_capacity IS NULL THEN
        max_capacity := 50;
    END IF;

    IF current_count >= max_capacity THEN
        RAISE EXCEPTION 'Section is full. % of % seats are taken.', current_count, max_capacity;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_section_capacity ON registrations;
CREATE TRIGGER enforce_section_capacity
BEFORE INSERT OR UPDATE OF section_id ON registrations
FOR EACH ROW EXECUTE FUNCTION check_section_capacity();

-- 2. Lab group capacity enforcement function (25 seats per lab group)
CREATE OR REPLACE FUNCTION check_lab_group_capacity()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_capacity  INTEGER;
BEGIN
    IF NEW.lab_group_id IS NULL THEN RETURN NEW; END IF;

    -- Count existing students registered in this lab group (excluding self on update)
    SELECT COUNT(*) INTO current_count
    FROM registrations 
    WHERE lab_group_id = NEW.lab_group_id
      AND (TG_OP = 'INSERT' OR id != NEW.id);

    SELECT capacity INTO max_capacity
    FROM lab_groups WHERE id = NEW.lab_group_id;

    IF max_capacity IS NULL THEN
        max_capacity := 25;
    END IF;

    IF current_count >= max_capacity THEN
        RAISE EXCEPTION 'Lab group is full. % of % seats are taken.', current_count, max_capacity;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_lab_group_capacity ON registrations;
CREATE TRIGGER enforce_lab_group_capacity
BEFORE INSERT OR UPDATE OF lab_group_id, section_id ON registrations
FOR EACH ROW EXECUTE FUNCTION check_lab_group_capacity();

-- 3. Ensure student_advisor_ranges semester_id is optional / nullable
ALTER TABLE student_advisor_ranges ALTER COLUMN semester_id DROP NOT NULL;
