import { supabase } from './supabase'

/**
 * Saari database calls yahan. Components sirf inhe call karte hain.
 * Fayda: query badalni ho to ek jagah badlo, 7 screens me dhoondho mat.
 */

// Supabase error object ko normal JS Error me badalta hai taaki
// har caller ko `if (error)` check na likhna pade.
function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

/* ---------------- Companies & Locations ---------------- */

export const getCompanies = () =>
  supabase.from('companies').select('*').eq('is_active', true)
    .order('sort_order').then(unwrap)

export const getLocations = (companyId = null) => {
  let q = supabase
    .from('locations')
    .select('*, company:companies(id, code, name)')
    .order('name')
  if (companyId) q = q.eq('company_id', companyId)
  return q.then(unwrap)
}

export const getLocation = (id) =>
  supabase.from('locations').select('*, company:companies(id, code, name)')
    .eq('id', id).single().then(unwrap)

export const createLocation = (row) =>
  supabase.from('locations').insert(row).select().single().then(unwrap)

export const updateLocation = (id, patch) =>
  supabase.from('locations').update(patch).eq('id', id).select().single().then(unwrap)

// Hard delete nahi. is_active=false karne se history bachi rehti hai
// aur DB ka `on delete restrict` bhi beech me nahi aata.
export const deactivateLocation = (id) =>
  supabase.from('locations').update({ is_active: false }).eq('id', id).then(unwrap)

/* ---------------- Taxonomy ---------------- */

export const getCategories = () =>
  supabase.from('categories')
    .select('*, groups(count)')
    .order('sort_order').then(unwrap)

export const createCategory = (row) =>
  supabase.from('categories').insert(row).select().single().then(unwrap)

export const updateCategory = (id, patch) =>
  supabase.from('categories').update(patch).eq('id', id).select().single().then(unwrap)

export const getGroups = (categoryId = null) => {
  let q = supabase.from('groups')
    .select('*, category:categories(id, name, code_prefix), items(count)')
    .order('name')
  if (categoryId) q = q.eq('category_id', categoryId)
  return q.then(unwrap)
}

export const createGroup = (row) =>
  supabase.from('groups').insert(row).select().single().then(unwrap)

export const getItems = ({ groupId = null, search = '' } = {}) => {
  let q = supabase
    .from('items')
    .select('*, group:groups(id, name, category:categories(id, name, code_prefix))')
    .eq('is_active', true)
    .order('item_code')
  if (groupId) q = q.eq('group_id', groupId)
  if (search) q = q.or(`name.ilike.%${search}%,item_code.ilike.%${search}%`)
  return q.then(unwrap)
}

// item_code jaan boojh kar nahi bhej rahe — DB trigger khud banata hai.
export const createItem = (row) =>
  supabase.from('items').insert(row).select().single().then(unwrap)

export const updateItem = (id, patch) =>
  supabase.from('items').update(patch).eq('id', id).select().single().then(unwrap)

/* ---------------- Display stock ---------------- */

export const getLocationStock = (locationId) =>
  supabase
    .from('display_stock')
    .select('*, item:items(id, item_code, name, uom, pack_size, photo_url, group:groups(id, name, category:categories(id, name)))')
    .eq('location_id', locationId)
    .then(unwrap)

/**
 * Ek hi RPC se stock update + audit log. Do alag calls karte to
 * ek fail hone par audit log aur reality alag ho jate.
 */
export const recordCheck = ({
  locationId, itemId, actualQty = null, expectedQty = null,
  action = 'verify', personName = null, photoUrl = null, notes = null,
}) =>
  supabase.rpc('record_display_check', {
    p_location_id: locationId,
    p_item_id: itemId,
    p_actual_qty: actualQty,
    p_expected_qty: expectedQty,
    p_action: action,
    p_person_name: personName,
    p_photo_url: photoUrl,
    p_notes: notes,
  }).then(unwrap)

/**
 * recordCheck absolute value set karta hai (ginti ke baad).
 * Ye delta lagata hai (+ aaya / - gaya). Do alag kaam.
 */
export const moveStock = ({
  locationId, itemId, direction, qty,
  reason = null, personName = null, photoUrl = null, notes = null,
}) =>
  supabase.rpc('move_display_stock', {
    p_location_id: locationId,
    p_item_id: itemId,
    p_direction: direction,
    p_qty: qty,
    p_reason: reason,
    p_person_name: personName,
    p_photo_url: photoUrl,
    p_notes: notes,
  }).then(unwrap)

