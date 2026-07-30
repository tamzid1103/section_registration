import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getFriendlyErrorMessage(message: string): string {
    if (!message) return 'An unexpected error occurred. Please try again.';
    
    const lower = message.toLowerCase();
    
    // RLS violations
    if (lower.includes('row-level security') || lower.includes('rls') || lower.includes('policy')) {
        return 'Access denied: Modification not permitted (limit reached or registration completed by advisor).';
    }
    
    // Unique / Duplicate constraints
    if (lower.includes('unique constraint') || lower.includes('duplicate key') || lower.includes('already exists')) {
        return 'A record with this information already exists in the system.';
    }
    
    // Check constraints
    if (lower.includes('violates check constraint')) {
        if (lower.includes('authorized_staff_role_check')) {
            return 'Invalid user role selected.';
        }
        return 'The input data contains invalid values or format.';
    }

    // Locked semesters
    if (lower.includes('semester_locked') || lower.includes('locked')) {
        return 'This semester is locked. Updates and registrations are disabled.';
    }
    
    // Section full
    if (lower.includes('full') || lower.includes('capacity')) {
        return 'The selected section capacity is full.';
    }

    // Foreign key constraints
    if (lower.includes('foreign key constraint')) {
        return 'The referenced record (e.g. section, advisor, or semester) could not be found.';
    }
    
    return message;
}
