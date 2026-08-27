import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  getLocation, getLocationStock, getItems, getCategories, getGroups,
  recordCheck, bulkStockIn, uploadPhoto, moveStock,
} from '../lib/api'
import {
  PigmentBar, StatusChip, Spinner, Empty, ErrorNote, Modal, Field,
  STATUS, STATUS_ORDER, MOVE_REASONS,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { locationFilter } from '../lib/scope'

const FILTERS = [
  { key: 'problems', label: 'Needs attention' },
  { key: 'all',      label: 'All items' },
  { key: 'missing',  label: 'Missing' },
  { key: 'short',    label: 'Short' },
]

export default function LocationDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [loc, setLoc] = useState(null)
  const [stock, setStock] = useState(null)
  const [filter, setFilter] = useState('problems')
  const [search, setSearch] = useState('')
  const [checking, setChecking] = useState(null) // item row being verified
  const [moving, setMoving] = useState(null)     // item row being moved in/out
  const [adding, setAdding] = useState(false)    // catalog item being put on the display
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

  // List se ye display chhup jaye lekin URL seedha type kar liya jaye — RLS
  // to rok hi deta hai, par wahan se aaya "no rows" wala DB message padhne
  // layak nahi. Isliye yahan saaf jawab dete hain.
  const outOfScope = (loc && !locationFilter(profile)(loc)) || (error && !loc && isBlocked(error))

  if (outOfScope) {
    return (
      <div className="p-5 lg:p-8 max-w-4xl">
        <Link to="/locations" className="text-[13px] font-semibold text-ink-45 hover:text-ink">
          ← Locations
        </Link>
        <div className="mt-6">
          <Empty
            title="Not your display"
            hint="This location isn't assigned to you. Ask a super admin if you need access."
          />
        </div>
      </div>
    )
  }

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
        <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
          Add item
        </button>
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
          /* Khaali display par "Everything is stocked" jhooth hai — wahan kuch hai hi nahi */
          stock.length === 0 ? (
            <Empty
              title="Nothing on this display yet"
              hint="Add items one by one, or ask an admin to apply a template."
              action={
                <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
                  Add item
                </button>
              }
            />
          ) : (
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
          )
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

                <div className="shrink-0 flex flex-col gap-1.5">
                  <button onClick={() => setChecking(r)} className="btn-primary btn-sm">
                    Count
                  </button>
                  {profile?.role !== 'super_admin' && (
                    <button onClick={() => setMoving(r)} className="btn-ghost btn-sm">
                      Move
                    </button>
                  )}
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

      <AddItemSheet
        open={adding}
        locationId={id}
        stock={stock}
        onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); load() }}
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

/* ---------------- Add item sheet ----------------
   502 items ki ek lambi list phone par bekaar hai — display ke saamne khade
   ho kar koi scroll nahi karta. Isliye teen kadam: category chuno, groups
   chuno, phir sirf unhi ki ginti bharo.

   Reason yahan tay hai: 'new_stock'. */

const STEP_TITLE = {
  category:   'Pick a category',
  groups:     'Pick groups',
  quantities: 'Set quantities',
}

