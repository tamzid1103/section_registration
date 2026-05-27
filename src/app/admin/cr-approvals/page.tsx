'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, X, Clock, User, Mail, Hash, BookOpen } from 'lucide-react'
import { invalidateCacheScopes } from '@/lib/cache/client'

export default function AdminCRApprovalPage() {
    const [apps, setApps] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        fetchApps()
    }, [])

    async function fetchApps() {
        const { data } = await supabase
            .from('cr_applications')
            .select('*')
            .eq('status', 'pending')
            .order('applied_at', { ascending: false })

        if (data) setApps(data)
        setLoading(false)
    }

    async function handleAction(app: any, action: 'approved' | 'rejected') {
        const { data: { user } } = await supabase.auth.getUser()

        // 1. Update Application Status
        const { error: appError } = await supabase
            .from('cr_applications')
            .update({
                status: action,
                processed_at: new Date().toISOString(),
                processed_by: user?.id
            })
            .eq('id', app.id)

        if (appError) {
            alert(appError.message)
            return
        }

        // 2. If approved, add to authorized_staff
        if (action === 'approved') {
            const { error: staffError } = await supabase
                .from('authorized_staff')
                .insert({
                    email: app.email,
                    name: app.full_name,
                    role: 'cr'
                })

            if (staffError && !staffError.message.includes('duplicate') && !staffError.message.includes('unique')) {
                alert("App approved but failed to add to staff: " + staffError.message)
            }
        }

        await invalidateCacheScopes(['admin'])
        fetchApps()
    }

    if (loading) return <div className="p-8 text-center">Loading applications...</div>

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">CR Approval Queue</h1>
                <p className="text-gray-500">Review and approve student requests for CR access.</p>
            </div>

            <div className="grid gap-6">
                {apps.length === 0 ? (
                    <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
                        No pending applications found.
                    </div>
                ) : (
                    apps.map(app => (
                        <div key={app.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                        {app.full_name[0]}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">{app.full_name}</h3>
                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                            <Mail className="w-3 h-3" /> {app.email}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                    <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full">
                                        <Hash className="w-3 h-3" /> {app.student_id}
                                    </span>
                                    <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                                        <BookOpen className="w-3 h-3" /> Section: {app.section_interested}
                                    </span>
                                    <span className="flex items-center gap-1 text-gray-400">
                                        <Clock className="w-3 h-3" /> Applied {new Date(app.applied_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleAction(app, 'rejected')}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    <X className="w-4 h-4" /> Reject
                                </button>
                                <button
                                    onClick={() => handleAction(app, 'approved')}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                                >
                                    <Check className="w-4 h-4" /> Approve CR
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
