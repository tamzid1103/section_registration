// Same as @/lib/supabase but as a factory function for pages that need
// their own instance. Uses createBrowserClient so session goes in cookies.
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
