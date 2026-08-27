import { useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getAuditLog, getLocations } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Spinner, Empty, ErrorNote, ImageModal, REASON_LABEL } from '../components/ui'

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
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState(null)
  const [locations, setLocations] = useState([])
  const [locationId, setLocationId] = useState('')
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [viewingImage, setViewingImage] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)

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

  // CSV aur PDF dono ek hi tasveer dikhate hain — do jagah banate to
  // ek din columns alag ho jate
  const EXPORT_HEAD = ['When', 'Company', 'Location', 'Item code', 'Item', 'What happened',
                       'Expected before', 'Expected after', 'Counted before', 'Counted after',
                       'By', 'Note']

  function exportRows(when) {
    return visible.map((r) => [
      when(r.created_at),
      r.location?.company?.code ?? '',
      r.location?.name ?? '',
      r.item?.item_code ?? '',
      r.item?.name ?? '',
      ACTION_LABEL[r.action] ?? r.action,
      num(r.old_expected), num(r.new_expected),
      num(r.old_actual), num(r.new_actual),
      r.person_name ?? '', r.notes ?? '',
    ])
  }

  function exportCsv() {
    const head = EXPORT_HEAD
    const body = exportRows((ts) => new Date(ts).toISOString())
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

  // Bara table hai — portrait me columns kuchal jate hain, isliye landscape.
  // Photos pehle data-URL me laate hain: jsPDF khud remote URL fetch nahi karta.
  async function exportPdf() {
    setPdfBusy(true)
    setError('')
    try {
      const thumbs = await loadThumbs(visible.map((r) => r.item?.photo_url))

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const printedOn = new Date()

      doc.setFontSize(14)
      doc.text('Display Activity', 40, 40)

      doc.setFontSize(9)
      doc.setTextColor(120)
      const picked = locationId ? locations.find((l) => l.id === locationId) : null
      const scope = [
        picked ? `${picked.company.code} — ${picked.name}` : 'All locations',
        action ? (ACTION_LABEL[action] ?? action) : 'Everything',
        `${visible.length} ${visible.length === 1 ? 'entry' : 'entries'}`,
        printedOn.toLocaleString('en-IN'),
      ].join('  ·  ')
      doc.text(scope, 40, 56)
      doc.setTextColor(0)

      const head = [...EXPORT_HEAD]
      head.splice(PHOTO_COL, 0, 'Photo')

      const body = exportRows((ts) =>
        new Date(ts).toLocaleString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })).map((row) => {
          const cells = row.map((c) => (c === '' || c === null ? '' : String(c)))
          cells.splice(PHOTO_COL, 0, '') // khaali khana — tasveer didDrawCell me chipakti hai
          return cells
        })

      autoTable(doc, {
        head: [head],
        body,
        startY: 72,
        margin: { top: 72, left: 40, right: 40, bottom: 40 },
        styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [20, 18, 26], textColor: 255, fontStyle: 'bold', valign: 'middle' },
        alternateRowStyles: { fillColor: [246, 245, 248] },
        columnStyles: {
          0: { cellWidth: 74 },                        // When
          1: { cellWidth: 44 },                        // Company
          2: { cellWidth: 72 },                        // Location
          3: { cellWidth: 40, minCellHeight: THUMB_PT + 8 }, // Photo
          4: { cellWidth: 52 },                        // Item code
          5: { cellWidth: 110 },                       // Item
          6: { cellWidth: 62 },                        // What happened
          7: { cellWidth: 38, halign: 'right' },
          8: { cellWidth: 38, halign: 'right' },
          9: { cellWidth: 38, halign: 'right' },
          10: { cellWidth: 38, halign: 'right' },
          11: { cellWidth: 52 },                       // By
          12: { cellWidth: 'auto' },                   // Note
        },
        didDrawCell: (data) => {
          if (data.section !== 'body' || data.column.index !== PHOTO_COL) return
          const src = thumbs.get(visible[data.row.index]?.item?.photo_url)
          if (!src) return
          // jsPDF ek hi data-URL ko dobara embed nahi karta, isliye repeat
          // items file ka size nahi badhate
          doc.addImage(
            src, 'JPEG',
            data.cell.x + (data.cell.width - THUMB_PT) / 2,
            data.cell.y + (data.cell.height - THUMB_PT) / 2,
            THUMB_PT, THUMB_PT,
          )
        },
        didDrawPage: (data) => {
          const { pageSize } = doc.internal
          doc.setFontSize(8)
          doc.setTextColor(140)
          doc.text(
            `Page ${data.pageNumber}`,
            pageSize.getWidth() - 40,
            pageSize.getHeight() - 20,
            { align: 'right' },
          )
          doc.setTextColor(0)
        },
      })

      doc.save(`display-activity-${printedOn.toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      setError(e.message)
    } finally {
      setPdfBusy(false)
    }
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
          <div className="flex gap-2 shrink-0">
            <button onClick={exportCsv} className="btn-ghost btn-sm">Export CSV</button>
            {isAdmin && (
              <button onClick={exportPdf} disabled={pdfBusy} className="btn-ghost btn-sm">
                {pdfBusy ? 'Building…' : 'Export PDF'}
              </button>
            )}
          </div>
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

                <div className="flex items-center gap-2.5 mt-1.5">
                  {r.item?.photo_url && (
                    <img
                      src={r.item.photo_url}
                      alt={r.item?.name || 'Item'}
                      loading="lazy"
                      onClick={() => setViewingImage(r.item?.photo_url)}
                      className="w-8 h-8 rounded-md object-cover bg-paper-sunk shrink-0
                                 cursor-zoom-in hover:opacity-90 transition-opacity"
                    />
                  )}
                  <p className="text-[15px] truncate min-w-0">
                    {r.item?.name}
                    <span className="num text-xs text-ink-45 ml-1.5">{r.item?.item_code}</span>
                  </p>
                </div>
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
                      <button type="button" onClick={() => setViewingImage(r.photo_url)}
                        className="text-xs font-semibold text-neel ml-auto shrink-0
                                   cursor-zoom-in hover:opacity-90 transition-opacity">Photo</button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ImageModal src={viewingImage} onClose={() => setViewingImage(null)} />
    </div>
  )
}

/* ---------------- PDF thumbnails ----------------
   jsPDF sirf wahi tasveer laga sakta hai jo pehle se memory me ho, isliye
   har photo ko blob se object-URL par utha kar canvas se JPEG data-URL
   banate hain. Object-URL same-origin hota hai — canvas taint nahi hota,
   chahe storage bucket ke CORS headers kaisi bhi ho. */

const PHOTO_COL = 3   // 'Item code' se theek pehle
const THUMB_PT = 26   // PDF me chhapne ka naap (points)
const THUMB_PX = 96   // 2x se thoda upar — print par saaf, file par halka
const THUMB_CONCURRENCY = 6

async function loadThumbs(urls) {
  // Ek hi item bees baar log me aata hai — har URL sirf ek baar uthao
  const unique = [...new Set(urls.filter(Boolean))]
  const out = new Map()

  for (let i = 0; i < unique.length; i += THUMB_CONCURRENCY) {
    const batch = unique.slice(i, i + THUMB_CONCURRENCY)
    const done = await Promise.all(batch.map(toJpegDataUrl))
    batch.forEach((url, n) => { if (done[n]) out.set(url, done[n]) })
  }
  return out
}

// Ek photo na khule to poora PDF nahi rukna chahiye — us khane ko khaali
// chhod dete hain
async function toJpegDataUrl(url) {
  let objectUrl
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    objectUrl = URL.createObjectURL(await res.blob())

    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode failed'))
      el.src = objectUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = THUMB_PX
    canvas.height = THUMB_PX
    const ctx = canvas.getContext('2d')
    // JPEG me alpha nahi hota — safed background warna kaala pad jata hai
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, THUMB_PX, THUMB_PX)

    // object-fit: cover — bina khinche bharo
    const scale = Math.max(THUMB_PX / img.naturalWidth, THUMB_PX / img.naturalHeight)
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    ctx.drawImage(img, (THUMB_PX - w) / 2, (THUMB_PX - h) / 2, w, h)

    return canvas.toDataURL('image/jpeg', 0.72)
  } catch {
    return null
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
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
