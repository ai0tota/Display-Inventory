import { useEffect, useState } from 'react'
import {
  getTemplates, createTemplate, getTemplateItems, addTemplateItem,
  removeTemplateItem, applyTemplate, getItems, getLocations,
} from '../lib/api'
import { Spinner, Empty, ErrorNote, Modal, Field } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function Templates() {
  const { isAdmin } = useAuth()
  const [templates, setTemplates] = useState(null)
  const [open, setOpen] = useState(null)   // template being edited
  const [applying, setApplying] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try { setTemplates(await getTemplates()) } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="p-5 lg:p-8 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="signboard text-xl lg:text-2xl">Templates</h1>
          <p className="mt-1 text-sm text-ink-45">
            A reusable list of what a display should carry. Build it once, apply it to many locations.
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setCreating(true)} className="btn-primary btn-sm shrink-0">
            New template
          </button>
        )}
      </div>

      <ErrorNote message={error} onRetry={load} />

      <div className="mt-5">
        {!templates ? <Spinner /> : templates.length === 0 ? (
          <Empty
            title="No templates yet"
            hint="Without one you'd set the expected quantity for every item at every location by hand."
            action={isAdmin ? <button onClick={() => setCreating(true)} className="btn-primary">New template</button> : null}
          />
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="card p-4 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{t.name}</p>
                  <p className="num text-xs text-ink-45 mt-0.5">
                    {t.items?.[0]?.count ?? 0} items
                  </p>
                  {t.description && <p className="text-xs text-ink-45 mt-1 truncate">{t.description}</p>}
                </div>
                {isAdmin && (
                  <>
                    <button onClick={() => setOpen(t)} className="btn-ghost btn-sm">Edit items</button>
                    <button onClick={() => setApplying(t)} className="btn-primary btn-sm">Apply</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <NewTemplate open={creating} onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); load() }} />
      <TemplateItems template={open} onClose={() => { setOpen(null); load() }} />
      <ApplySheet template={applying} onClose={() => setApplying(null)} />
    </div>
  )
}

function NewTemplate({ open, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (open) { setName(''); setDescription(''); setError('') } }, [open])

  async function save() {
    setError(''); setBusy(true)
    try { await createTemplate({ name: name.trim(), description: description.trim() || null }); onSaved() }
    catch (e) { setError(e.message.includes('_key') ? 'A template with that name already exists.' : e.message) }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="New template"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy || !name.trim()} className="btn-primary">
            {busy ? 'Saving…' : 'Create template'}
          </button>
        </>
      }>
      <Field label="Name"><input className="field" value={name}
        onChange={(e) => setName(e.target.value)} placeholder="Standard Holi display" /></Field>
      <Field label="Description" hint="Optional — a note about when to use this one.">
        <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <ErrorNote message={error} />
    </Modal>
  )
}

/* ---- Template ke items ---- */

