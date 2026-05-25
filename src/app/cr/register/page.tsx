'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User, CreditCard, Plus, CheckCircle, Clock } from 'lucide-react'

export default function CRRegisterPage() {
  const [loading, setLoading] = useState(false)
  const [existingApp, setExistingApp] = useState<any>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    student_id: '',
    section_interested: ''
  })
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function checkExisting() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // router.push('/auth/login') // Removing redirect to allow user to see the form if they want, but handleSubmit will check
        return
      }

      const { data } = await supabase
        .from('cr_applications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (data) setExistingApp(data)
    }
    checkExisting()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("Please login with your university email first.")
      setLoading(false)
      return
    }

    const { error } = await supabase.from('cr_applications').insert({
      user_id: user.id,
      full_name: formData.full_name,
      student_id: formData.student_id,
      email: user.email,
      section_interested: formData.section_interested,
      status: 'pending'
    })

    if (error) {
      alert(error.message)
    } else {
      window.location.reload()
    }
    setLoading(false)
  }

  if (existingApp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
            {existingApp.status === 'pending' ? <Clock className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application {existingApp.status}</h2>
          <p className="text-gray-600 mb-6">
            Your application to become a CR for <strong>{existingApp.section_interested}</strong> is currently {existingApp.status}.
            {existingApp.status === 'pending' && " We'll notify you once an admin reviews it."}
          </p>
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Become a CR</h1>
          <p className="text-gray-500 mt-2">Submit your request to manage section seats.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="w-4 h-4" /> Full Name
            </label>
            <input 
              required
              type="text"
              placeholder="e.g. Tamzid Rahman"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Student ID
            </label>
            <input 
              required
              type="text"
              placeholder="241-15-XXXX"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              value={formData.student_id}
              onChange={(e) => setFormData({...formData, student_id: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Section to Manage
            </label>
            <input 
              required
              type="text"
              placeholder="e.g. 59_A"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              value={formData.section_interested}
              onChange={(e) => setFormData({...formData, section_interested: e.target.value})}
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:bg-blue-300 shadow-lg shadow-blue-100"
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