function AddItemSheet({ open, locationId, stock, onClose, onSaved }) {
  const [step, setStep] = useState('category')

  const [cats, setCats] = useState(null)
  const [groups, setGroups] = useState([])
  const [items, setItems] = useState([])
  const [loadError, setLoadError] = useState('')

  const [category, setCategory] = useState(null)
  const [picked, setPicked] = useState(new Set())  // group ids
  const [qty, setQty] = useState({})               // item id -> jo type hua
  const [search, setSearch] = useState('')
  const [person, setPerson] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setStep('category'); setCategory(null); setPicked(new Set()); setQty({})
    setSearch(''); setPerson(''); setNotes(''); setError(''); setLoadError('')
    setCats(null)

    // Teeno chhoti tables hain — ek baar me utha lo, phir har kadam
    // bina network ke chalta hai
    let alive = true
    Promise.all([getCategories(), getGroups(), getItems()])
      .then(([c, g, i]) => { if (alive) { setCats(c); setGroups(g); setItems(i) } })
      .catch((e) => { if (alive) setLoadError(e.message) })
    return () => { alive = false }
  }, [open])

  // Is display par abhi kya rakha hai. Page ne ye pehle hi utha rakha hai,
  // isliye live stock dikhane ke liye dobara server jaane ki zaroorat nahi.
  const onDisplay = useMemo(
    () => new Map((stock ?? []).map((s) => [s.item_id, Number(s.actual_qty)])),
    [stock])

  const itemsByGroup = useMemo(() => {
    const m = new Map()
    for (const it of items) {
      const gid = it.group?.id
      if (!gid) continue
      if (!m.has(gid)) m.set(gid, [])
      m.get(gid).push(it)
    }
    return m
  }, [items])

  const countByCategory = useMemo(() => {
    const m = new Map()
    for (const it of items) {
      const cid = it.group?.category?.id
      if (cid) m.set(cid, (m.get(cid) ?? 0) + 1)
    }
    return m
  }, [items])

  // Khaali category kholne ka koi matlab nahi — usme se kuch add hi nahi hoga
  const categories = useMemo(
    () => (cats ?? []).filter((c) => countByCategory.get(c.id)),
    [cats, countByCategory])

  const categoryGroups = useMemo(
    () => (category ? groups.filter((g) => g.category_id === category.id) : []),
    [groups, category])

  // Chune hue groups ke saare items, code se sorted
  const chosen = useMemo(() => {
    const rows = []
    for (const gid of picked) rows.push(...(itemsByGroup.get(gid) ?? []))
    return rows.sort((a, b) => a.item_code.localeCompare(b.item_code))
  }, [picked, itemsByGroup])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return chosen
    return chosen.filter((it) =>
      it.name.toLowerCase().includes(q) || it.item_code.toLowerCase().includes(q))
  }, [chosen, search])

  // Khaali ya 0 ka matlab "is item ko chhod do". Ginti `chosen` par lagti hai,
  // `shown` par nahi — search se chhupa hua bhara item bhi jayega.
  const filled = useMemo(
    () => chosen
      .map((it) => ({ id: it.id, qty: Number(qty[it.id]) }))
      .filter((f) => Number.isFinite(f.qty) && f.qty > 0),
    [chosen, qty])

  // 0.1 + 0.2 wali float gandagi footer me nahi dikhni chahiye
  const totalUnits = Math.round(filled.reduce((sum, f) => sum + f.qty, 0) * 1000) / 1000

  function toggleGroup(id) {
    const next = new Set(picked)
    next.has(id) ? next.delete(id) : next.add(id)
    setPicked(next)
  }

  async function save() {
    setError(''); setBusy(true)
    try {
      await bulkStockIn({
        locationId,
        items: filled.map((f) => ({ item_id: f.id, qty: Number(f.qty) })),
        reason: 'new_stock',
        personName: person.trim() || null,
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

  const footer =
    step === 'category' ? (
      <button onClick={onClose} className="btn-ghost">Cancel</button>
    ) : step === 'groups' ? (
      <>
        <button onClick={() => setStep('category')} className="btn-ghost">Back</button>
        <button
          onClick={() => setStep('quantities')}
          disabled={picked.size === 0}
          className="btn-primary"
        >
          Next — {picked.size} group{picked.size === 1 ? '' : 's'}
        </button>
      </>
    ) : (
      <>
        <button onClick={() => setStep('groups')} className="btn-ghost">Back</button>
        <button onClick={save} disabled={busy || filled.length === 0} className="btn-primary">
          {busy
            ? 'Saving…'
            : `Add ${filled.length} item${filled.length === 1 ? '' : 's'} (${fmt(totalUnits)} units)`}
        </button>
      </>
    )

  return (
    <Modal open={open} onClose={onClose} title={STEP_TITLE[step]} footer={footer}>
      <ErrorNote message={loadError} />

      {loadError ? null : cats === null ? (
        <Spinner />
      ) : step === 'category' ? (
        categories.length === 0 ? (
          <Empty title="Nothing in the catalog yet"
            hint="Add categories and items from the Catalog page first." />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setCategory(c); setPicked(new Set()); setStep('groups') }}
                className="border border-line rounded-lg p-3 text-left hover:bg-paper-sunk transition-colors"
              >
                <span className="num text-[13px] font-semibold h-8 px-2.5 rounded-lg
                                 bg-neel/10 text-neel inline-grid place-items-center">
                  {c.code_prefix}
                </span>
                <span className="block font-semibold mt-2 truncate">{c.name}</span>
                <span className="num block text-xs text-ink-45 mt-0.5">
                  {countByCategory.get(c.id)} item{countByCategory.get(c.id) === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        )
      ) : step === 'groups' ? (
        <>
          <span className="eyebrow block mb-2">{category?.name}</span>

          {categoryGroups.length === 0 ? (
            <Empty title="No groups here" hint="This category has no groups yet." />
          ) : (
            <>
              <div className="border border-line rounded-lg max-h-72 overflow-y-auto divide-y divide-line">
                {categoryGroups.map((g) => {
                  const list = itemsByGroup.get(g.id) ?? []
                  // Kaun se groups pehle se cover ho chuke hain — ek nazar me
                  const here = list.filter((it) => onDisplay.has(it.id)).length
                  return (
                    <label key={g.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-paper-sunk">
                      <input type="checkbox" checked={picked.has(g.id)} onChange={() => toggleGroup(g.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] truncate">{g.name}</span>
                      </span>
                      <span className="num text-xs text-ink-45 shrink-0 text-right">
                        {list.length} items
                        {here > 0 && (
                          <span className="block text-mehndi">{here} on display</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>

              {categoryGroups.length > 1 && (
                <button
                  onClick={() => setPicked(
                    picked.size === categoryGroups.length
                      ? new Set()
                      : new Set(categoryGroups.map((g) => g.id))
                  )}
                  className="mt-2 text-[13px] font-semibold text-neel">
                  {picked.size === categoryGroups.length ? 'Clear all' : 'Select all'}
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {/* Bada group chuna ho to ismein se dhoondhna padta hai */}
          <input
            className="field"
            placeholder="Find an item or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <ul className="mt-3 border border-line rounded-lg max-h-80 overflow-y-auto divide-y divide-line">
            {shown.length === 0 ? (
              <li className="px-3 py-3 text-sm text-ink-45">No item matches that.</li>
            ) : shown.map((it) => {
              const here = onDisplay.get(it.id)
              return (
                <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Thumb url={it.photo_url} name={it.name} />

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[15px] truncate">{it.name}</p>
                    <p className="num text-xs text-ink-45 mt-0.5 truncate">
                      {it.item_code}
                      {it.pack_size && ` · ${it.pack_size}`}
                    </p>
                    {/* Yahi wo jaankari hai jiske liye warna display tak jaana padta */}
                    <p className={`num text-xs mt-0.5 ${here > 0 ? 'text-mehndi' : 'text-ink-45'}`}>
                      {here === undefined ? 'not on display' : `on display: ${fmt(here)}`}
                    </p>
                  </div>

                  <input
                    type="number" min="0" step="0.001" inputMode="decimal"
                    className="field num w-20 shrink-0"
                    placeholder="0"
                    value={qty[it.id] ?? ''}
                    onChange={(e) => setQty((q) => ({ ...q, [it.id]: e.target.value }))}
                  />
                </li>
              )
            })}
          </ul>

          <div className="mt-5">
            <Field label="Added by" hint="Optional — helps when you review the log later.">
              <input className="field" placeholder="Name" value={person}
                onChange={(e) => setPerson(e.target.value)} />
            </Field>

            <Field label="Note" hint="Optional. Applies to every item in this batch.">
              <textarea rows={2} className="field h-auto py-2.5" placeholder="Anything worth recording"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          {/* Iske bina log naya total type kar dete hain aur stock chupke se
              do guna ho jata hai */}
          <p className="text-xs text-ink-45">
            Quantities are added to what is already on the display.
          </p>
        </>
      )}

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

  function pickDirection(d) {
    setDirection(d)
    setReason('')
  }

  async function save() {
    setError(''); setBusy(true)
    try {
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
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const dir = DIRECTIONS.find((d) => d.key === direction)
  const current = Number(row.actual_qty)
  const entered = qty === '' ? null : Number(qty)
  const outward = direction === 'out'

  const overdraw = outward && entered !== null && entered > current
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

// PostgREST .single() ko RLS ne rok diya to yahi shakayat aati hai
const isBlocked = (msg) =>
  /multiple \(or no\) rows|0 rows|PGRST116/i.test(msg ?? '')

// 20.000 ko 20 dikhao, 2.500 ko 2.5 — trailing zeros shor hain
const fmt = (n) => Number(n).toString()

/* Ginti ka natija kis khaane me girta hai. Ek hi jagah likha hai —
   do jagah likha to ek din alag ho jayega. */
function statusFor(actual, expectedRaw) {
  const expected = Number(expectedRaw)
  const n = Number(actual)
  if (expected === 0 && n > 0) return 'extra'
  if (n === 0 && expected > 0) return 'missing'
  if (n < expected) return 'short'
  if (n > expected) return 'excess'
  return expected === 0 ? 'inactive' : 'ok'
}
