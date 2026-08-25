import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Background ab <Backdrop /> se aata hai — App.jsx me ek hi baar.
  // Yahan sirf glass card bachi hai.
  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="relative w-full max-w-[400px] mx-auto rounded-3xl bg-white/[.08] backdrop-blur-2xl border border-white/15 shadow-[0_8px_60px_rgba(0,0,0,.45)] px-8 py-10">
          
        {/* Top Highlight */}
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

        {/* Header */}
        <span className="block text-[11px] tracking-[0.2em] font-semibold text-white/45 uppercase mb-1">
          INVENTORY
        </span>
        <h1 className="signboard text-[34px] leading-[1.05] text-white">
          Display<br />Inventory
        </h1>
        <p className="text-sm text-white/55 mt-3">
          Sign in to the company you work for. Accounts are created by your administrator.
        </p>

        {/* Form */}
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label className="block text-[11px] tracking-[0.14em] font-semibold text-white/45 uppercase mb-1">
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-0 border-b border-white/20 rounded-none px-0 h-12 text-white placeholder-white/35 text-[15px] focus:border-white/70 focus:outline-none focus:ring-0 transition-colors"
            />
          </div>

          <div className="relative">
            <label className="block text-[11px] tracking-[0.14em] font-semibold text-white/45 uppercase mb-1">
              Password
            </label>
            <input
              type={showPwd ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-0 border-b border-white/20 rounded-none px-0 h-12 text-white placeholder-white/35 text-[15px] focus:border-white/70 focus:outline-none focus:ring-0 transition-colors pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-0 bottom-3 text-white/40 hover:text-white/80 transition-colors focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none rounded"
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>

          {error && (
            <div className="rounded-lg bg-gulal/15 border border-gulal/40 px-3.5 py-2.5 text-sm text-white">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={busy} 
            className="w-full h-12 rounded-xl bg-gulal text-white font-semibold hover:bg-[#B82A4E] disabled:opacity-50 transition-colors mt-2 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
