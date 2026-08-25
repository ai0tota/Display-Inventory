import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail fast: .env missing ho to build ke baad blank screen dikhne se
// behtar hai ki abhi saaf error mile.
if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL ya VITE_SUPABASE_ANON_KEY missing hai. .env check karo.')
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // magic link callback handle karne ke liye
  },
})