/**
 * Kai items ek saath display par. Server par ek hi transaction —
 * ek item galat hua to poora batch rollback, aadha kaam nahi hota.
 */
export const bulkStockIn = ({ locationId, items, reason = 'new_stock',
                              personName = null, notes = null }) =>
  supabase.rpc('bulk_stock_in', {
    p_location_id: locationId,
    p_items: items,              // [{ item_id, qty }]
    p_reason: reason,
    p_person_name: personName,
    p_notes: notes,
  }).then(unwrap)

/* ---------------- Templates ---------------- */

export const getTemplates = () =>
  supabase.from('planogram_templates')
    .select('*, items:planogram_template_items(count)')
    .eq('is_active', true).order('name').then(unwrap)

export const getTemplateItems = (templateId) =>
  supabase.from('planogram_template_items')
    .select('*, item:items(id, item_code, name, uom, pack_size)')
    .eq('template_id', templateId).then(unwrap)

export const createTemplate = (row) =>
  supabase.from('planogram_templates').insert(row).select().single().then(unwrap)

export const addTemplateItem = (row) =>
  supabase.from('planogram_template_items').insert(row).select().single().then(unwrap)

export const removeTemplateItem = (id) =>
  supabase.from('planogram_template_items').delete().eq('id', id).then(unwrap)

export const applyTemplate = ({ templateId, locationIds, mode = 'add_only', zeroMissing = false }) =>
  supabase.rpc('apply_template_to_locations', {
    p_template_id: templateId,
    p_location_ids: locationIds,
    p_mode: mode,
    p_zero_missing: zeroMissing,
  }).then(unwrap)

/* ---------------- Audit & reporting ---------------- */

export const getAuditLog = ({ locationId = null, limit = 100 } = {}) => {
  let q = supabase
    .from('display_audit_log')
    .select('*, item:items(item_code, name, photo_url), location:locations(id, company_id, name, company:companies(code))')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (locationId) q = q.eq('location_id', locationId)
  return q.then(unwrap)
}

/**
 * Dashboard ke liye har location ka status breakdown.
 * Ek hi query me sab kheench kar client par group karte hain —
 * data ka paimana chhota hai (locations x items), isliye ye theek hai.
 * Agar kabhi lakhon rows ho jayein to ise SQL view me badal dena.
 */
export const getOverview = async () => {
  const rows = await supabase
    .from('display_stock')
    .select('status, location_id, location:locations(id, name, code, is_active, company:companies(id, code, name, sort_order))')
    .then(unwrap)

  const byLocation = new Map()
  for (const r of rows) {
    if (!r.location?.is_active) continue
    if (!byLocation.has(r.location_id)) {
      byLocation.set(r.location_id, {
        location: r.location,
        total: 0,
        ok: 0, short: 0, missing: 0, excess: 0, extra: 0, inactive: 0,
      })
    }
    const bucket = byLocation.get(r.location_id)
    bucket.total += 1
    bucket[r.status] += 1
  }
  return [...byLocation.values()]
}

/* ---------------- Storage ---------------- */

export const uploadPhoto = async (file, folder = 'checks') => {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('item-photos').upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from('item-photos').getPublicUrl(path).data.publicUrl
}

/* ---------------- Users (admin only) ----------------
   Ye Edge Function ke through jaate hain, seedha table par nahi.
   Naya user banane ke liye service_role key chahiye — wo key browser me
   aa gayi to koi bhi RLS bypass kar lega. Admin khud email + password banata hai; koi invite mail nahi jaata. */

async function adminFn(payload) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in required')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'Request failed')
  return body
}

export const listUsers  = () => adminFn({ action: 'list' }).then((r) => r.users)
export const createUser = (payload) => adminFn({ action: 'create', ...payload })
export const updateUser = (payload) => adminFn({ action: 'update', ...payload })

/* ---------------- Groups / categories: extra ops ---------------- */

export const deactivateGroup = (id) =>
  supabase.from('groups').update({ is_active: false }).eq('id', id).then(unwrap)

export const deactivateItem = (id) =>
  supabase.from('items').update({ is_active: false }).eq('id', id).then(unwrap)

export const updateGroup = (id, patch) =>
  supabase.from('groups').update(patch).eq('id', id).select().single().then(unwrap)

export const updateTemplate = (id, patch) =>
  supabase.from('planogram_templates').update(patch).eq('id', id).select().single().then(unwrap)
