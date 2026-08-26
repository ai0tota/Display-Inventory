import { useEffect, useMemo, useState } from 'react'
import {
  getCategories, createCategory, updateCategory,
  getGroups, createGroup, updateGroup,
  getItems, createItem, updateItem, deactivateItem,
  uploadPhoto,
} from '../lib/api'
import { Spinner, Empty, ErrorNote, Modal, Field, ImageModal } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function Catalog() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('items')

  return (
    <div className="p-5 lg:p-8 max-w-4xl">
      <h1 className="signboard text-xl lg:text-2xl">Catalog</h1>
      <p className="mt-1 text-sm text-ink-45">
        Categories hold groups, groups hold items. Item codes come from the category.
      </p>

      <div className="mt-5 flex gap-1.5">
        {[['items', 'Items'], ['groups', 'Groups'], ['categories', 'Categories']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`h-9 px-3.5 rounded-lg text-[13px] font-semibold border transition-colors ${
              tab === k ? 'bg-white text-[#0B1030] border-white'
                        : 'bg-paper-raised border-line text-ink-70 hover:bg-paper-sunk'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'items' && <ItemsTab isAdmin={isAdmin} />}
        {tab === 'groups' && <GroupsTab isAdmin={isAdmin} />}
        {tab === 'categories' && <CategoriesTab isAdmin={isAdmin} />}
      </div>
    </div>
  )
}

/* ================= ITEMS ================= */

function ItemsTab({ isAdmin }) {
  const [items, setItems] = useState(null)
  const [groups, setGroups] = useState([])
  const [search, setSearch] = useState('')
  const [groupId, setGroupId] = useState('')
  const [editing, setEditing] = useState(null)
  const [viewingImage, setViewingImage] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [i, g] = await Promise.all([getItems({ groupId: groupId || null }), getGroups()])
      setItems(i); setGroups(g.filter((x) => x.is_active))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [groupId])

  const visible = useMemo(() => {
    if (!items) return []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q))
  }, [items, search])

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <input className="field sm:flex-1" placeholder="Find an item or code"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="field [&>option]:text-[#14121A] [&>option]:bg-white sm:w-56" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.category.name} › {g.name}</option>
          ))}
        </select>
        {isAdmin && (
          <button onClick={() => setEditing({})} disabled={!groups.length}
            className="btn-primary shrink-0">Add item</button>
        )}
      </div>

      <ErrorNote message={error} onRetry={load} />

      <div className="mt-4">
        {!items ? <Spinner /> : visible.length === 0 ? (
          <Empty
            title={groups.length ? 'No items yet' : 'Create a group first'}
            hint={groups.length
              ? 'Add the products that should sit on your displays.'
              : 'Items live inside groups, and groups live inside categories.'}
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((i) => (
              <li key={i.id} className="card p-3.5 flex items-center gap-3.5">
                {i.photo_url
                  ? <img src={i.photo_url} alt={i.name} loading="lazy"
                      onClick={() => setViewingImage(i.photo_url)}
                      className="w-11 h-11 rounded-lg object-cover bg-paper-sunk shrink-0 cursor-zoom-in hover:opacity-90 transition-opacity" />
                  : <div className="w-11 h-11 rounded-lg bg-paper-sunk border border-line shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[15px] truncate">{i.name}</p>
                  <p className="num text-xs text-ink-45 mt-0.5">
                    {i.item_code} · {i.group.category.name} › {i.group.name}
                    {i.pack_size && ` · ${i.pack_size}`}
                  </p>
                </div>
                {isAdmin && (
                  <button onClick={() => setEditing(i)} className="btn-ghost btn-sm shrink-0">Edit</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ItemSheet row={editing} groups={groups}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }} />

      <ImageModal src={viewingImage} onClose={() => setViewingImage(null)} />
    </>
  )
}

function ItemSheet({ row, groups, onClose, onSaved }) {
  const [form, setForm] = useState({})
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isNew = row && !row.id

  useEffect(() => {
    if (row) {
      setForm({
        group_id: row.group_id ?? groups[0]?.id ?? '',
        name: row.name ?? '',
        uom: row.uom ?? 'PCS',
        pack_size: row.pack_size ?? '',
        description: row.description ?? '',
      })
      setFile(null); setError('')
    }
  }, [row, groups])

  if (!row) return null
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save() {
    setError(''); setBusy(true)
    try {
      const photo_url = file ? await uploadPhoto(file, 'items') : undefined
      const payload = { ...form, name: form.name.trim() }
      if (photo_url) payload.photo_url = photo_url
      // item_code jaan boojh kar nahi bhej rahe — DB trigger banata hai
      if (isNew) await createItem(payload)
      else await updateItem(row.id, payload)
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm(`Retire ${row.name}? It stays on past records but can't be added to new displays.`)) return
    setBusy(true)
    try { await deactivateItem(row.id); onSaved() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add item' : row.name}
      footer={
        <>
          {!isNew && <button onClick={remove} disabled={busy} className="btn-danger mr-auto">Retire</button>}
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy || !form.name} className="btn-primary">
            {busy ? 'Saving…' : isNew ? 'Add item' : 'Save changes'}
          </button>
        </>
      }>
      {!isNew && (
        <p className="num text-xs text-ink-45 mb-4">
          {row.item_code} · code never changes, even if you move the item
        </p>
      )}

      <Field label="Group">
        <select className="field [&>option]:text-[#14121A] [&>option]:bg-white" value={form.group_id} onChange={set('group_id')}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.category.name} › {g.name}</option>)}
        </select>
      </Field>

      <Field label="Name">
        <input className="field" value={form.name} onChange={set('name')} placeholder="Herbal gulal red" />
      </Field>

      <div className="grid sm:grid-cols-2 sm:gap-4">
        <Field label="Unit">
          <select className="field [&>option]:text-[#14121A] [&>option]:bg-white" value={form.uom} onChange={set('uom')}>
            {['PCS', 'GM', 'KG', 'ML', 'LTR', 'BOX', 'PKT'].map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Pack size" hint="Like 100g or 1kg.">
          <input className="field" value={form.pack_size} onChange={set('pack_size')} />
        </Field>
      </div>

      <Field label="Photo" hint="Helps whoever is counting recognise it on the shelf.">
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-ink-70 file:mr-3 file:h-9 file:px-3
                     file:rounded-lg file:border file:border-line file:bg-paper-sunk
                     file:text-[13px] file:font-semibold file:text-ink" />
      </Field>

      <ErrorNote message={error} />
    </Modal>
  )
}

