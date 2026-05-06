-- DIU Smart Section Pre-Registration Schema

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Semesters Table
create table semesters (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique, -- e.g., 'Summer 26'
  is_active boolean default false,
  created_at timestamp with time zone default now()
);

-- 3. Sections Table
create table sections (
  id uuid primary key default uuid_generate_v4(),
  semester_id uuid references semesters(id) on delete cascade,
  name text not null, -- e.g., '66_A'
  capacity integer default 50,
  created_at timestamp with time zone default now(),
  unique(semester_id, name)
);

-- 4. Lab Groups Table
create table lab_groups (
  id uuid primary key default uuid_generate_v4(),
  section_id uuid references sections(id) on delete cascade,
  name text not null, -- e.g., 'A1', 'A2'
  capacity integer default 25,
  created_at timestamp with time zone default now(),
  unique(section_id, name)
);

-- 5. Advisors Table
create table advisors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  designation text,
  initial text not null unique,
  contact_number text,
  email text not null unique,
  cabin_number text,
  created_at timestamp with time zone default now()
);

-- 6. Student Advisor Ranges Table
create table student_advisor_ranges (
  id uuid primary key default uuid_generate_v4(),
  advisor_id uuid references advisors(id) on delete cascade,
  semester_id uuid references semesters(id) on delete cascade,
  start_id text not null, -- e.g., '241-15-001'
  end_id text not null,   -- e.g., '241-15-060'
  created_at timestamp with time zone default now()
);

-- 7. Registrations Table
create table registrations (
  id uuid primary key default uuid_generate_v4(),
  student_id text not null unique, -- One student, one registration
  student_name text not null,
  section_id uuid references sections(id),
  lab_group_id uuid references lab_groups(id),
  advisor_id uuid references advisors(id), -- Auto-assigned
  entered_by uuid references auth.users(id), -- CR who entered it
  note text not null,
  timestamp timestamp with time zone default now()
);

-- 8. Advisor Activity Logs
create table advisor_activity_logs (
  id uuid primary key default uuid_generate_v4(),
  advisor_id uuid references advisors(id),
  student_id text not null,
  status text check (status in ('completed', 'pending')),
  timestamp timestamp with time zone default now()
);

-- 9. Audit Logs
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  role text not null,
  action text not null,
  note text,
  timestamp timestamp with time zone default now()
);

-- 10. User Roles (Custom Table for Role Management)
create table user_roles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'cr', 'advisor', 'admin', 'developer')),
  created_at timestamp with time zone default now()
);

-- Add Realtime
alter publication supabase_realtime add table registrations;
alter publication supabase_realtime add table sections;
alter publication supabase_realtime add table lab_groups;
