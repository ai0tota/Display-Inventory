import { useEffect, useMemo, useState } from 'react'
import { getAuditLog, getLocations } from '../lib/api'
import { Spinner, Empty, ErrorNote, REASON_LABEL } from '../components/ui'

// Kya hua, seedhi bhasha me. DB ke action codes user ko dikhane layak nahi.
const ACTION_LABEL = {
  verify: 'Counted',
  adjust: 'Adjusted',
  stock_in: 'Stock in',
  stock_out: 'Stock out',
  set_expected: 'Target changed',
  add_to_display: 'Added to display',
  remove_from_display: 'Removed from display',
  apply_template: 'Template applied',
  zero_out: 'Set to zero',
}

export default function Activity() {
  const [rows, setRows] = useState(null)
  const [locations, setLocations] = useState([])
  const [locationId, setLocationId] = useState('')
  const [action, setAction] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [a, l] = await Promise.all([
        getAuditLog({ locationId: locationId || null, limit: 300 }),
        getLocations(),
      ])
      setRows(a); setLocations(l.filter((x) => x.is_active))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [locationId])

  const visible = useMemo(
    () => (rows ?? []).filter((r) => !action || r.action === action),
    [rows, action]
  )

  function exportCsv() {
    const head = ['When', 'Company', 'Location', 'Item code', 'Item', 'What happened',
                  'Expected before', 'Expected after', 'Counted before', 'Counted after', 'By', 'Note']
    const body = visible.map((r) => [
      new Date(r.created_at).toISOString(),
      r.location?.company?.code ?? '',
      r.location?.name ?? '',
      r.item?.item_code ?? '',
      r.item?.name ?? '',
      ACTION_LABEL[r.action] ?? r.action,
      num(r.old_expected), num(r.new_expected),
      num(r.old_actual), num(r.new_actual),
      r.person_name ?? '', r.notes ?? '',
    ])
    // Har cell quote karo aur andar ke quotes double — warna item name me
    // aaya ek comma poori CSV ki columns hila deta hai
    const csv = [head, ...body]
      .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `display-activity-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="signboard text-xl lg:text-2xl">Activity</h1>
          <p className="mt-1 text-sm text-ink-45">
            Every change, oldest untouched. Nothing here can be edited or deleted.
          </p>
        </div>
        {visible.length > 0 && (
          <button onClick={exportCsv} className="btn-ghost btn-sm shrink-0">Export CSV</button>
        )}
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
        <select className="field [&>option]:text-[#14121A] [&>option]:bg-white sm:flex-1" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.company.code} — {l.name}</option>
          ))}
        </select>
        <select className="field [&>option]:text-[#14121A] [&>option]:bg-white sm:w-52" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Everything</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <ErrorNote message={error} onRetry={load} />

      <div className="mt-4">
        {!rows ? <Spinner /> : visible.length === 0 ? (
          <Empty title="Nothing recorded yet"
            hint="Counts and template runs will show up here as they happen." />
        ) : (
          <ul className="space-y-2">
            {visible.map((r) => (
              <li key={r.id} className="card p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold">{ACTION_LABEL[r.action] ?? r.action}</span>
                  <span className="num text-xs text-ink-45 shrink-0">{when(r.created_at)}</span>
                </div>

                <p className="text-[15px] mt-1.5 truncate">
                  {r.item?.name}
                  <span className="num text-xs text-ink-45 ml-1.5">{r.item?.item_code}</span>
                </p>
                <p className="text-xs text-ink-45 mt-0.5">
                  {r.location?.company?.code} · {r.location?.name}
                </p>

                {/* Sirf wahi dikhao jo asal me badla */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  <Delta label="Counted" from={r.old_actual} to={r.new_actual} />
                  <Delta label="Target" from={r.old_expected} to={r.new_expected} />
                </div>

                {/* Kitna aaya/gaya aur kyon — "pichhle mahine damage me kitna
                    gaya" ka jawab isi line se milta hai, isliye list me hai */}
                <Movement delta={r.qty_delta} reason={r.reason} />

                {(r.person_name || r.notes || r.photo_url) && (
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-line">
                    {r.person_name && <span className="text-xs text-ink-70">{r.person_name}</span>}
                    {r.notes && <span className="text-xs text-ink-45 truncate">{r.notes}</span>}
                    {r.photo_url && (
                      <a href={r.photo_url} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-neel ml-auto shrink-0">Photo</a>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Movement({ delta, reason }) {
  if (delta === null || delta === undefined) return null
  const n = Number(delta)
  if (!n) return null
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className={`num text-[13px] font-semibold ${n > 0 ? 'text-mehndi' : 'text-gulal'}`}>
        {n > 0 ? `+${n}` : n}
      </span>
      {reason && (
        <span className="text-xs text-ink-45">{REASON_LABEL[reason] ?? reason}</span>
      )}
    </div>
  )
}

function Delta({ label, from, to }) {
  if (from === null || to === null || Number(from) === Number(to)) return null
  return (
    <span className="num text-xs">
      <span className="text-ink-45">{label} </span>
      <span className="text-ink-45 line-through">{Number(from)}</span>
      <span className="mx-1 text-ink-45">→</span>
      <span className="font-semibold">{Number(to)}</span>
    </span>
  )
}

const num = (v) => (v === null || v === undefined ? '' : Number(v))

function when(ts) {
  const d = new Date(ts)
  const mins = Math.floor((Date.now() - d) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