/* ================= GROUPS ================= */

function GroupsTab({ isAdmin }) {
  const [groups, setGroups] = useState(null)
  const [cats, setCats] = useState([])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [g, c] = await Promise.all([getGroups(), getCategories()])
      setGroups(g); setCats(c.filter((x) => x.is_active))
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <>
      {isAdmin && (
        <button onClick={() => setEditing({})} className="btn-primary btn-sm mb-4">Add group</button>
      )}
      <ErrorNote message={error} onRetry={load} />
      {!groups ? <Spinner /> : groups.filter((g) => g.is_active).length === 0 ? (
        <Empty title="No groups yet" hint="Groups sit between a category and its items — like Gulal under Holi." />
      ) : (
        <ul className="space-y-2">
          {groups.filter((g) => g.is_active).map((g) => (
            <li key={g.id} className="card p-3.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{g.name}</p>
                <p className="text-xs text-ink-45 mt-0.5">
                  {g.category.name} · <span className="num">{g.category.code_prefix}</span>
                </p>
              </div>
              {isAdmin && <button onClick={() => setEditing(g)} className="btn-ghost btn-sm">Edit</button>}
            </li>
          ))}
        </ul>
      )}

      <SimpleSheet
        row={editing} title="group"
        fields={[
          { key: 'category_id', label: 'Category', type: 'select', options: cats.map((c) => ({ value: c.id, label: c.name })) },
          { key: 'name', label: 'Name', placeholder: 'Gulal' },
        ]}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
        create={createGroup} update={updateGroup}
      />
    </>
  )
}

