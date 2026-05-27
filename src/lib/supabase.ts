// Browser client — uses @supabase/ssr's createBrowserClient so that
// sessions are stored in cookies (readable by the middleware server-side).
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (process.env.NODE_ENV !== 'production') {
	if (!supabaseUrl.trim()) {
		console.error('Missing NEXT_PUBLIC_SUPABASE_URL. Supabase browser client will be created with an empty fallback.')
	}
	if (!supabaseAnonKey.trim()) {
		console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Supabase browser client will be created with an empty fallback.')
	}
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
