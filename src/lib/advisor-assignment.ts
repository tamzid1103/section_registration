import { supabase } from "@/lib/supabase";

export function parseStudentIdNumeric(str: string | null | undefined): number | null {
    if (!str) return null;
    const cleaned = str.replace(/[^0-9]/g, '');
    if (!cleaned) return null;
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
}

/**
 * Finds the correct advisor for a student based on their ID range in the active semester.
 * Returns the advisor_id UUID or null if not matched.
 */
export const findAdvisorForStudent = async (studentId: string, semesterId?: string): Promise<string | null> => {
    const numId = parseStudentIdNumeric(studentId);
    if (numId === null) return null;

    let query = supabase.from("student_advisor_ranges")
        .select("advisor_id, start_id, end_id, start_id_numeric, end_id_numeric, semester_id");

    if (semesterId) {
        query = query.eq("semester_id", semesterId);
    }

    const { data: ranges } = await query;

    if (ranges && ranges.length > 0) {
        const match = ranges.find(r => {
            const start = (r.start_id_numeric !== null && r.start_id_numeric !== undefined)
                ? Number(r.start_id_numeric)
                : parseStudentIdNumeric(r.start_id);
            const end = (r.end_id_numeric !== null && r.end_id_numeric !== undefined)
                ? Number(r.end_id_numeric)
                : parseStudentIdNumeric(r.end_id);

            if (start === null || end === null) return false;
            return numId >= start && numId <= end;
        });

        if (match) return match.advisor_id;
    }

    // Fallback: if semester-specific lookup returned no match, try global ranges (where semester_id is null)
    if (semesterId) {
        const { data: globalRanges } = await supabase.from("student_advisor_ranges")
            .select("advisor_id, start_id, end_id, start_id_numeric, end_id_numeric");
        if (globalRanges && globalRanges.length > 0) {
            const match = globalRanges.find(r => {
                const start = (r.start_id_numeric !== null && r.start_id_numeric !== undefined)
                    ? Number(r.start_id_numeric)
                    : parseStudentIdNumeric(r.start_id);
                const end = (r.end_id_numeric !== null && r.end_id_numeric !== undefined)
                    ? Number(r.end_id_numeric)
                    : parseStudentIdNumeric(r.end_id);

                if (start === null || end === null) return false;
                return numId >= start && numId <= end;
            });
            if (match) return match.advisor_id;
        }
    }

    return null;
};
