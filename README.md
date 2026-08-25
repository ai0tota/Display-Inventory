# Display Inventory

Track what's actually on every display, across RBDC, VCPL, RBRR, RBI and Spark International.

**Supabase project:** `icjvexbhscgblgotlwwg` · region `ap-south-1`

---

## Chalane ke liye

```bash
npm install
npm run dev          # http://localhost:5173
```

`.env` pehle se bhara hua hai (publishable key hai, ye browser me jana safe hai —
asli security RLS policies me hai, key chhupane me nahi).

## Deploy (Cloudflare Pages)

```bash
npm run build        # dist/ banega
```

Pages settings:
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

`public/_redirects` already hai — iske bina `/locations/abc` par direct jaane
se 404 aata, kyunki Pages us path ki file dhoondhta hai.

---

## Pehli baar setup — Supabase dashboard me (3 kaam)

**1. Storage bucket**
`Storage → New bucket` → naam `item-photos`, **Public** on.
Phir uski policies me authenticated users ko upload allow karo.

**2. Leaked password protection**
`Authentication → Policies` → on karo.

**3. Site URL**
`Authentication → URL Configuration` → Site URL me apna Pages URL daalo,
warna magic link localhost pe bhejta rahega.

Uske baad `ai@rbrr.in` aur `avadh@rbrr.in` login karo — DB trigger unhe
apne aap `super_admin` bana dega. Koi manual step nahi.

---

## Structure

```
src/
  lib/
    supabase.js   client
    api.js        saari DB calls — ek hi jagah
    auth.jsx      session + role
  components/
    ui.jsx        StatusChip, PigmentBar, Modal, Empty, ErrorNote
    Shell.jsx     sidebar (desktop) / bottom tabs (mobile)
  pages/
    Login.jsx  Dashboard.jsx  Locations.jsx  LocationDetail.jsx
```

## Status ka matlab

| Status | Kab | Rang |
|---|---|---|
| Stocked | jitna hona chahiye utna hai | mehndi |
| Short | kam hai | haldi |
| Missing | bilkul nahi hai | gulal |
| Excess | zyada hai | kesar |
| Unplanned | planogram me nahi, phir bhi pada hai | raakh |
| Inactive | na expected na actual | grey |

Ye `display_stock` me **generated column** hai — DB khud calculate karta hai,
isliye kabhi stale nahi hota.

## Roles

| Role | Dekh sakta hai | Count kar sakta hai | Setup badal sakta hai |
|---|---|---|---|
| `super_admin` | sab | sab | haan |
| `manager` | apni company | apni company | nahi |
| `storekeeper` | assigned locations | assigned locations | nahi |
| `viewer` | sab | nahi | nahi |

Naya banda `People` screen se invite hota hai. Wo Edge Function
`admin-users` ke through jaata hai, kyunki user banane ke liye
service_role key chahiye — aur wo key browser me kabhi nahi aani chahiye.

Do rules jo DB level par lagi hain, UI par nahi:
- storekeeper `expected_qty` (target) nahi badal sakta, sirf gin sakta hai
- apna khud ka admin access koi nahi hata sakta

## Screens

| Screen | Kaam |
|---|---|
| Overview | company-wise pigment bars, sabse kharab location upar |
| Locations | company filter + CRUD, phir count screen |
| Catalog | Category / Group / Item, photo upload |
| Templates | item list banao, ek saath kai locations par lagao |
| Activity | append-only log + CSV export |
| People | invite, role, location assignment |