/* ================= CATEGORIES ================= */

function CategoriesTab({ isAdmin }) {
  const [cats, setCats] = useState(null)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try { setCats(await getCategories()) } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <>
      {isAdmin && (
        <button onClick={() => setEditing({})} className="btn-primary btn-sm mb-4">Add category</button>
      )}
      <ErrorNote message={error} onRetry={load} />
      {!cats ? <Spinner /> : (
        <ul className="space-y-2">
          {cats.filter((c) => c.is_active).map((c) => (
            <li key={c.id} className="card p-3.5 flex items-center gap-3">
              <span className="num text-[13px] font-semibold h-8 px-2.5 rounded-lg
                               bg-neel/10 text-neel grid place-items-center shrink-0">
                {c.code_prefix}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{c.name}</p>
                {c.description && <p className="text-xs text-ink-45 truncate mt-0.5">{c.description}</p>}
              </div>
              {isAdmin && <button onClick={() => setEditing(c)} className="btn-ghost btn-sm">Edit</button>}
            </li>
          ))}
        </ul>
      )}

      <SimpleSheet
        row={editing} title="category"
        fields={[
          { key: 'name', label: 'Name', placeholder: 'Holi' },
          { key: 'code_prefix', label: 'Code prefix',
            hint: '2–4 capital letters. Items become HOL-0001, HOL-0002 and so on. This can never change later.',
            placeholder: 'HOL', maxLength: 4, uppercase: true, lockOnEdit: true },
          { key: 'description', label: 'Description', optional: true },
        ]}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load() }}
        create={createCategory} update={updateCategory}
      />
    </>
  )
}

/* ---- Chhota reusable form. Groups aur categories dono simple hain,
        do alag components likhne ka koi fayda nahi. ---- */

function SimpleSheet({ row, title, fields, onClose, onSaved, create, update }) {
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isNew = row && !row.id

  useEffect(() => {
    if (row) {
      const init = {}
      for (const f of fields) {
        init[f.key] = row[f.key] ?? (f.type === 'select' ? f.options[0]?.value ?? '' : '')
      }
      setForm(init); setError('')
    }
  }, [row])

  if (!row) return null

  async function save() {
    setError(''); setBusy(true)
    try {
      const payload = {}
      for (const f of fields) {
        // Prefix edit par bhejte hi nahi — DB me codes usi se bane hue hain
        if (f.lockOnEdit && !isNew) continue
        let v = (form[f.key] ?? '').toString().trim()
        if (f.uppercase) v = v.toUpperCase()
        if (v || !f.optional) payload[f.key] = v || null
      }
      if (isNew) await create(payload)
      else await update(row.id, payload)
      onSaved()
    } catch (e) {
      setError(
        e.message.includes('categories_prefix_fmt')
          ? 'Prefix must be 2–4 capital letters, like HOL.'
          : e.message.includes('_key')
          ? 'That name or prefix is already taken.'
          : e.message
      )
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? `Add ${title}` : `Edit ${title}`}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : isNew ? `Add ${title}` : 'Save changes'}
          </button>
        </>
      }>
      {fields.map((f) => {
        const locked = f.lockOnEdit && !isNew
        return (
          <Field key={f.key} label={f.label}
            hint={locked ? 'Locked — existing item codes are built from this.' : f.hint}>
            {f.type === 'select' ? (
              <select className="field [&>option]:text-[#14121A] [&>option]:bg-white" value={form[f.key] ?? ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                className={`field ${f.uppercase ? 'num uppercase' : ''}`}
                placeholder={f.placeholder} maxLength={f.maxLength} disabled={locked}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            )}
          </Field>
        )
      })}
      <ErrorNote message={error} />
    </Modal>
  )
}