function TemplateItems({ template, onClose }) {
  const [rows, setRows] = useState(null)
  const [allItems, setAllItems] = useState([])
  const [pick, setPick] = useState('')
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [r, i] = await Promise.all([getTemplateItems(template.id), getItems()])
      setRows(r); setAllItems(i)
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { if (template) { setRows(null); load() } }, [template])

  if (!template) return null

  const inTemplate = new Set((rows ?? []).map((r) => r.item_id))
  const available = allItems.filter((i) => !inTemplate.has(i.id))

  async function add() {
    if (!pick) return
    setBusy(true); setError('')
    try {
      await addTemplateItem({ template_id: template.id, item_id: pick, expected_qty: Number(qty) })
      setPick(''); setQty('1'); await load()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function drop(id) {
    setBusy(true)
    try { await removeTemplateItem(id); await load() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={template.name}
      footer={<button onClick={onClose} className="btn-primary">Done</button>}>
      <div className="flex gap-2 mb-4">
        <select className="field [&>option]:text-[#14121A] [&>option]:bg-white flex-1 min-w-0" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Add an item…</option>
          {available.map((i) => (
            <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>
          ))}
        </select>
        <input type="number" min="0" step="0.001" inputMode="decimal"
          className="field num w-20 shrink-0" value={qty} onChange={(e) => setQty(e.target.value)} />
        <button onClick={add} disabled={busy || !pick} className="btn-primary shrink-0">Add</button>
      </div>

      <ErrorNote message={error} />

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <p className="text-sm text-ink-45 py-6 text-center">
          No items yet. Add the products this display should carry.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="py-2.5 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium truncate">{r.item.name}</p>
                <p className="num text-xs text-ink-45">{r.item.item_code}</p>
              </div>
              <span className="num text-sm font-semibold">
                {Number(r.expected_qty)} {r.item.uom}
              </span>
              <button onClick={() => drop(r.id)} disabled={busy}
                className="text-ink-45 hover:text-gulal text-lg px-1" aria-label="Remove">×</button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

/* ---- Bulk apply ---- */

function ApplySheet({ template, onClose }) {
  const [locations, setLocations] = useState([])
  const [picked, setPicked] = useState(new Set())
  const [mode, setMode] = useState('add_only')
  const [zeroMissing, setZeroMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!template) return
    setPicked(new Set()); setResult(null); setError(''); setMode('add_only'); setZeroMissing(false)
    getLocations().then((l) => setLocations(l.filter((x) => x.is_active))).catch((e) => setError(e.message))
  }, [template])

  if (!template) return null

  function toggle(id) {
    const next = new Set(picked)
    next.has(id) ? next.delete(id) : next.add(id)
    setPicked(next)
  }

  async function run() {
    setBusy(true); setError('')
    try {
      const r = await applyTemplate({
        templateId: template.id, locationIds: [...picked], mode, zeroMissing,
      })
      setResult(r)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Apply ${template.name}`}
      footer={
        result ? <button onClick={onClose} className="btn-primary">Done</button> : (
          <>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={run} disabled={busy || picked.size === 0} className="btn-primary">
              {busy ? 'Applying…' : `Apply to ${picked.size || 'no'} location${picked.size === 1 ? '' : 's'}`}
            </button>
          </>
        )
      }>
      {result ? (
        <div>
          <p className="signboard text-base">Applied</p>
          <ul className="num text-sm mt-3 space-y-1 text-ink-70">
            <li>{result.added} items added</li>
            <li>{result.updated} quantities changed</li>
            <li>{result.skipped} left alone</li>
            {result.zeroed > 0 && <li>{result.zeroed} set to zero</li>}
          </ul>
        </div>
      ) : (
        <>
          <Field label="If an item is already there">
            <select className="field [&>option]:text-[#14121A] [&>option]:bg-white" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="add_only">Leave it as it is</option>
              <option value="overwrite">Reset it to the template quantity</option>
            </select>
          </Field>

          <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
            <input type="checkbox" checked={zeroMissing} className="mt-0.5"
              onChange={(e) => setZeroMissing(e.target.checked)} />
            <span className="text-sm">
              Set anything not in this template to zero
              <span className="block text-xs text-ink-45 mt-0.5">
                What's physically on the shelf stays recorded — it just shows as unplanned.
              </span>
            </span>
          </label>

          <span className="eyebrow block mb-2">Locations</span>
          <div className="border border-line rounded-lg max-h-64 overflow-y-auto divide-y divide-line">
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

          {locations.length > 1 && (
            <button
              onClick={() => setPicked(picked.size === locations.length ? new Set() : new Set(locations.map((l) => l.id)))}
              className="mt-2 text-[13px] font-semibold text-neel">
              {picked.size === locations.length ? 'Clear all' : 'Select all'}
            </button>
          )}

          <ErrorNote message={error} />
        </>
      )}
    </Modal>
  )
}
