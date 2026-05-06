"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Registration {
    id: string;
    student_id: string;
    student_name: string;
    section_name: string;
    lab_group_name: string;
    created_at: string;
}

interface AdvisorInfo {
    name: string;
    initial: string;
    ranges: {
        start_id: string;
        end_id: string;
    }[];
}

export default function AdvisorDashboard() {
    const [loading, setLoading] = useState(true);
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [advisorInfo, setAdvisorInfo] = useState<AdvisorInfo | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        async function fetchAdvisorData() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get Advisor details and their assigned ranges
            const { data: advisorData, error: advisorError } = await supabase
                .from("advisors")
                .select(`
                    id, 
                    name, 
                    initial,
                    student_advisor_ranges (
                        start_id,
                        end_id,
                        start_id_numeric,
                        end_id_numeric
                    )
                `)
                .eq("email", user.email)
                .single();

            if (advisorError || !advisorData) {
                setLoading(false);
                return;
            }

            setAdvisorInfo({
                name: advisorData.name,
                initial: advisorData.initial,
                ranges: (advisorData.student_advisor_ranges as any[]).map(r => ({
                    start_id: r.start_id,
                    end_id: r.end_id
                }))
            });

            // 2. Fetch students registered to this advisor
            const { data: regData, error: regError } = await supabase
                .from("registrations")
                .select(`
                    id,
                    student_id,
                    student_name,
                    created_at,
                    sections (name),
                    lab_groups (name)
                `)
                .eq("advisor_id", advisorData.id)
                .order("created_at", { ascending: false });

            if (!regError && regData) {
                const formatted = regData.map((r: any) => ({
                    id: r.id,
                    student_id: r.student_id,
                    student_name: r.student_name,
                    section_name: r.sections?.name || "N/A",
                    lab_group_name: r.lab_groups?.name || "None",
                    created_at: new Date(r.created_at).toLocaleDateString()
                }));
                setRegistrations(formatted);
            }
            setLoading(false);
        }

        fetchAdvisorData();
    }, []);

    const filteredRegs = registrations.filter(r =>
        r.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.student_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-10 text-center">Loading advisor console...</div>;

    if (!advisorInfo) {
        return (
            <div className="p-10 text-center space-y-4">
                <h1 className="text-2xl font-bold text-red-600">Advisor Record Not Found</h1>
                <p>Your email is not registered as an advisor in the system.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome, {advisorInfo.name}</h1>
                    <p className="text-muted-foreground">Managing pre-registrations for your assigned ranges.</p>
                </div>
                <div className="flex gap-2">
                    {advisorInfo.ranges.map((range, i) => (
                        <Badge key={i} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 py-1 px-3">
                            Range: {range.start_id} — {range.end_id}
                        </Badge>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Total Registered</CardTitle>
                        <Users className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{registrations.length}</div>
                        <p className="text-xs text-muted-foreground">Students under your supervision</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Registered Students</CardTitle>
                            <CardDescription>Real-time list of students who completed pre-registration</CardDescription>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by ID or Name"
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student ID</TableHead>
                                <TableHead>Full Name</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead>Lab Group</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRegs.map((reg) => (
                                <TableRow key={reg.id}>
                                    <TableCell className="font-medium">{reg.student_id}</TableCell>
                                    <TableCell>{reg.student_name}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">Section {reg.section_name}</Badge>
                                    </TableCell>
                                    <TableCell>{reg.lab_group_name}</TableCell>
                                    <TableCell className="text-muted-foreground">{reg.created_at}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                            <UserCheck className="w-3 h-3 mr-1" /> Verified
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredRegs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        No students found matching your search.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
