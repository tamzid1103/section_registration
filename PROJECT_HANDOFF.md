# DIU Smart Section Pre-Registration & Advisory Management System

## Handoff Purpose
This document captures the full context, decisions, requirements, and implementation plan discussed so far. Use it to continue work in a new chat session or after opening the `section_registration` project folder in VS Code.

---

## Project Goal
Build a production-ready full-stack web application for structured, transparent, realtime student section pre-registration and advisory management for DIU.

Core goals:
- Eliminate section overflow conflicts
- Improve advisor visibility
- Keep strong audit trails for every change
- Provide print-ready and PDF-ready reports
- Enforce university-email-only authentication
- Support realtime updates without page refresh

---

## Confirmed Tech Direction
User said there is no fixed language preference, so the recommended stack is:

- Frontend: Next.js App Router
- UI: Tailwind CSS + shadcn/ui
- Backend/API: Next.js server actions / route handlers where needed
- Database/Auth/Realtime/RLS: Supabase
- Hosting: Free platforms only
- Domain: Existing personal domain, using a subdomain
- Deployment style: Git push auto-deploy

Recommended zero-cost hosting/deployment plan:
- Frontend hosting: Cloudflare Pages
- Database/Auth: Supabase free tier
- DNS + subdomain: Cloudflare DNS
- Version control: GitHub free

Reasoning:
- Cloudflare Pages is free, fast, and does not sleep like some free hosts
- Supabase gives database, auth, realtime, and RLS in one place
- Next.js has strong support for full-stack apps and easy deployment
- shadcn/ui gives a clean, production-level UI with Tailwind

---

## Free Hosting / Subdomain Plan
The user wants the app live for free, using their own domain with a subdomain.

Planned setup:
1. Use Cloudflare as DNS provider for the domain
2. Point a subdomain such as `app.yourdomain.com` to Cloudflare Pages
3. Deploy the Next.js app to Cloudflare Pages from GitHub
4. Store database and auth in Supabase free tier
5. Keep all secrets in environment variables

Important note:
- The user already owns a domain
- DNS access is available through the registrar
- The app should be hosted on a subdomain, not the root domain unless later desired

---

## Roles and Permissions
### 1. Student
- View-only access
- Search by student ID or name
- View selected section, lab group, advisor details
- View live seat status

### 2. CR (Class Representative)
- Add and update student registration preferences
- Required fields: student ID, name, section, lab group
- Mandatory notes/comments for edits
- Each action logs CR ID, timestamp, and reason note
- Cannot assign a student to multiple sections
- Duplicate entries should be blocked
- User clarified CRs can edit any student in the system

### 3. Advisor
- Default access is view-only like a student
- After login, can mark students as:
  - Completed
  - Pending
- View assigned students and their registration details
- Activity logs should be recorded
- User clarified advisors are view-only plus status updates only, not section editing
- Advisor assignment is based on student ID range mapping

### 4. Admin
- Create and manage semesters
- Create and manage sections
- Manage lab groups
- Add and remove advisors
- Approve/reject CR accounts
- View logs, conflicts, duplicates, and overflow warnings
- Full operational control panel

### 5. Developer / Super Admin
- Highest authority
- Two default developer accounts seeded in the database
- Only developers can grant or revoke developer access
- Can manage roles, system configuration, feature toggles, backup/restore, and safe database viewing
- Not publicly assignable

---

## Functional Requirements
### Dashboard
- Semester selector
- Section overview
- Total seats, filled seats, remaining seats
- Color coding:
  - Green: under 70 percent
  - Yellow: 70 to 90 percent
  - Red: above 90 percent

### Section and Lab Rules
- Each section max capacity: 50 students
- Each section has 2 lab groups
- Each lab group max capacity: 25 students
- Lab groups are explicitly assigned by CR/Admin

### Advisor Directory
- Advisor cards with:
  - Name
  - Designation
  - Initial
  - Contact number
  - Email
  - Cabin number
- Clicking an advisor expands to show the assigned student list

### Notes and Audit System
- Every CR update must include a note
- Store action type, user, timestamp, and note
- Visible in admin dashboard

### Search System
- Search by student ID or name
- Return section, lab group, advisor, and status

### Print and Export
- Section-wise student list
- Advisor-wise student list
- Full advisor directory
- Individual advisor student list
- Optional dashboard summary
- Use print and PDF export libraries such as `react-to-print` or `jspdf`

### Themes
- Light mode
- Dark mode
- DIU custom theme
- DIU theme should be balanced, elegant, and academic

---

## Database Plan
The schema should be detailed and include relationships, indexes, and constraints.

