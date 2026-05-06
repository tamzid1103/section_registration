import { supabase } from "@/lib/supabase";

export type StudentIDRange = {
    advisor_id: string;
    start_id: string;
    end_id: string;
    advisor_name?: string;
};

/**
 * Normalizes a student ID by removing dashes and converting to uppercase
 * Example: "241-15-001" -> "24115001"
 */
export const normalizeStudentId = (id: string) => {
    return id.replace(/-/g, "").toUpperCase();
};

/**
 * Finds the correct advisor for a student ID based on pre-defined ranges
 */
export const findAdvisorForStudent = async (studentId: string, semesterId: string) => {
    const normalizedId = normalizeStudentId(studentId);

    // Convert normalizedId (string) to numeric for comparison
    const numericId = parseInt(normalizedId);
    if (isNaN(numericId)) return null;

    const { data: range, error } = await supabase
        .from("student_advisor_ranges")
        .select("advisor_id, advisors(id, name, initial)")
        .eq("semester_id", semesterId)
        .lte("start_id_numeric", numericId)
        .gte("end_id_numeric", numericId)
        .maybeSingle();

    if (error || !range) return null;

    return range.advisors;
};

for (const range of ranges) {
    const start = normalizeStudentId(range.start_id);
    const end = normalizeStudentId(range.end_id);

    if (normalizedId >= start && normalizedId <= end) {
        return {
            id: range.advisor_id,
            name: (range.advisors as any)?.name || "Unknown Advisor",
        };
    }
}

return null;
};
