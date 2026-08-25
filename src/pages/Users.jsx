import { useEffect, useState } from 'react'
import { listUsers, createUser, updateUser, getCompanies, getLocations } from '../lib/api'
import { Spinner, Empty, ErrorNote, Modal, Field } from '../components/ui'
import { useAuth } from '../lib/auth'

const ROLES = [
  { value: 'super_admin', label: 'Super admin', blurb: 'Everything, everywhere.' },
  { value: 'manager',     label: 'Manager',     blurb: 'Counts at every location in one company.' },
  { value: 'storekeeper', label: 'Storekeeper', blurb: 'Counts only at the locations you pick.' },
  { value: 'viewer',      label: 'Viewer',      blurb: 'Can look, cannot change anything.' },
]
const roleLabel = (r) => ROLES.find((x) => x.value === r)?.label ?? r

export default function Users() {
  const { isAdmin, user } = useAuth()
  const [rows, setRows] = useState(null)
  const [companies, setCompanies] = useState([])
  const [locations, setLocations] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [u, c, l] = await Promise.all([listUsers(), getCompanies(), getLocations()])
      setRows(u); setCompanies(c); setLocations(l.filter((x) => x.is_active))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="p-5 lg:p-8 max-w-lg">
        <Empty title="Admins only"
          hint="Ask a super admin if you need someone added or a role changed." />
      </div>
    )
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="signboard text-xl lg:text-2xl">People</h1>
          <p className="mt-1 text-sm text-ink-45">
            Who can see and count what.
          </p>
        </div>
        <button onClick={() => setEditing({})} className="btn-primary btn-sm shrink-0">Add person</button>
      </div>

      <ErrorNote message={error} onRetry={load} />

      <div className="mt-5">
        {!rows ? <Spinner /> : (
          <ul className="space-y-2">
            {rows.map((u) => (
              <li key={u.id} className={`card p-4 flex items-center gap-3 ${u.is_active ? '' : 'opacity-55'}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {u.full_name}
                    {u.id === user?.id && <span className="text-xs font-normal text-ink-45 ml-2">you</span>}
                  </p>
                  <p className="num text-xs text-ink-45 mt-0.5 truncate">{u.email}</p>
                  <p className="text-xs text-ink-70 mt-1.5">
                    {roleLabel(u.role)}
                    {u.role === 'manager' && u.company && ` · ${u.company.name}`}
                    {u.role === 'storekeeper' &&
                      ` · ${(u.assignments ?? []).length} location${(u.assignments ?? []).length === 1 ? '' : 's'}`}
                    {!u.is_active && ' · disabled'}
                    {!u.last_sign_in_at && ' · never signed in'}
                  </p>
                </div>
                <button onClick={() => setEditing(u)} className="btn-ghost btn-sm shrink-0">Edit</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <UserSheet row={editing} companies={companies} locations={locations} me={user?.id}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
    </div>
  )
}

function UserSheet({ row, companies, locations, me, onClose, onSaved }) {
  const [form, setForm] = useState({})
  const [picked, setPicked] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const isNew = row && !row.id

  useEffect(() => {
    if (!row) return
    setForm({
      email: row.email ?? '',
      full_name: row.full_name ?? '',
      role: row.role ?? 'storekeeper',
      scope_company_id: row.scope_company_id ?? companies[0]?.id ?? '',
      is_active: row.is_active ?? true,
    })
    setPicked(new Set((row.assignments ?? []).map((a) => a?.location?.id).filter(Boolean)))
    setError('')
    setPassword('')
  }, [row, companies])

  if (!row) return null
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const isSelf = row.id === me

  function toggle(id) {
    const next = new Set(picked)
    next.has(id) ? next.delete(id) : next.add(id)
    setPicked(next)
  }

  async function save() {
    setError(''); setBusy(true)
    try {
      const payload = {
        role: form.role,
        scope_company_id: form.role === 'manager' ? form.scope_company_id : null,
        location_ids: form.role === 'storekeeper' ? [...picked] : [],
      }
      if (isNew) {
        await createUser({
          email: form.email.trim(),
          password,
          full_name: form.full_name.trim(),
          ...payload,
        })
      } else {
        await updateUser({
          user_id: row.id,
          is_active: form.is_active,
          ...(password ? { password } : {}),
          ...payload,
        })
      }
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add someone' : row.full_name}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy || (isNew && (!form.email?.trim() || password.length < 8))} className="btn-primary">
            {busy ? 'Saving…' : isNew ? 'Create account' : 'Save changes'}
          </button>
        </>
      }>
      {isNew ? (
        <>
          <Field label="Email" hint="They'll sign in with this.">
            <input type="email" className="field" value={form.email || ''} onChange={set('email')}
              placeholder="name@rbrr.in" autoFocus />
          </Field>
          <Field label="Name">
            <input className="field" value={form.full_name || ''} onChange={set('full_name')} />
          </Field>
          <Field label="Password" hint="At least 8 characters. Share it with them directly.">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="field pr-16"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]
                           font-semibold text-ink-45 hover:text-ink">
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
        </>
      ) : (
        <>
          <p className="num text-xs text-ink-45 mb-4">{row.email}</p>
          {!isSelf && (
            <Field label="New password" hint="Leave blank to keep their current one.">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="field pr-16"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]
                             font-semibold text-ink-45 hover:text-ink">
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
          )}
        </>
      )}

      <Field label="Role">
        <select className="field [&>option]:text-[#14121A] [&>option]:bg-white" value={form.role} onChange={set('role')} disabled={isSelf}>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Field>
      <p className="-mt-3 mb-4 text-xs text-ink-45">
        {isSelf
          ? "You can't change your own role — that would lock you out."
          : ROLES.find((r) => r.value === form.role)?.blurb}
      </p>

      {form.role === 'manager' && (
        <Field label="Company">
          <select className="field [&>option]:text-[#14121A] [&>option]:bg-white" value={form.scope_company_id} onChange={set('scope_company_id')}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}

      {form.role === 'storekeeper' && (
        <div className="mb-4">
          <span className="eyebrow block mb-2">Locations</span>
          {locations.length === 0 ? (
            <p className="text-sm text-ink-45">Add a location first, then assign it here.</p>
          ) : (
            <div className="border border-line rounded-lg max-h-56 overflow-y-auto divide-y divide-line">
              {locations.map((l) => (
                <label key={l.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-paper-sunk">
                  <input type="checkbox" checked={picked.has(l.id)} onChange={() => toggle(l.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] truncate">{l.name}</span>
                    <span className="num block text-xs text-ink-45">{l.company.code} · {l.code}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {picked.size === 0 && locations.length > 0 && (
            <p className="mt-1.5 text-xs text-haldi">
              With nothing selected they'll sign in and see an empty app.
            </p>
          )}
        </div>
      )}

      {!isNew && !isSelf && (
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          <span className="text-sm">Can sign in</span>
        </label>
      )}

      <ErrorNote message={error} />
    </Modal>
  )
}
