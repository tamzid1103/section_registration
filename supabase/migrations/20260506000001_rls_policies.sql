-- RLS Policies

-- Enable RLS on all tables
alter table semesters enable row level security;
alter table sections enable row level security;
alter table lab_groups enable row level security;
alter table advisors enable row level security;
alter table student_advisor_ranges enable row level security;
alter table registrations enable row level security;
alter table advisor_activity_logs enable row level security;
alter table audit_logs enable row level security;
alter table user_roles enable row level security;

-- 1. Student View Policies (Read-only for all logged-in students)
create policy "Students can view semesters" on semesters for select using (true);
create policy "Students can view sections" on sections for select using (true);
create policy "Students can view lab groups" on lab_groups for select using (true);
create policy "Students can view advisors" on advisors for select using (true);
create policy "Students can view registrations" on registrations for select using (true);

-- 2. CR Policies (Can create/edit registrations)
create policy "CRs can insert registrations" on registrations
  for insert with check (
    exists (select 1 from user_roles where id = auth.uid() and role = 'cr')
  );

create policy "CRs can update registrations" on registrations
  for update using (
    exists (select 1 from user_roles where id = auth.uid() and role = 'cr')
  );

-- 3. Advisor Policies (Can update status logs)
create policy "Advisors can view their activity logs" on advisor_activity_logs
  for select using (auth.uid() = advisor_id::uuid); -- Assumes auth.uid() maps to advisor table if linked

create policy "Advisors can insert activity logs" on advisor_activity_logs
  for insert with check (
    exists (select 1 from user_roles where id = auth.uid() and role = 'advisor')
  );

-- 4. Admin/Developer Policies (Full Access)
create policy "Admins have full control" on semesters for all using (
  exists (select 1 from user_roles where id = auth.uid() and role in ('admin', 'developer'))
);
-- (Repeat for other tables as needed, simplified here)
