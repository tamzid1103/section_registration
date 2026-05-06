-- 1. Create a table for CR applications
CREATE TABLE IF NOT EXISTS cr_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    full_name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    section_interested TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES auth.users(id)
);

-- 2. Add RLS for CR applications
ALTER TABLE cr_applications ENABLE ROW LEVEL SECURITY;

-- Students can read their own applications
CREATE POLICY "Students can view own application" 
ON cr_applications FOR SELECT 
USING (auth.uid() = user_id);

-- Students can insert their own application
CREATE POLICY "Students can apply once" 
ON cr_applications FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "Admins full access on applications" 
ON cr_applications ALL 
USING (
    EXISTS (
        SELECT 1 FROM authorized_staff 
        WHERE email = auth.jwt()->>'email' AND role = 'admin'
    )
);

-- 3. Create a logic to auto-insert into authorized_staff on approval
-- (We'll handle this via a Supabase Edge Function or a Postgres Trigger later, 
--  but for now, we'll build the Admin UI to handle the transition)
