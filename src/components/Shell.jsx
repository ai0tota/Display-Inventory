import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// adminOnly = jise sirf super admin dekhe. Ye chhupana suvidha hai,
// suraksha nahi — asli rok RLS policies me hai.
const NAV = [
  { to: '/',          label: 'Overview',  glyph: '▦', end: true },
  { to: '/locations', label: 'Locations', glyph: '◈' },
  { to: '/catalog',   label: 'Catalog',   glyph: '⬡', adminOnly: true },
  { to: '/templates', label: 'Templates', glyph: '≣', adminOnly: true },
  { to: '/activity',  label: 'Activity',  glyph: '⟳' },
  { to: '/people',    label: 'People',    glyph: '⚇', adminOnly: true },
]

export default function Shell() {
  const { profile, isAdmin, signOut } = useAuth()
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin)

  return (
    <div className="min-h-screen lg:flex">
      {/* ---- Desktop sidebar ---- */}
      <aside className="relative hidden lg:flex lg:flex-col w-60 shrink-0 glass border-r">
        <i className="glass-edge" />
        <div className="h-16 px-5 flex items-center border-b border-line">
          <Mark />
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 h-10 px-3 rounded-lg text-[14px] font-medium transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/[.08]'
                }`
              }
            >
              <span className="w-4 text-center opacity-70" aria-hidden>{n.glyph}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          <p className="px-3 text-[13px] font-medium truncate">{profile?.full_name}</p>
          <p className="px-3 text-xs text-ink-45 truncate">{profile?.email}</p>
          <p className="px-3 text-xs text-ink-45 mb-2 capitalize">
            {profile?.role?.replace('_', ' ')}
          </p>
          <button onClick={signOut} className="btn-ghost btn-sm w-full">Sign out</button>
        </div>
      </aside>

      {/* ---- Mobile top bar ---- */}
      <header className="lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between
                         glass border-b border-line">
        <Mark />
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-ink-70 truncate max-w-[100px] sm:max-w-[150px]">
            {profile?.full_name}
          </span>
          <button onClick={signOut} className="text-[13px] font-semibold text-ink-45 hover:text-white">Sign out</button>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <Outlet />
      </main>

      {/* ---- Mobile bottom tabs ----
           Display pe khade-khade angootha yahin pahunchta hai. */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 grid
                      glass border-t border-line"
           style={{
             paddingBottom: 'env(safe-area-inset-bottom)',
             gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))`,
           }}>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center h-16 gap-1 text-[10px] font-semibold ${
                isActive ? 'text-white' : 'text-white/60'
              }`
            }
          >
            <span className="text-base leading-none" aria-hidden>{n.glyph}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Mark() {
  return (
    <div className="flex items-center gap-2.5">
      {/* Chaar pigment squares — app ki status bhasha ka chhota sa namoona */}
      <span className="grid grid-cols-2 gap-px w-5 h-5 rounded-[3px] overflow-hidden" aria-hidden>
        <i className="bg-gulal" /><i className="bg-haldi" />
        <i className="bg-neel" /><i className="bg-mehndi" />
      </span>
      <span className="signboard text-[15px] leading-none">Display Inventory</span>
    </div>
  )
}
