-- Table to store authorized personnel (CRs, Advisors, Admins)
CREATE TABLE IF NOT EXISTS authorized_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('cr', 'advisor', 'admin')),
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE authorized_staff ENABLE ROW LEVEL SECURITY;

-- Only Admins can view/edit authorized_staff
CREATE POLICY "Admins can manage staff" ON authorized_staff
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM authorized_staff 
        WHERE email = auth.jwt()->>'email' AND role = 'admin'
    )
);

-- Public view for own record (needed for middleware check)
CREATE POLICY "Users can view own staff record" ON authorized_staff
FOR SELECT TO authenticated
USING (email = auth.jwt()->>'email');
