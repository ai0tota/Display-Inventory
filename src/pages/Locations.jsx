import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCompanies, getLocations, createLocation, updateLocation, deactivateLocation } from '../lib/api'
import { Spinner, Empty, ErrorNote, Modal, Field } from '../components/ui'
import { useAuth } from '../lib/auth'
import { visibleCompanies, visibleLocations } from '../lib/scope'

export default function Locations() {
  const { isAdmin, profile } = useAuth()
  const [companies, setCompanies] = useState([])
  const [locations, setLocations] = useState(null)
  const [companyId, setCompanyId] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (new) | row (edit)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [c, l] = await Promise.all([getCompanies(), getLocations(companyId || null)])
      setCompanies(c); setLocations(l)
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [companyId])

  const active = useMemo(
    () => visibleLocations(profile, locations).filter((l) => l.is_active),
    [profile, locations]
  )

  // Chips profile se bante hain, active list se nahi — warna ek company chunte
  // hi baaki chips gayab ho jate aur wapas 'All' par aane ka raasta hi na bachta
  const chipCompanies = useMemo(
    () => visibleCompanies(profile, companies),
    [profile, companies]
  )

  return (
    <div className="p-5 lg:p-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="signboard text-xl lg:text-2xl">Locations</h1>
          <p className="mt-1 text-sm text-ink-45">Every place that has a display.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setEditing({})} className="btn-primary btn-sm shrink-0">
            Add location
          </button>
        )}
      </div>

      {/* Company filter — chips, kyunki paanch hi hain */}
      <div className="mt-5 flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        <Chip active={companyId === ''} onClick={() => setCompanyId('')}>All</Chip>
        {chipCompanies.map((c) => (
          <Chip key={c.id} active={companyId === c.id} onClick={() => setCompanyId(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>

      <div className="mt-4">
        <ErrorNote message={error} onRetry={load} />
        {!locations ? <Spinner /> : active.length === 0 ? (
          <Empty
            title={isAdmin ? 'No locations here yet' : 'Nothing assigned to you'}
            hint={isAdmin
              ? 'Add the first display point for this company.'
              : 'Ask a super admin to give you access to a display.'}
            action={isAdmin ? <button onClick={() => setEditing({})} className="btn-primary">Add location</button> : null}
          />
        ) : (
          <ul className="space-y-2">
            {active.map((l) => (
              <li key={l.id} className="card p-4 flex items-center gap-3">
                <Link to={`/locations/${l.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{l.name}</p>
                  <p className="num text-xs text-ink-45 mt-0.5">
                    {l.company.code} · {l.code}
                    {l.city && ` · ${l.city}`}
                  </p>
                </Link>
                {isAdmin && (
                  <button onClick={() => setEditing(l)} className="btn-ghost btn-sm shrink-0">
                    Edit
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <LocationSheet
        row={editing}
        companies={companies}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
      />
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-3.5 rounded-lg text-[13px] font-semibold whitespace-nowrap border transition-colors ${
        active ? 'bg-white text-[#0B1030] border-white'
                : 'bg-paper-raised border-line text-ink-70 hover:bg-paper-sunk'
      }`}
    >
      {children}
    </button>
  )
}

function LocationSheet({ row, companies, onClose, onSaved }) {
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isNew = row && !row.id

  useEffect(() => {
    if (row) {
      setForm({
        company_id: row.company_id ?? companies[0]?.id ?? '',
        code: row.code ?? '',
        name: row.name ?? '',
        city: row.city ?? '',
        address: row.address ?? '',
        contact_person: row.contact_person ?? '',
        contact_phone: row.contact_phone ?? '',
      })
      setError('')
    }
  }, [row, companies])

  if (!row) return null
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save() {
    setError(''); setBusy(true)
    try {
      const payload = { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim() }
      if (isNew) await createLocation(payload)
      else await updateLocation(row.id, payload)
      onSaved()
    } catch (e) {
      // DB ka unique constraint message user ke liye bekaar hai
      setError(
        e.message.includes('locations_company_code_key')
          ? 'That code is already used by another location in this company.'
          : e.message.includes('locations_company_name_key')
          ? 'That name is already used in this company.'
          : e.message
      )
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm(`Deactivate ${row.name}? Its history stays, but it drops off the overview.`)) return
    setBusy(true)
    try { await deactivateLocation(row.id); onSaved() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add location' : 'Edit location'}
      footer={
        <>
          {!isNew && <button onClick={remove} disabled={busy} className="btn-danger mr-auto">Deactivate</button>}
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy || !form.name || !form.code} className="btn-primary">
            {busy ? 'Saving…' : isNew ? 'Add location' : 'Save changes'}
          </button>
        </>
      }
    >
      <Field label="Company">
        <select className="field [&>option]:text-[#14121A] [&>option]:bg-white" value={form.company_id} onChange={set('company_id')}>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      <Field label="Code" hint="Short and unique within the company, like KSG-01.">
        <input className="field num uppercase" value={form.code} onChange={set('code')} maxLength={20} />
      </Field>

      <Field label="Name">
        <input className="field" value={form.name} onChange={set('name')} placeholder="Kasganj main showroom" />
      </Field>

      <div className="grid sm:grid-cols-2 sm:gap-4">
        <Field label="City"><input className="field" value={form.city} onChange={set('city')} /></Field>
        <Field label="Contact"><input className="field" value={form.contact_person} onChange={set('contact_person')} /></Field>
      </div>

      <Field label="Phone">
        <input className="field num" value={form.contact_phone} onChange={set('contact_phone')} inputMode="tel" />
      </Field>

      <Field label="Address">
        <textarea rows={2} className="field h-auto py-2.5" value={form.address} onChange={set('address')} />
      </Field>

      <ErrorNote message={error} />
    </Modal>
  )
}
