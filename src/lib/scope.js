/* ---------------- Role scope ----------------
   Server par RLS hi asli guard hai. Ye us guard ki nakal hai, sirf UI ke
   liye — taaki ek dheeli policy ya purana cache kisi ko wo naam na dikha de
   jinse uska koi wasta nahi. Ise kabhi security nahi maanna.

   super_admin, viewer  → sab kuch
   manager              → sirf apni scope_company_id ki locations
   storekeeper          → sirf wahi locations jo use assign hui hain

   Teen pages (Locations, Activity, Overview) yahi ek file lagate hain —
   teen jagah likha to ek din teen alag niyam ho jate. */

// getOverview ka location `company:companies(id)` nested deta hai,
// getLocations `company_id` flat — dono shakl chalein
const companyIdOf = (l) => l?.company_id ?? l?.company?.id ?? null

/** Storekeeper ko di gayi location ids. Assignments khaali/null ho to khaali Set. */
export function assignedLocationIds(profile) {
  return new Set(
    (profile?.assignments ?? [])
      .map((a) => a?.location?.id ?? a?.location_id)
      .filter(Boolean)
  )
}

/**
 * Companies jinke andar user ko kuch dikhna chahiye.
 * `null` ka matlab "koi rok nahi" — sab companies.
 */
export function allowedCompanyIds(profile) {
  if (!profile) return new Set()          // profile hi nahi to kuch nahi
  if (profile.role === 'storekeeper') {
    return new Set(
      (profile.assignments ?? [])
        .map((a) => a?.location?.company_id)
        .filter(Boolean)
    )
  }
  if (profile.role === 'manager') {
    return new Set(profile.scope_company_id ? [profile.scope_company_id] : [])
  }
  return null
}

/**
 * Ek baar Set banao, phir sasta predicate lauta do — bade list par
 * har row ke liye Set dobara banana bekaar hai.
 */
export function locationFilter(profile) {
  // Profile na aaya ho to darwaza band — khula chhodna galat taraf ka risk hai
  if (!profile) return () => false

  if (profile.role === 'storekeeper') {
    const ids = assignedLocationIds(profile)
    return (l) => !!l && ids.has(l.id)
  }
  if (profile.role === 'manager') {
    const scope = profile.scope_company_id
    return (l) => !!l && !!scope && companyIdOf(l) === scope
  }
  return (l) => !!l
}

/** Locations list ko role ke hisaab se chhaanto. */
export const visibleLocations = (profile, locations) =>
  (locations ?? []).filter(locationFilter(profile))

/** Company tabs/chips — sirf wahi jinme user ko kuch dikhta hai. */
export function visibleCompanies(profile, companies) {
  const allowed = allowedCompanyIds(profile)
  if (allowed === null) return companies ?? []
  return (companies ?? []).filter((c) => allowed.has(c.id))
}
