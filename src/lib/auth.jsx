import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    // Assignments profile ke saath hi aate hain — inke bina UI ko pata hi
    // nahi chalta ki storekeeper kis display ka hai. user_locations par
    // "read own assignments" policy hai, isliye har user apni list padh leta hai.
    async function loadProfile(uid) {
      if (!uid) return null
      const { data } = await supabase
        .from('profiles')
        .select('*, assignments:user_locations(location_id, location:locations(id, company_id))')
        .eq('id', uid)
        .single()
      if (!data) return null
      // Aage har jagah .assignments par bharosa kiya jata hai — null kabhi na jaye
      return { ...data, assignments: data.assignments ?? [] }
    }

    // Page refresh ke baad session wapas laao
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      setProfile(await loadProfile(data.session?.user?.id))
      setLoading(false)
    })

    // Login/logout/token-refresh sab yahi ek listener sambhalta hai
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      if (!alive) return
      setSession(s)
      setProfile(await loadProfile(s?.user?.id))
      setLoading(false)
    })

    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    // Server pe RLS asli guard hai. Ye flag sirf UI chhupane ke liye hai —
    // ise kabhi security nahi maanna.
    isAdmin: profile?.role === 'super_admin' && profile?.is_active,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
