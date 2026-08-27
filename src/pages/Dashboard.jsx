import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOverview } from '../lib/api'
import { PigmentBar, Spinner, Empty, ErrorNote, STATUS, STATUS_ORDER } from '../components/ui'
import { useAuth } from '../lib/auth'
import { locationFilter } from '../lib/scope'

export default function Dashboard() {
  const { isAdmin, profile } = useAuth()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try { setRows(await getOverview()) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  // Overview ki har ginti isi chhani hui list se banti hai — bar, totals
  // aur cards, sab. Kacha `rows` seedhe kahin render nahi hota.
  const scoped = useMemo(() => {
    const allowed = locationFilter(profile)
    return (rows ?? []).filter((r) => allowed(r.location))
  }, [rows, profile])

  // Locations ko company ke hisaab se group karo, phir sabse zyada
  // "problem wali" location ko upar rakho — kaam wahin se shuru hota hai.
  const groups = useMemo(() => {
    if (!rows) return []
    const map = new Map()
    for (const r of scoped) {
      const c = r.location.company
      if (!map.has(c.id)) map.set(c.id, { company: c, locations: [] })
      map.get(c.id).locations.push(r)
    }
    for (const g of map.values()) {
      g.locations.sort((a, b) => (b.missing + b.short) - (a.missing + a.short))
    }
    return [...map.values()].sort((a, b) => a.company.sort_order - b.company.sort_order)
  }, [rows, scoped])

  const totals = useMemo(() => {
    const t = { missing: 0, short: 0, excess: 0, extra: 0, ok: 0, inactive: 0 }
    for (const r of scoped) for (const k of STATUS_ORDER) t[k] += r[k]
    return t
  }, [scoped])

  if (error) return <div className="p-5 lg:p-8"><ErrorNote message={error} onRetry={load} /></div>
  if (!rows) return <Spinner />

  return (
    <div className="p-5 lg:p-8 max-w-6xl">
      <h1 className="signboard text-xl lg:text-2xl">Overview</h1>
      <p className="mt-1 text-sm text-ink-45">
        {isAdmin ? 'Every active display, worst first.' : 'Your active displays, worst first.'}
      </p>

      {scoped.length === 0 ? (
        <div className="mt-6">
          <Empty
            title={isAdmin ? 'No displays set up yet' : 'Nothing assigned to you'}
            hint={isAdmin
              ? 'Add a location, then apply a template to fill it with the items it should carry.'
              : 'Ask a super admin to give you access to a display.'}
            action={isAdmin
              ? <Link to="/locations" className="btn-primary">Add a location</Link>
              : null}
          />
        </div>
      ) : (
        <>
          {/* Poore network ka ek pigment bar — sabse upar ek hi nazar */}
          <div className="card p-5 mt-6">
            <div className="flex items-baseline justify-between mb-3">
              <span className="eyebrow">{isAdmin ? 'All companies' : 'Your displays'}</span>
              <span className="num text-sm text-ink-45">
                {scoped.length} location{scoped.length === 1 ? '' : 's'}
              </span>
            </div>
            <PigmentBar counts={totals} height={12} />
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
              {STATUS_ORDER.filter((k) => totals[k]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: STATUS[k].color }} />
                  <span className="num text-sm font-semibold">{totals[k]}</span>
                  <span className="text-sm text-ink-45">{STATUS[k].label}</span>
                </div>
              ))}
            </div>
          </div>

          {groups.map((g) => (
            <section key={g.company.id} className="mt-8">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="signboard text-base">{g.company.name}</h2>
                <span className="num text-xs text-ink-45">{g.locations.length}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.locations.map((r) => {
                  const problems = r.missing + r.short
                  return (
                    <Link
                      key={r.location.id}
                      to={`/locations/${r.location.id}`}
                      className="card p-4 hover:border-line-strong transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{r.location.name}</p>
                          <p className="num text-xs text-ink-45 mt-0.5">{r.location.code}</p>
                        </div>
                        {problems > 0 && (
                          <span className="num text-xs font-semibold text-gulal shrink-0 mt-0.5">
                            {problems} to fix
                          </span>
                        )}
                      </div>
                      <div className="mt-3.5">
                        <PigmentBar counts={r} />
                      </div>
                      <p className="num text-xs text-ink-45 mt-2.5">
                        {r.ok}/{r.total} stocked
                      </p>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