Planned tables:
- users
- semesters
- sections
- lab_groups
- registrations
- advisors
- student_advisor_map
- advisor_activity_logs
- audit_logs
- cr_accounts
- system_config

Updated additions discussed:
- `registrations`
  - id
  - student_id
  - section_id
  - lab_group_id
  - entered_by (CR ID)
  - note
  - timestamp

- `advisor_activity_logs`
  - id
  - advisor_id
  - student_id
  - status
  - timestamp

- `audit_logs`
  - id
  - user_id
  - role
  - action
  - note
  - timestamp

Important constraints:
- One student can only have one section registration
- Prevent lab overflow above 25
- Prevent section overflow above 50
- Enforce domain-restricted login
- Use RLS heavily at the database level

---

## Authentication Rules
Only allow email domains:
- `@diu.edu.bd`
- `@daffodilvarsity.edu.bd`

Authentication should be handled by Supabase Auth.

Planned behavior:
- Restrict login to university email domains
- Use RLS and role-based route protection
- Seed developer accounts manually in the database
- Derive role from database/custom claims

---

## Advisor Assignment Rule
User clarified:
- When admin creates an advisor, the advisor gets a student ID serial range
- Example: `241-15-001` to `241-15-060`
- When CR enters a student name and ID, the system should check which range the ID falls under and assign the corresponding advisor automatically

This means advisor assignment is range-based, not manual per student.

---

## Duplicate Strategy
Confirmed behavior:
- Duplicate entries should be blocked
- One student cannot be assigned to multiple sections
- The system should fail safely and show a useful error message

---

## Realtime Requirement
Confirmed priority:
- Full realtime updates using Supabase Realtime subscriptions
- Dashboard and admin views should update live
- No manual refresh dependency for main status views

---

## UI / UX Direction
User has no fixed library preference, so the plan is:
- Use shadcn/ui for a high quality production look
- Use Tailwind CSS for styling
- Build a clean, modern, academic, and responsive interface
- Avoid generic or bland layouts
- Keep accessibility in mind from the start

---

## Implementation Phases
### Phase 0: Pre-development setup
- Create GitHub repo
- Set up Supabase project
- Set up Cloudflare Pages
- Set up domain and subdomain
- Initialize Next.js project
- Configure environment variables

### Phase 1: Foundation
- Database schema
- Auth
- RLS
- Services layer
- Base layout and route structure

### Phase 2: Core UI
- Student dashboard
- CR panel
- Advisor dashboard
- Admin dashboard
- Developer config panel
- Advisor directory page

### Phase 3: Realtime and export
- Supabase Realtime subscriptions
- Print and PDF export
- Audit log viewer

### Phase 4: Theme and polish
- Light/Dark/DIU theme switcher
- Accessibility improvements
- UX polish

### Phase 5: Testing and deployment
- Unit tests
- Component tests
- Playwright E2E tests
- Deployment to free platforms

---

## Suggested File / Folder Structure
- `src/app/`
- `src/components/`
- `src/lib/`
- `src/hooks/`
- `src/services/`
- `src/types/`
- `src/config/`
- `supabase/migrations/`
- `e2e/`
- `__tests__/`

Important key files planned:
- `src/lib/supabase.ts`
- `src/middleware.ts`
- `src/hooks/useAuth.ts`
- `src/hooks/useRealtime.ts`
- `src/services/registration.service.ts`
- `src/services/advisor.service.ts`
- `src/services/audit.service.ts`
- `src/services/config.service.ts`
- `src/app/dashboard/page.tsx`
- `src/app/cr/register/page.tsx`
- `src/app/advisor/dashboard/page.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/developer/config/page.tsx`
- `src/app/directory/page.tsx`

---

## Setup Notes from the Chat
- The user’s local folder is `F:/practicewebsite/section_registration`
- Node.js is installed at `D:\Node JS`
- `node --version` worked in PowerShell and returned `v24.15.0`
- `npm` / `npx` were not initially available in the VS Code terminal until PATH/session restart issues were addressed
- The correct project folder should be opened as a VS Code workspace
- The chat history itself does not automatically transfer across separate workspace sessions, so this file is intended as the handoff record

---

## Recommended Next Steps
1. Open the `section_registration` folder as the VS Code workspace
2. Create the Next.js project inside that folder
3. Set up Git and GitHub
4. Create Supabase project and schema
5. Connect Cloudflare Pages and the custom subdomain

---

## Current Status
- Planning is complete
- Project direction is decided
- Free hosting path is chosen
- A workspace handoff file has been created
- Ready to start implementation in the project folder
