# DESIGN_REFERENCE.md

The visual language extracted from the two reference pages:

- **Dashboard** — `app/page.tsx`
- **Gestion des Réservations** — `app/reservations/page.tsx`
- **Top navigation** — `app/components/AuthNav.tsx` (shared, fixed at top, present on both pages)

Every other page must match the rules below. All class strings are the exact Tailwind classes used in the reference files.

---

## 0. Page shell

Every page is wrapped in the same gradient shell with a centered, max-width container:

```tsx
<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {/* page content */}
  </div>
</div>
```

- Background: `bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100` (3-stop diagonal, top-left → bottom-right).
- Container: `max-w-7xl mx-auto`, horizontal padding `px-4 sm:px-6 lg:px-8`, vertical padding `py-8` (the dashboard uses `py-6`, reservations uses `py-8` — **standardize on `py-8`**).
- Font family: Inter (set at the body level in `app/layout.tsx` via `next/font/google`).
- Language: French. Decimal/thousand formatting via `toLocaleString('fr-FR')`.

---

## 1. NAVBAR (`AuthNav.tsx`)

### Container

```tsx
<nav className="bg-white/95 backdrop-blur-lg shadow-xl border-b border-blue-100 fixed top-0 left-0 right-0 z-50">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center h-20">
      ...
    </div>
  </div>
</nav>
```

| Property | Class / value |
|---|---|
| Background | `bg-white/95` + `backdrop-blur-lg` (frosted white) |
| Shadow | `shadow-xl` |
| Bottom border | `border-b border-blue-100` |
| Position | `fixed top-0 left-0 right-0 z-50` |
| Height | `h-20` (80 px) |
| Inner padding | `px-4 sm:px-6 lg:px-8` (matches page container) |
| Inner layout | `flex justify-between items-center` |

### Logo treatment (left cluster)

```tsx
<div className="flex items-center space-x-3">
  <div className="w-12 h-12 flex items-center justify-center">
    <img src={siteConfig.logo} className="h-10 w-10 object-contain rounded-xl" />
  </div>
  <div>
    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent">
      {siteConfig.name}
    </h1>
    <p className="text-xs text-gray-500">Gestion Omra</p>
  </div>
</div>
```

- Logo wrapper: `w-12 h-12` flex-centered; image `h-10 w-10 object-contain rounded-xl`.
- Brand name: `text-xl font-bold` with the **blue gradient text** `bg-gradient-to-r from-blue-700 to-blue-900 bg-clip-text text-transparent`.
- Tagline below: `text-xs text-gray-500`.

### Nav item groups

Nav items are **grouped in dropdowns**, separated by spacing `space-x-1`. The desktop nav is hidden below `md`: `hidden md:flex items-center space-x-1`.

Three dropdown groups + one direct link:

