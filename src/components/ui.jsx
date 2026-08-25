import { useEffect, useRef } from 'react'

/* ---------------- Status vocabulary ----------------
   Ek hi jagah define hai. Rang, label, order — sab yahin se aata hai,
   taaki dashboard, detail aur reports teeno ek hi bhasha bolein. */

// `color` sirf PigmentBar ke liye hai — wo santript rehna chahiye.
// `tint` chip ke liye: dark surface par halka wash + safed text.
export const STATUS = {
  ok:       { label: 'Stocked',  color: '#4C7A3F', tint: 'bg-[#4C7A3F]/20 text-white border-[#4C7A3F]/50' },
  short:    { label: 'Short',    color: '#E8A317', tint: 'bg-[#E8A317]/20 text-white border-[#E8A317]/50' },
  missing:  { label: 'Missing',  color: '#D1345B', tint: 'bg-[#D1345B]/20 text-white border-[#D1345B]/50' },
  excess:   { label: 'Excess',   color: '#C25A1F', tint: 'bg-[#C25A1F]/20 text-white border-[#C25A1F]/50' },
  extra:    { label: 'Unplanned',color: '#8C8898', tint: 'bg-[#8C8898]/20 text-white border-[#8C8898]/50' },
  inactive: { label: 'Inactive', color: '#C9C6D1', tint: 'bg-[#C9C6D1]/20 text-white border-[#C9C6D1]/50' },
}

// Sabse buri khabar pehle. Ye order dashboard aur bar dono me chalta hai.
export const STATUS_ORDER = ['missing', 'short', 'excess', 'extra', 'ok', 'inactive']

/* ---------------- Move vocabulary ----------------
   Kyon hila — direction ke hisaab se. STATUS ki tarah ek hi jagah, taaki
   MoveSheet ka dropdown aur Activity ka badge kabhi alag bhasha na bolein. */

export const MOVE_REASONS = {
  in: [
    ['new_stock',            'New stock arrived'],
    ['return_from_customer', 'Returned by customer'],
    ['transfer_in',          'Moved in from another display'],
  ],
  out: [
    ['sold',              'Sold'],
    ['damaged',           'Damaged'],
    ['expired',           'Expired'],
    ['transfer_out',      'Moved to another display'],
    ['returned_to_store', 'Sent back to store'],
  ],
}

export const REASON_LABEL = Object.fromEntries([...MOVE_REASONS.in, ...MOVE_REASONS.out])

export function StatusChip({ status }) {
  const s = STATUS[status] ?? STATUS.inactive
  return (
    <span className={`inline-flex items-center h-6 px-2 rounded-full border text-[11px] font-semibold ${s.tint}`}>
      {s.label}
    </span>
  )
}

/* ---------------- SIGNATURE: Pigment bar ----------------
   Har location ek strip banti hai — segment ki chaudai us status ke
   items ke anupaat me. Ye sajawat nahi, data ka aakar hai:
   khaali/gulaabi strip = khokhli location, hari strip = bhari location. */

export function PigmentBar({ counts, height = 8 }) {
  const total = STATUS_ORDER.reduce((sum, k) => sum + (counts[k] || 0), 0)

  if (!total) {
    return (
      <div
        className="w-full rounded-full bg-paper-sunk border border-dashed border-line-strong"
        style={{ height }}
        role="img"
        aria-label="Is location par abhi koi item set nahi hai"
      />
    )
  }

  const label = STATUS_ORDER
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${STATUS[k].label}`)
    .join(', ')

  return (
    <div
      className="w-full flex rounded-full overflow-hidden bg-paper-sunk"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      {STATUS_ORDER.map((k) =>
        counts[k] ? (
          <div
            key={k}
            title={`${counts[k]} ${STATUS[k].label}`}
            style={{ width: `${(counts[k] / total) * 100}%`, background: STATUS[k].color }}
          />
        ) : null
      )}
    </div>
  )
}

/* ---------------- Feedback states ---------------- */

export function Spinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="h-6 w-6 rounded-full border-2 border-line border-t-neel animate-spin" />
      <span className="sr-only">Load ho raha hai</span>
    </div>
  )
}

// Khaali screen ek nyota hai, ek maafi nahi — isliye hamesha ek action.
export function Empty({ title, hint, action }) {
  return (
    <div className="card p-10 text-center">
      <p className="signboard text-lg">{title}</p>
      {hint && <p className="mt-1.5 text-sm text-ink-45 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

// Error batata hai kya hua aur aage kya karna hai. Maafi nahi maangta.
export function ErrorNote({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="rounded-lg border border-gulal/45 bg-gulal/15 px-4 py-3 text-sm text-white flex items-start justify-between gap-4">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline shrink-0">
          Try again
        </button>
      )}
    </div>
  )
}

/* ---------------- Modal ---------------- */

export function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      {/* Mobile pe neeche se sheet, desktop pe beech me dialog */}
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass backdrop-blur-3xl relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-card
                   shadow-pop max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
          <h2 className="signboard text-base">{title}</h2>
          <button onClick={onClose} className="text-ink-45 hover:text-ink text-xl leading-none px-1"
            aria-label="Band karo">×</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-line flex gap-2 justify-end shrink-0">{footer}</div>
        )}
      </div>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block mb-4">
      <span className="eyebrow block mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1 text-xs text-ink-45">{hint}</span>}
    </label>
  )
}
