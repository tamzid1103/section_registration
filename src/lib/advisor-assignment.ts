import { supabase } from "@/lib/supabase";

/**
 * Finds the correct advisor for a student based on their ID range in the active semester.
 * Returns the advisor_id UUID or null if not matched.
 */
export const findAdvisorForStudent = async (studentId: string, semesterId: string): Promise<string | null> => {
    const numericId = parseInt(studentId.replace(/-/g, ''));
    if (isNaN(numericId)) return null;

    const { data: range } = await supabase
        .from("student_advisor_ranges")
        .select("advisor_id")
        .eq("semester_id", semesterId)
        .lte("start_id_numeric", numericId)
        .gte("end_id_numeric", numericId)
        .maybeSingle();

    return range?.advisor_id || null;
};