1. **Dashboard** — direct `<Link href="/">`
2. **Opérations** — dropdown (Nouvelle Réservation, Nouvelle Chambre, Nouveau Programme [admin], Réservations, Programmes, Hôtels)
3. **Finances** — dropdown (Dépenses [admin], Charges fixes [admin], Paiements, Solde Caisse [admin])
4. **Administration** — dropdown, **admin-only** (Gestion Utilisateurs, Journal d'activité)

Each top-level nav button:

```tsx
className="font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all rounded-xl px-4 py-2 flex items-center"
```

Each dropdown trigger ends with a small chevron (`h-4 w-4` filled-currentColor SVG, `ml-1`). Each dropdown panel:

```tsx
<div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 dropdown-menu">
```

(Opérations uses `min-w-[13rem] w-56`; Finances/Admin use `w-48`.)

Dropdown items:

```tsx
className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
```

with a leading inline-SVG icon `h-4 w-4 mr-2` (stroke icons, `strokeWidth={2}`).

### Right cluster — role pill + avatar

Role pill (just before the avatar):

```tsx
<div className={`px-3 py-1 rounded-full text-xs font-medium ${
  agent.role === 'ADMIN'
    ? 'bg-red-100 text-red-700 border border-red-200'
    : 'bg-blue-100 text-blue-700 border border-blue-200'
}`}>
  {agent.role === 'ADMIN' ? 'ADMINISTRATEUR' : 'AGENT'}
</div>
```

Avatar/profile button:

```tsx
<button className="flex items-center text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 p-2 hover:bg-blue-50 transition-all">
  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center">
    <span className="text-white font-medium text-sm">{agent.nom.charAt(0).toUpperCase()}</span>
  </div>
  <span className="ml-2 text-gray-700 hidden sm:block font-medium">{agent.nom}</span>
  <svg className="ml-1 h-4 w-4 text-gray-400">…chevron…</svg>
</button>
```

- Avatar circle: `h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-blue-800`, white initial inside.
- Profile dropdown panel: `absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg py-2 z-50` (note `rounded-xl`, unlike the nav dropdowns which use `rounded-md`).

### Spacing summary

- Right cluster: `flex items-center space-x-3` between mobile-button / role pill / avatar.
- Left cluster: `space-x-4` outer, `space-x-3` between logo image and brand block.
- Nav items between each other: `space-x-1`.

---

## 2. PAGE HEADER (title block)

Reservations page (the canonical form):

```tsx
<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Gestion des Réservations</h1>
    <p className="text-gray-500 mt-1">Gérez et suivez toutes vos réservations Omra</p>
  </div>
  <div className="flex flex-wrap gap-2">
    {/* primary action buttons */}
  </div>
</div>
```

| Element | Classes |
|---|---|
| Title | `text-2xl font-bold text-gray-900` |
| Subtitle | `text-gray-500 mt-1` (default `text-base`) |
| Header → next block | `mb-6` (use `mb-8` if the next block is the stats grid, matching reservations) |
| Layout | `flex flex-col md:flex-row justify-between items-start md:items-center gap-4` |

The dashboard uses a larger `text-4xl font-bold text-gray-900 mb-2` with `text-lg text-gray-600` subtitle — that is the **hero-style** variant reserved for `/` only. **All other pages use the `text-2xl` form above.**

### Header action buttons

Primary CTA (blue gradient):

```tsx
<Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all">
  <Plus className="mr-2 h-4 w-4" />
  Nouvelle Réservation
</Button>
```

Secondary CTA (emerald/teal gradient — used for room/chambre actions):

```tsx
<Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all">
  <HotelIcon className="mr-2 h-4 w-4" /> Chambre Privée
</Button>
```

Tertiary / export button (outlined emerald):

```tsx
<Button variant="outline" className="h-10 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100">
  <Download className="h-4 w-4 mr-2" /> Export data
</Button>
```

---

## 3. STAT CARDS

There are two recognized stat-card patterns. **The Reservations style is the canonical one for non-dashboard pages.**

### 3.A — Reservations style (gradient, hero) — **default for new pages**

```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
  <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white transform hover:scale-105 transition-all duration-300">
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
    <CardContent className="relative p-6">
      <div className="flex items-center justify-between mb-4">
        <Users className="h-8 w-8 text-white/90" />
        <div className="text-right">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-white/80">réservations</div>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-lg">Total Réservations</h3>
        <p className="text-xs text-white/80">Filtres appliqués</p>
      </div>
    </CardContent>
  </Card>
  …
</div>
```

| Property | Value |
|---|---|
| Grid | `grid grid-cols-1 md:grid-cols-4 gap-6 mb-8` |
| Card base | `relative overflow-hidden border-0 shadow-xl text-white transform hover:scale-105 transition-all duration-300` |
| Corner radius | inherited from `Card` (`rounded-lg`) |
| Padding | `CardContent` uses `p-6` |
| Decorative bubbles | Two `bg-white/10 rounded-full` circles, sized `w-32 h-32` (top-right) and `w-24 h-24` (bottom-left), offset off the corners with negative/positive translate |
| Icon | Top-left, `h-8 w-8 text-white/90` (lucide-react) |
| Number | Top-right, `text-2xl font-bold` |
| Number sub-label | `text-xs text-white/80` |
| Title | Bottom-left, `font-semibold text-lg` |
| Title subtitle | `text-xs text-white/80` |
| Spacing inside | `mb-4` between top row and bottom block |

Per-card gradients (always `bg-gradient-to-br from-X-500 via-X-600 to-X-700`):

| Semantic | Gradient |
|---|---|
| Total / neutral | `from-blue-500 via-blue-600 to-blue-700` |
| Success / Complete | `from-green-500 via-green-600 to-green-700` |
| Warning / Incomplete | `from-yellow-500 via-yellow-600 to-yellow-700` |
| Danger / Urgent | `from-red-500 via-red-600 to-red-700` |

### 3.B — Dashboard style (white, minimal)

Reserved for the home dashboard summary row only:

```tsx
<Card className="border-0 shadow-lg">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">Programmes Actifs</p>
        <p className="text-2xl font-bold text-indigo-600">{count}</p>
      </div>
      <Calendar className="h-8 w-8 text-indigo-500" />
    </div>
  </CardContent>
</Card>
```

- White card, `border-0 shadow-lg`, padding `p-6`.
- Label `text-sm font-medium text-gray-600`, number `text-2xl font-bold text-{accent}-600`.
- Icon `h-8 w-8 text-{accent}-500` on the right.
- Accent colors used on the dashboard: `indigo`, `blue`, `green`, `red` (mapped to Programmes / Chambres / Occupées / Disponibles).

---

## 4. SECTION CARDS (wrapping content sections)

Every list / table / form section is wrapped in a shadcn `Card` with no border, soft shadow, a tinted header, and zero/normal padding inside `CardContent`.

### Canonical pattern (from Reservations "Liste des Réservations"):

```tsx
<Card className="border-none shadow-lg overflow-hidden">
  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-2">
    <div className="flex items-center justify-between gap-3">
      <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
        <Users className="h-5 w-5 text-blue-600" />
        Liste des Réservations
      </CardTitle>
      {/* optional right-side action (export, etc.) */}
    </div>
  </CardHeader>
  <CardContent className="p-0">
    {/* content; rows usually have their own internal padding */}
  </CardContent>
</Card>
```

| Element | Classes |
|---|---|
| Card | `border-none shadow-lg overflow-hidden` (use `border-0 shadow-lg` for non-list sections — both are used interchangeably) |
| Header background | `bg-gradient-to-r from-blue-50 to-blue-100` (or `from-gray-50 to-blue-50` for "neutral/legend" sections, or `from-indigo-50 to-blue-50` for program rows on the dashboard) |
| Header padding tweak | `pb-2` to tighten the bottom |
| Card title | `text-blue-800 flex items-center gap-2 text-lg` |
| Title icon | `h-5 w-5 text-blue-600` (lucide) |
| Card body | `p-0` when rows manage their own padding, otherwise `p-6` (or `p-4` for compact like the legend) |
| Section spacing | `mb-6` to `mb-8` between sections; the filters card uses `mb-8` |

### Filters card variant (frosted white):

```tsx
<Card className="mb-8 border-none shadow-lg overflow-hidden bg-white/95 backdrop-blur">
  <CardContent className="p-4 md:p-5">…</CardContent>
</Card>
```

- Frosted background: `bg-white/95 backdrop-blur`.
- Inner padding: `p-4 md:p-5`.

### Empty state inside a section card:

```tsx
<Card className="border-0 shadow-lg">
  <CardContent className="p-12 text-center">
    <div className="text-6xl mb-4">🏨</div>
    <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun programme trouvé</h3>
    <p className="text-gray-600">…</p>
  </CardContent>
</Card>
```

---

## 5. CONTENT CARDS (Dashboard room-availability cards)

These are the colored tiles inside each hotel block. The color is keyed to the room type.

### Hotel wrapper (the gray box that holds the tiles):

```tsx
<div className="border rounded-lg p-4 bg-gray-50">
  <div className="flex items-center gap-2 mb-3">
    <MapPin className="h-5 w-5 text-blue-500" />
    <h3 className="font-semibold text-gray-900">{hotel.hotelName}</h3>
  </div>
  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
    {/* room tiles */}
  </div>
</div>
```

### Single room tile (`getRoomTypeStyle`):

```tsx
<div className={`${bgColor} rounded-lg p-4 border-2 ${borderColor} shadow-sm hover:shadow-md transition-shadow`}>
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <span className="text-lg">{emoji}</span>
      <span className={`font-medium ${textColor}`}>{label} {genderEmoji}</span>
    </div>
    <Badge className={`text-xs ${badgeColor}`}>{occupied}/{total}</Badge>
  </div>

  {/* visual places — colored dots */}
  <div className="flex items-center gap-1 mb-3">
    {places.map((place, i) => (
      <div key={i} className={`w-6 h-6 rounded-full border-2 ${
        place.isOccupied ? 'bg-red-500 border-red-600' : 'bg-green-500 border-green-600'
      }`} />
    ))}
  </div>

  <div className="flex items-center justify-between text-sm">
    <span className={textColor}>{occupied} occupé{occupied > 1 ? 's' : ''}</span>
  </div>
</div>
```

| Property | Value |
|---|---|
| Border | `border-2 ${borderColor}` (a strong 2 px colored border) |
| Background | `${bgColor}` — the `-50` shade matching the border color |
| Radius | `rounded-lg` |
| Shadow | `shadow-sm hover:shadow-md transition-shadow` |
| Padding | `p-4` |
| Internal sections separation | `mb-3` |
| Place dots | `w-6 h-6 rounded-full border-2`, **gap `gap-1`** between dots, `bg-red-500 border-red-600` (occupied) / `bg-green-500 border-green-600` (available) |
| Compact dot variant (Vue Types Chambres) | `w-4 h-4 rounded-full border` |

### Room-type color map (must be used exactly):

| Type | border | bg | text | badge |
|---|---|---|---|---|
| SINGLE | `border-blue-500` | `bg-blue-50` | `text-blue-700` | `bg-blue-100 text-blue-800` |
| DOUBLE | `border-green-500` | `bg-green-50` | `text-green-700` | `bg-green-100 text-green-800` |
| TRIPLE | `border-purple-500` | `bg-purple-50` | `text-purple-700` | `bg-purple-100 text-purple-800` |
| QUAD | `border-orange-500` | `bg-orange-50` | `text-orange-700` | `bg-orange-100 text-orange-800` |
| QUINT | `border-red-500` | `bg-red-50` | `text-red-700` | `bg-red-100 text-red-800` |
| Default/Other | `border-gray-500` | `bg-gray-50` | `text-gray-700` | `bg-gray-100 text-gray-800` |

### Program header (the colored bar above hotel groups) on the dashboard:

```tsx
<CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 py-3">
  …
  <Badge className="bg-yellow-500 text-white text-xs mb-1">Supprimé</Badge>
  <h2 className="text-lg font-bold text-gray-900">{program.name}</h2>
  <p className="text-xs text-gray-600 flex items-center gap-1">
    <CalendarIcon className="h-3 w-3" /> {date}
  </p>
</CardHeader>
```

Inline stat chips inside that header (yellow / blue / green tinted pill blocks, used together as a row):

```tsx
<div className="flex items-center gap-2 bg-blue-100 border border-blue-300 rounded-lg px-3 py-1.5">
  <Users className="h-4 w-4 text-blue-700" />
  <div>
    <p className="text-xs text-blue-800 font-medium">Places</p>
    <p className="text-sm font-bold text-blue-900">{n} / {total}</p>
  </div>
</div>
```

Pattern: `bg-{color}-100 border border-{color}-300 rounded-lg px-3 py-1.5` with `text-xs … font-medium` label and `text-sm font-bold` value. Colors used: **yellow** (Restant), **blue** (Places), **green** (Occupation). The "Supprimé" state swaps to `bg-yellow-100 border-yellow-300 bg-yellow-50` for the whole row container.

---

## 6. BADGES / PILLS

Three flavors in use. Pick by intent.

### 6.A — Tonal pill (most-used; on reservation list rows)

```tsx
className="inline-flex items-center gap-1 text-base font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-1"
```

Pattern: `bg-{c}-50 border border-{c}-200 text-{c}-700` + `rounded` (4 px) + `px-3 py-1` + icon `h-5 w-5 text-{c}-400`.

Color → semantic on Reservations rows:

| Color | Used for |
|---|---|
| blue | Programme |
| yellow | Type de chambre (places) |
| purple | Téléphone |
| emerald | "Chambre" (private room indicator) |
| indigo | Group size |
| orange | Reste à payer (`bg-orange-100 text-orange-800 border-orange-200`) |

### 6.B — Status pill (Complet / Incomplet / Urgent)

Same skeleton as 6.A but `bg-{c}-100`, larger padding `px-4 py-1`, `text-lg font-bold`, icon `h-5 w-5`:

```tsx
// Complet
className="inline-flex items-center gap-1 bg-green-100 text-green-800 border border-green-200 rounded px-4 py-1 text-lg font-bold"
// Incomplet
className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded px-4 py-1 text-lg font-bold"
// Urgent  (the icon gets `animate-bounce`)
className="inline-flex items-center gap-2 bg-red-100 text-red-800 border border-red-200 rounded px-4 py-1 text-lg font-bold"
```

### 6.C — "Chambre privée" badge (premium emerald with ring)

```tsx
className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-emerald-400/70
  bg-gradient-to-r from-emerald-50 to-emerald-100/90
  px-2.5 py-1 text-xs font-bold uppercase tracking-wide
  text-emerald-900 shadow-sm ring-1 ring-emerald-200/60"
```

Reserve for "special category" markers — `rounded-full`, gradient bg, ring + border, uppercase tracking.

### 6.D — shadcn `<Badge>` (small tags)

Used for room-tile counters and the "Supprimé" flag:

```tsx
<Badge className="bg-yellow-500 text-white text-xs mb-1">Supprimé</Badge>
<Badge className={`text-xs ${roomStyle.badgeColor}`}>{occupied}/{total}</Badge>
```

Shape: pill (`rounded-full` from shadcn defaults), `text-xs`, tonal `bg-{c}-100 text-{c}-800` fill.

---

## 7. COLORS — full palette in use

All Tailwind 500/600/700 ramps are reused; the project sticks to Tailwind defaults (no custom hexes in these files). Hexes shown are Tailwind defaults so designers know exactly what is on screen.

### Background / surface

| Token | Hex | Used for |
|---|---|---|
| `slate-50` | `#f8fafc` | page gradient start |
| `blue-50` | `#eff6ff` | page gradient middle, tonal pill bg, section header |
| `indigo-100` | `#e0e7ff` | page gradient end |
| `white` / `white/95` | `#ffffff` | navbar, cards, dropdowns |
| `gray-50` | `#f9fafb` | hotel wrapper inside dashboard cards |
| `gray-100` | `#f3f4f6` | dropdown item hover |
| `blue-100` | `#dbeafe` | nav border-bottom (`border-blue-100`), section header |

### Brand / primary

| Token | Hex |
|---|---|
| `blue-500` | `#3b82f6` |
| `blue-600` | `#2563eb` (primary button start) |
| `blue-700` | `#1d4ed8` (primary button end, hover) |
| `blue-800` | `#1e40af` (logo gradient end, title color in section header) |
| `blue-900` | `#1e3a8a` (uppercase names on reservation rows) |
| `indigo-500/600` | `#6366f1` / `#4f46e5` (dashboard accents) |

### Semantic

| Intent | Token (solid) | Tonal bg | Tonal text |
|---|---|---|---|
| Success | `green-500/600/700` | `green-50` / `green-100` | `green-700` / `green-800` / `green-900` |
| Warning | `yellow-500/600/700` | `yellow-50` / `yellow-100` | `yellow-700` / `yellow-800` / `yellow-900` |
| Danger / Urgent | `red-500/600/700` | `red-50` / `red-100` | `red-600` / `red-700` / `red-800` |
| Info / Programme | `blue-500/600/700` | `blue-50` / `blue-100` | `blue-700` / `blue-800` / `blue-900` |
| Special / Categories | `purple-500/600/700` `orange-500/600/700` | matching `-50/-100` | matching `-700/-800` |
| Secondary CTA | `emerald-600` → `teal-600` (gradient) | `emerald-50/100` | `emerald-700/800/900` |

### Text / neutral

| Token | Hex | Use |
|---|---|---|
| `gray-900` | `#111827` | page titles, primary text |
| `gray-700` | `#374151` | nav items, profile name |
| `gray-600` | `#4b5563` | stat labels, body text on dashboard subtitle |
| `gray-500` | `#6b7280` | subtitles below page titles, tagline |
| `gray-400` | `#9ca3af` | leading icons inside inputs (search), chevrons |
| `slate-300` | `#cbd5e1` | input borders (`border-slate-300`) |

---

## 8. TYPOGRAPHY

Font: **Inter** (loaded in `app/layout.tsx`). All sizes are Tailwind defaults.

| Role | Classes |
|---|---|
| Hero page title (dashboard only) | `text-4xl font-bold text-gray-900 mb-2` |
| Hero subtitle | `text-lg text-gray-600` |
| **Standard page title** (everywhere else) | `text-2xl font-bold text-gray-900` |
| Standard subtitle | `text-gray-500 mt-1` (default `text-base`) |
| Section card title (`CardTitle`) | `text-lg text-blue-800 font-semibold` (CardTitle defaults to `font-semibold`) |
| Program/group header inside card | `text-lg font-bold text-gray-900` |
| Sub-section heading (hotel name) | `font-semibold text-gray-900` (and `text-lg` in the "Vue Types Chambres") |
| Stat-card number | `text-2xl font-bold` (white on gradient, or `text-{accent}-600` on white) |
| Stat-card label | `text-sm font-medium text-gray-600` |
| Stat-card sub-label | `text-xs text-white/80` |
| Reservation row name | `text-xl font-bold tracking-tight uppercase text-blue-900` |
| Tonal pill label (6.A) | `text-base font-semibold text-{c}-700` |
| Status pill label (6.B) | `text-lg font-bold` |
| Premium pill (6.C) | `text-xs font-bold uppercase tracking-wide` |
| Form field label | `text-xs font-semibold text-gray-600` (`mb-1.5 block`) |
| Filter input | `h-11` height with default `text-sm` |
| Dropdown menu item | `text-sm text-gray-700` |
| Avatar initial | `text-sm font-medium text-white` |
| Role pill | `text-xs font-medium` |
| Body / metadata | `text-xs text-gray-500/600` for timestamps and meta |

Tabular numbers / money: rendered with `toLocaleString('fr-FR')`; weight `font-bold`, e.g. `text-lg font-bold text-orange-800` for "reste à payer".

---

## 9. SPACING

The page works on a **4 / 8 / 24** scale plus a few specific values.

### Container & sections

| Where | Class | Value |
|---|---|---|
| Outer page padding (Y) | `py-8` | 32 px |
| Outer page padding (X) | `px-4 sm:px-6 lg:px-8` | 16 / 24 / 32 px |
| Page header bottom | `mb-6` | 24 px |
| Stat-grid bottom | `mb-8` | 32 px |
| Section card bottom | `mb-8` (filters), `mb-6` (legend) | 32 / 24 px |
| Section spacing (program list) | `space-y-6` | 24 px |
| Nav top offset for content | n/a — nav is `fixed h-20`, page content currently does **not** add `pt-20`; if you need clearance under the nav add `pt-20` (= 80 px) to the page shell. |

### Card internals

| Where | Class |
|---|---|
| `CardContent` (default) | `p-6` (24 px) |
| `CardContent` for list rows | `p-0`, rows use their own `p-3` + `mx-2 mb-3` |
| Filter card | `p-4 md:p-5` |
| Legend card | `p-4` |
| Section header tightened | `pb-2` |
| Program card header | `py-3` |
| Empty state | `p-12 text-center` |

### Grids & gaps

| Use | Class |
|---|---|
| Stat cards | `grid grid-cols-1 md:grid-cols-4 gap-6` (24 px gap) |
| Hotel → rooms (dashboard) | `grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4` |
| Room types row (Vue Types Chambres) | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4` |
| Filters form | `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-10 gap-3 lg:gap-4 items-end` |
| Visual place dots | `gap-1` (4 px) |
| Pill icon → text | `gap-1` (4 px) inside pills, `gap-2`/`gap-3` between pills |
| Nav cluster (right) | `space-x-3` |
| Nav cluster (left logo to brand) | `space-x-3` |
| Nav items between each other | `space-x-1` |

### Pill / chip paddings

| Pill | Padding |
|---|---|
| Tonal pill (6.A) | `px-3 py-1` |
| Status pill (6.B) | `px-4 py-1` |
| Premium emerald pill (6.C) | `px-2.5 py-1` |
| Role pill | `px-3 py-1` |
| Inline stat chip (program header) | `px-3 py-1.5` |
| Dropdown item | `px-4 py-2` |

### Form controls

- Input / select height: **`h-11`** (44 px). Border: `border border-slate-300`. Radius: `rounded-lg`. Focus: `focus-visible:ring-2 focus-visible:ring-blue-500/40`.
- Search input has leading icon `absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4` and `pl-10` on the input.
- Filter label: `mb-1.5 block text-xs font-semibold text-gray-600`.
- Form-grid `gap-3 lg:gap-4`.

### Borders & radii

| Element | Radius |
|---|---|
| Page-level cards | `rounded-lg` (shadcn default) |
| Section card with `overflow-hidden` | `rounded-lg` (shadcn) |
| Stat / form inputs | `rounded-lg` |
| Nav top-level buttons & avatar | `rounded-xl` |
| Dropdown panel (nav groups) | `rounded-md` |
| Dropdown panel (profile) | `rounded-xl` |
| Modal / dialog | `rounded-2xl` (`<DialogContent className="max-w-sm rounded-2xl">`) |
| Tonal pill / status pill (6.A/B) | `rounded` (= `rounded` 4 px) |
| Premium pill / role pill | `rounded-full` |
| Reservation list row | `rounded-xl` |
| Room-availability dots | `rounded-full` |
| Place tiles | `rounded-lg` |
| Logo image | `rounded-xl` |

### Shadows

| Tier | Where |
|---|---|
| `shadow-sm` (`hover:shadow-md`) | Room tiles |
| `shadow-md` (`hover:shadow-lg`) | Header CTA buttons |
| `shadow-lg` | Default for cards (section cards, legend, dropdowns) |
| `shadow-xl` | Navbar, gradient stat cards |

---

## 10. ICONS

- **Library:** [`lucide-react`](https://lucide.dev). Imported at the top of every page, never mixed with another set.
- The navbar still uses **inline `<svg>`** Heroicons-style paths (`strokeWidth={2}`, `stroke="currentColor"`, viewBox `0 0 24 24`). New code should prefer `lucide-react`; the inline SVGs in `AuthNav.tsx` are legacy but they're the canonical look there.
- Emoji are used as **decorative** icons in a few headers and the room-type ribbons (🏨 🎯 🕌 🎨 👨 👩) — sparing, never as the only signifier.

### Sizing

| Use | Class |
|---|---|
| Inside buttons / inputs / pills (small) | `h-4 w-4` |
| Section card title icon | `h-5 w-5` |
| Pill leading icon (large status pills, list rows) | `h-5 w-5` |
| Stat card icon | `h-8 w-8` |
| Mobile hamburger | `h-6 w-6` |
| Date icon inside program header subline | `h-3 w-3` |

### Color treatment

- On gradient/colored stat cards: `text-white/90`.
- Inside tonal pills: `text-{c}-400` (icon a step lighter than the text — e.g. `text-blue-400` next to `text-blue-700`).
- Inside section card title: matches the title color, `text-blue-600` next to `text-blue-800`.
- Standalone hint icons in inputs: `text-gray-400`.
- Inside white dashboard stat cards: `text-{accent}-500`.

### Margin pattern next to text

Always `mr-2` after an icon when it precedes a label (`<Plus className="mr-2 h-4 w-4" />`). In pills using `inline-flex … gap-1` / `gap-2`, omit `mr-*`.

---

## Quick checklist for a new page

1. Wrap in the `min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100` shell with the `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8` container.
2. Header: `text-2xl font-bold text-gray-900` title, `text-gray-500 mt-1` subtitle, primary `bg-gradient-to-r from-blue-600 to-blue-700` CTA on the right. `mb-6`.
3. Stat row (if any): gradient cards from §3.A in a `grid md:grid-cols-4 gap-6 mb-8`.
4. Filters: frosted `bg-white/95 backdrop-blur` card, `h-11 rounded-lg border-slate-300` inputs, `text-xs font-semibold text-gray-600` labels.
5. Content section: `Card border-none shadow-lg overflow-hidden` with `bg-gradient-to-r from-blue-50 to-blue-100` header and `text-blue-800 text-lg` title carrying a `h-5 w-5 text-blue-600` lucide icon.
6. Use the tonal pill (§6.A) for metadata, the status pill (§6.B) for state, the premium pill (§6.C) for category markers, and shadcn `<Badge>` for tiny counters.
7. Icons: lucide-react, `h-4 w-4` in buttons / `h-5 w-5` in titles / `h-8 w-8` in stat cards, color one step lighter than surrounding text.
