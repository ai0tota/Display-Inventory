import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getLocation, getLocationStock, recordCheck, moveStock, uploadPhoto } from '../lib/api'
import {
  PigmentBar, StatusChip, Spinner, Empty, ErrorNote, Modal, Field,
  STATUS, STATUS_ORDER, MOVE_REASONS,
} from '../components/ui'

const FILTERS = [
  { key: 'problems', label: 'Needs attention' },
  { key: 'all',      label: 'All items' },
  { key: 'missing',  label: 'Missing' },
  { key: 'short',    label: 'Short' },
]

export default function LocationDetail() {
  const { id } = useParams()
  const [loc, setLoc] = useState(null)
  const [stock, setStock] = useState(null)
  const [filter, setFilter] = useState('problems')
  const [search, setSearch] = useState('')
  const [checking, setChecking] = useState(null) // item row being verified
  const [moving, setMoving] = useState(null)     // item row being stocked in/out
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [l, s] = await Promise.all([getLocation(id), getLocationStock(id)])
      setLoc(l); setStock(s)
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [id])

  const counts = useMemo(() => {
    const c = { missing: 0, short: 0, excess: 0, extra: 0, ok: 0, inactive: 0 }
    for (const r of stock ?? []) c[r.status] += 1
    return c
  }, [stock])

  const visible = useMemo(() => {
    let rows = stock ?? []
    if (filter === 'problems') rows = rows.filter((r) => ['missing', 'short', 'excess', 'extra'].includes(r.status))
    else if (filter !== 'all') rows = rows.filter((r) => r.status === filter)

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((r) =>
        r.item.name.toLowerCase().includes(q) || r.item.item_code.toLowerCase().includes(q))
    }
    // Sabse buri khabar upar
    return [...rows].sort((a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      a.item.item_code.localeCompare(b.item.item_code))
  }, [stock, filter, search])

  if (error && !loc) return <div className="p-5 lg:p-8"><ErrorNote message={error} onRetry={load} /></div>
  if (!loc || !stock) return <Spinner />

  return (
    <div className="p-5 lg:p-8 max-w-4xl">
      <Link to="/locations" className="text-[13px] font-semibold text-ink-45 hover:text-ink">
        ← Locations
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="signboard text-xl lg:text-2xl">{loc.name}</h1>
        <span className="num text-sm text-ink-45">{loc.code}</span>
        <span className="text-sm text-ink-45">· {loc.company.name}</span>
      </div>
      {(loc.city || loc.contact_person) && (
        <p className="mt-1 text-sm text-ink-45">
          {[loc.city, loc.contact_person, loc.contact_phone].filter(Boolean).join(' · ')}
        </p>
      )}

      <div className="card p-4 mt-5">
        <PigmentBar counts={counts} height={10} />
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {STATUS_ORDER.filter((k) => counts[k]).map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-xs">
              <i className="w-2 h-2 rounded-sm" style={{ background: STATUS[k].color }} />
              <b className="num font-semibold">{counts[k]}</b>
              <span className="text-ink-45">{STATUS[k].label}</span>
            </span>
          ))}
        </div>
      </div>

      <ErrorNote message={error} />

      {/* Filters + search */}
      <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`h-9 px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap border transition-colors ${
                filter === f.key
                  ? 'bg-white text-[#0B1030] border-white'
                  : 'bg-paper-raised border-line text-ink-70 hover:bg-paper-sunk'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="field sm:max-w-xs"
          placeholder="Find an item or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Item list */}
      <div className="mt-4">
        {visible.length === 0 ? (
          <Empty
            title={filter === 'problems' ? 'Everything is stocked' : 'No items match'}
            hint={
              filter === 'problems'
                ? 'Nothing at this display is missing or short right now.'
                : 'Try a different filter or clear the search.'
            }
            action={
              filter !== 'all'
                ? <button onClick={() => { setFilter('all'); setSearch('') }} className="btn-ghost">
                    Show all items
                  </button>
                : null
            }
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((r) => (
              <li key={r.id} className="card p-3.5 flex items-center gap-3.5">
                <Thumb url={r.item.photo_url} name={r.item.name} />

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[15px] truncate">{r.item.name}</p>
                  <p className="num text-xs text-ink-45 mt-0.5">
                    {r.item.item_code}
                    {r.item.pack_size && ` · ${r.item.pack_size}`}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusChip status={r.status} />
                    <span className="num text-xs text-ink-45">
                      {fmt(r.actual_qty)} of {fmt(r.expected_qty)} {r.item.uom}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setMoving(r)} className="btn-primary btn-sm">
                    Move
                  </button>
                  <button onClick={() => setChecking(r)} className="btn-ghost btn-sm">
                    Count
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CheckSheet
        row={checking}
        locationId={id}
        onClose={() => setChecking(null)}
        onSaved={() => { setChecking(null); load() }}
      />

      <MoveSheet
        row={moving}
        locationId={id}
        onClose={() => setMoving(null)}
        onSaved={() => { setMoving(null); load() }}
      />
    </div>
  )
}

/* ---------------- Count sheet ----------------
   Ek item, ek kaam: gino aur likho. Photo optional hai —
   zaroori banate to har count par rukawat lag jati. */

function CheckSheet({ row, locationId, onClose, onSaved }) {
  const [qty, setQty] = useState('')
  const [person, setPerson] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (row) {
      setQty(String(Number(row.actual_qty)))
      setPerson(''); setNotes(''); setFile(null); setError('')
    }
  }, [row])

  if (!row) return null

  async function save() {
    setError(''); setBusy(true)
    try {
      // Photo pehle upload — fail ho to stock ko haath hi nahi lagta
      const photoUrl = file ? await uploadPhoto(file, 'checks') : null
      await recordCheck({
        locationId,
        itemId: row.item.id,
        actualQty: Number(qty),
        action: 'verify',
        personName: person.trim() || null,
        photoUrl,
        notes: notes.trim() || null,
      })
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const entered = qty === '' ? null : Number(qty)
  const preview = entered === null ? null : statusFor(entered, row.expected_qty)

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={row.item.name}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy || qty === ''} className="btn-primary">
            {busy ? 'Saving…' : 'Save count'}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3 mb-5">
        <Thumb url={row.item.photo_url} name={row.item.name} size={52} />
        <div>
          <p className="num text-xs text-ink-45">{row.item.item_code}</p>
          <p className="num text-sm mt-0.5">
            Should have <b>{fmt(row.expected_qty)}</b> {row.item.uom}
          </p>
        </div>
      </div>

      <Field label={`Counted (${row.item.uom})`}>
        <input
          type="number" min="0" step="0.001" inputMode="decimal" autoFocus
          className="field num text-lg"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </Field>

      {/* Save se pehle hi bata do result kya hoga — surprise nahi */}
      {preview && (
        <div className="-mt-2 mb-4 flex items-center gap-2">
          <span className="text-xs text-ink-45">This will mark it</span>
          <StatusChip status={preview} />
        </div>
      )}

      <Field label="Counted by" hint="Optional — helps when you review the log later.">
        <input className="field" placeholder="Name" value={person}
          onChange={(e) => setPerson(e.target.value)} />
      </Field>

      <Field label="Photo" hint="Optional. Useful proof when something is missing.">
        <input
          type="file" accept="image/*" capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-70 file:mr-3 file:h-9 file:px-3
                     file:rounded-lg file:border file:border-line file:bg-paper-sunk
                     file:text-[13px] file:font-semibold file:text-ink"
        />
      </Field>

      <Field label="Note">
        <textarea rows={2} className="field h-auto py-2.5" placeholder="Anything worth recording"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <ErrorNote message={error} />
    </Modal>
  )
}

/* ---------------- Move sheet ----------------
   CheckSheet ginti ka natija likhta hai (absolute). Ye harkat likhta hai
   (delta) — kitna aaya ya gaya, aur kyon. Do alag sawaal, do alag parche. */

const DIRECTIONS = [
  { key: 'in',  label: 'Stock in',  on: 'bg-mehndi text-white', verb: 'Add to display' },
  { key: 'out', label: 'Stock out', on: 'bg-gulal text-white',  verb: 'Take off display' },
]

function MoveSheet({ row, locationId, onClose, onSaved }) {
  const [direction, setDirection] = useState('in')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [person, setPerson] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (row) {
      setDirection('in'); setQty(''); setReason('')
      setPerson(''); setNotes(''); setFile(null); setError('')
    }
  }, [row])

  if (!row) return null

  // Direction badalte hi reason list badal jaati hai — purana "sold"
  // "Stock in" ke saath chala jaye, ye nahi hona chahiye.
  function pickDirection(d) {
    setDirection(d)
    setReason('')
  }

  async function save() {
    setError(''); setBusy(true)
    try {
      // Photo pehle upload — fail ho to stock ko haath hi nahi lagta
      const photoUrl = file ? await uploadPhoto(file, 'checks') : null
      await moveStock({
        locationId,
        itemId: row.item.id,
        direction,
        qty: Number(qty),
        reason: reason || null,
        personName: person.trim() || null,
        photoUrl,
        notes: notes.trim() || null,
      })
      onSaved()
    } catch (e) {
      // DB ke sandesh insaan ke liye likhe gaye hain — jyon ke tyon dikhao
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const dir = DIRECTIONS.find((d) => d.key === direction)
  const current = Number(row.actual_qty)
  const entered = qty === '' ? null : Number(qty)
  const outward = direction === 'out'

  // Display par hai hi nahi, to nikaalega kahan se
  const overdraw = outward && entered !== null && entered > current
  // 0.1 + 0.2 wali float gandagi preview me nahi dikhni chahiye — step 0.001 hai
  const next = entered === null ? null
    : Math.round((current + (outward ? -entered : entered)) * 1000) / 1000

  const needsPerson = outward && !person.trim()
  const blocked = busy || qty === '' || entered <= 0 || overdraw || needsPerson

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={row.item.name}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={blocked} className="btn-primary">
            {busy ? 'Saving…' : dir.verb}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3 mb-5">
        <Thumb url={row.item.photo_url} name={row.item.name} size={52} />
        <div>
          <p className="num text-xs text-ink-45">{row.item.item_code}</p>
          <p className="num text-sm mt-0.5">
            On the display now <b>{fmt(row.actual_qty)}</b> {row.item.uom}
          </p>
        </div>
      </div>

      {/* Sabse bada faisla — dropdown me chhupane layak nahi */}
      <div className="flex gap-2 mb-5">
        {DIRECTIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-pressed={direction === d.key}
            onClick={() => pickDirection(d.key)}
            className={`flex-1 h-11 rounded-lg text-[15px] font-semibold transition-colors ${
              direction === d.key ? d.on : 'btn-ghost'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <Field label={`Quantity (${row.item.uom})`}>
        <input
          type="number" min="0" step="0.001" inputMode="decimal" autoFocus
          className="field num text-lg"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </Field>

      <Field label="Reason">
        <select
          className="field [&>option]:text-[#14121A] [&>option]:bg-white"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          <option value="">Not stated</option>
          {MOVE_REASONS[direction].map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </Field>

      <Field
        label={outward ? 'Handled by (required)' : 'Handled by'}
        hint={outward
          ? 'Stock leaving the display must be signed for.'
          : 'Optional — helps when you review the log later.'}
      >
        <input className="field" placeholder="Name" value={person}
          onChange={(e) => setPerson(e.target.value)} />
      </Field>

      <Field label="Photo" hint="Optional. Useful proof when something is missing.">
        <input
          type="file" accept="image/*" capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-70 file:mr-3 file:h-9 file:px-3
                     file:rounded-lg file:border file:border-line file:bg-paper-sunk
                     file:text-[13px] file:font-semibold file:text-ink"
        />
      </Field>

      <Field label="Note">
        <textarea rows={2} className="field h-auto py-2.5" placeholder="Anything worth recording"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {/* Save se pehle hi bata do result kya hoga — surprise nahi */}
      {overdraw ? (
        <p className="text-sm text-gulal">
          Only {fmt(current)} on the display right now.
        </p>
      ) : next !== null && (
        <div className="flex items-center gap-2">
          <span className="num text-sm">
            <span className="text-ink-45">{fmt(current)}</span>
            <span className="mx-1.5 text-ink-45">→</span>
            <b className="font-semibold">{fmt(next)}</b>
          </span>
          <StatusChip status={statusFor(next, row.expected_qty)} />
        </div>
      )}

      <ErrorNote message={error} />
    </Modal>
  )
}

function Thumb({ url, name, size = 44 }) {
  return url ? (
    <img src={url} alt={name} loading="lazy"
      className="rounded-lg object-cover bg-paper-sunk shrink-0"
      style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-lg bg-paper-sunk border border-line shrink-0"
      style={{ width: size, height: size }} aria-hidden />
  )
}

// 20.000 ko 20 dikhao, 2.500 ko 2.5 — trailing zeros shor hain
const fmt = (n) => Number(n).toString()

/* Ginti ka natija kis khaane me girta hai. CheckSheet aur MoveSheet
   dono yahi niyam lagate hain — do jagah likha to ek din alag ho jayega. */
function statusFor(actual, expectedRaw) {
  const expected = Number(expectedRaw)
  const n = Number(actual)
  if (expected === 0 && n > 0) return 'extra'
  if (n === 0 && expected > 0) return 'missing'
  if (n < expected) return 'short'
  if (n > expected) return 'excess'
  return expected === 0 ? 'inactive' : 'ok'
}
