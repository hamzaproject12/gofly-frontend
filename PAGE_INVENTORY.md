# PAGE_INVENTORY.md

Read-only inventory of every page in the GoFly OMRA travel-agency app. Produced for UX/layout redesign. Each section follows the same template. A `CROSS-PAGE INCONSISTENCIES` section is at the bottom.

---

## PAGE: Dashboard
**Route:** /
**File:** app/page.tsx
**Purpose:** Display real-time room availability and occupancy across all pilgrim travel programs. Agents view capacity planning; admins can additionally see soft-deleted programs.
**User roles who use it:** Both

### DATA DISPLAYED
- Agent profile (nom, email, role): from `/api/auth/profile`
- Room availability overview (programs, hotels, rooms, capacity): `/api/room-availability`
- Program list with `isDeleted` flag: filtered from room-availability response (deleted hidden unless ADMIN, then pushed to bottom)
- Room occupancy % per program: `program.statistics.occupancyRate`
- Remaining balance per program: `program.statistics.remainingAmount`
- Hotel names + locations: nested in `program.hotels`
- Room types (SINGLE/DOUBLE/TRIPLE/QUAD/QUINT): `room.roomType` with gender segregation in dashboard view
- Visual occupancy (green/red dots per room): `room.visualPlaces` array

### ACTIONS AVAILABLE
- Toggle view mode (Vue Dashboard / Vue Types Chambres) — both roles
- Collapse/expand each program card — both roles
- Retry fetch on error — both roles

### CURRENT LAYOUT STRUCTURE
- Top: Header with site name, subtitle, view-mode toggle buttons
- Below header: Color-coded legend for SINGLE/DOUBLE/TRIPLE/QUAD/QUINT with icons
- Stats row: 4 read-only cards (active programs, total rooms, occupied places, available places)
- Main: One collapsible card per program containing inline stats (remaining DH, places, occupation %) and a grid of hotel sections; each hotel has a grid of room cards with dot-grid place visualizer
- Alternate view: same structure but room types grouped horizontally, ignoring gender
- Bottom: Empty state card (🏨, "Aucun programme trouvé") if list empty
- Modals/side panels: none

### FORMS ON THIS PAGE
None

### CURRENT PROBLEMS
- Deleted programs visible only to admins, no role indicator on the page
- Room capacity dots repeat per hotel and per program — no truly global rooms overview
- "remainingAmount" displayed but not explained in UI
- The two view modes look visually similar; toggle labels are subtle
- No drill-through from a room/place to the underlying reservation
- Room price field (`prixRoom`) is fetched but never displayed
- Occupancy %, but no trend / history

### API CALLS
- GET /api/auth/profile — logged-in agent details
- GET /api/room-availability — program → hotel → room data + summary

---

## PAGE: Login
**Route:** /login
**File:** app/login/page.tsx
**Purpose:** Authenticate users (ADMIN or AGENT). Token stored in localStorage and used by `api.request`.
**User roles who use it:** Both (unauthenticated)

### DATA DISPLAYED
- Site name + branding (siteConfig.logo / name)
- Marketing copy ("Votre voyage spirituel commence ici", Makkah/Madinah teaser)
- Inline error message on failed login

### ACTIONS AVAILABLE
- Submit email + password → POST /api/auth/login → store token, redirect to /

### CURRENT LAYOUT STRUCTURE
- Full-screen background image (Unsplash Kaaba/Masjid al-Nabawi) with dark overlay and gold radial gradient
- Floating animated icons (Sparkles / Plane / MapPin)
- Top-left: glass-morphism logo card
- Center: glass-morphism login card with heading "Connexion", email + password inputs, error banner, gradient gold submit button
- Bottom: footer with copyright + tagline
- Modals/side panels: none

### FORMS ON THIS PAGE
- Login form:
  - Fields: email (email, required, autoComplete="email"), motDePasse (password, required, autoComplete="current-password")
  - Validation: HTML5 only (required + email format)
  - On submit: POST /api/auth/login; if ok save `token` to localStorage and `router.push('/')`; else show error

### CURRENT PROBLEMS
- No "Forgot password" / recovery flow
- No link to /register from /login (the reverse link exists)
- Errors are generic ("Erreur de connexion au serveur")
- No success toast/notification after login
- No password-visibility toggle

### API CALLS
- POST /api/auth/login — returns `{ token, ... }`

---

## PAGE: Register
**Route:** /register
**File:** app/register/page.tsx
**Purpose:** Create a new agent account. Role is assigned by backend (default AGENT).
**User roles who use it:** Both (unauthenticated)

### DATA DISPLAYED
- "Créer un nouveau compte" heading + link to /login
- Conditional success screen (green check, redirect message)
- Inline error banner

### ACTIONS AVAILABLE
- Submit nom + email + motDePasse → POST /api/auth/register, redirect after 2s
- Navigate to /login via inline link

### CURRENT LAYOUT STRUCTURE
- Centered card (max-w-md) on light gray bg
- Stacked inputs with no visible labels (sr-only)
- Red inline error banner under inputs
- Indigo gradient submit button
- Modals/side panels: none

### FORMS ON THIS PAGE
- Registration form:
  - Fields: nom (text, required), email (email, required), motDePasse (password, required, ≥6 chars), confirmPassword (password, required, must match)
  - Validation: client-side `validateForm()` — length + equality
  - On submit: POST /api/auth/register with `{ nom, email, motDePasse }`; on success show check screen + redirect

### CURRENT PROBLEMS
- No password-match visual feedback while typing
- Min-length rule is in placeholder text only
- Inputs lack visible labels (sr-only); small-screen confusion
- Success screen auto-redirects with no user control
- No email verification; account is active immediately
- Error messages generic
- Confirm-password field visually identical to password field

### API CALLS
- POST /api/auth/register — `{ nom, email, motDePasse }`

---

## PAGE: Reservations List
**Route:** /reservations
**File:** app/reservations/page.tsx
**Purpose:** Paginated list of all reservations with filtering, status/urgency badges, payment progress, Excel export, and ADMIN-only deletion.
**User roles who use it:** Both

### DATA DISPLAYED
- Reservation name (lastName + firstName)
- Programme name (program.name)
- Room type mapped to "N personnes"
- Hotel Madina + Hotel Makkah names (looked up from hotels list)
- Price (`prixEngage`), payment received (`paiementRecu`), payment progress %
- Document statuses (Passeport / Visa / Vol / Hôtel) — group AND aggregated across accompagnants
- Status: "Complet" | "Incomplet" | "Urgent" (auto, with 18-day deadline window)
- Urgent reason + deadline date
- Group size, "CHAMBRE_PRIVEE" badge if family booking
- Assigned agent (`agent.nom`)
- Phone, reservation date
- 4 stat counts (total / complete / incomplete / urgent)

### ACTIONS AVAILABLE
- "Nouvelle Réservation" → /reservations/nouvelle — both roles
- "Chambre Privée" → /reservations/nouvelle-chambre — both roles
- Filter: programme / statut / chambre type / rows per page (10/30/50) — both
- Search (name, phone, programme) — both
- Date range filter (handlers exist but UI is partial in code)
- Edit: routes to `/reservations/modifier-simple/{id}` or `/reservations/modifier-chambre/{id}` based on `typeReservation`
- Delete (ADMIN only) — confirmation dialog
- Export to Excel via "Export data" dialog (choose program → XLSX with one sheet per program)
- Pagination prev/next + numbered pages

### CURRENT LAYOUT STRUCTURE
- Top: Header "Gestion des Réservations" + subtitle + two CTA buttons (blue "Nouvelle Réservation", emerald "Chambre Privée")
- Stats row: 4 gradient KPI cards (Total/Complètes/Incomplètes/Urgentes)
- Filter card: search + 3 selects + rows-per-page select
- Main list card: "Liste des Réservations" header + Export button; rows are 2-tier cards
  - Tier 1: name + badges + programme + room type + phone + right-aligned status badge/reste à payer
  - Tier 2: 4-column grid — hotels & agent / 4 document status icons / payment progress bar / action buttons
- Bottom: Pagination row ("Affichage de X à Y sur Z" + prev/next + page numbers)
- Modals: Export dialog, Delete confirmation dialog (ADMIN)

### FORMS ON THIS PAGE
- Filter "form" (stateless): search text, programmeFilter, statutFilter, chambreFilter, rowsPerPage
- Export dialog: programme select + confirm button

### CURRENT PROBLEMS
- Urgency logic is opaque (priority: Passeport→Visa→Hôtel→Vol, 18-day window) — users can't see why something is "Urgent"
- Hotel-ID lookup uses the `hotels` state which is never populated in this file — hotel column often shows the raw ID
- Group size badge ("Groupe: 2 pers.") only shows if > 1 — UX inconsistent between solo and family
- Agent name crammed below hotel column; truncated on narrow screens
- Status logic mixes auto-urgency and manual "Complet" — confusing
- No bulk action (reassign agent, bulk export selected, bulk mark)
- Export ignores currently applied filters (only program selection); intent unclear
- Detail route `/reservations/{id}` is never linked from this page (link is commented out)
- The same Delete dialog state is shared by every row (single `deleteDialogOpen`) — fragile if multiple rows interact

### API CALLS
- GET /api/reservations?page&limit&program&status&roomType&dateFrom&dateTo — paginated list
- GET /api/programs — dropdown
- GET /api/reservations/stats?... — counts
- GET /api/export?program=... — Excel
- DELETE /api/reservations/{id} — ADMIN

---

## PAGE: Nouvelle Réservation (LIT — shared bed)
**Route:** /reservations/nouvelle
**File:** app/reservations/nouvelle/page.tsx
**Purpose:** Create a single-person LIT (shared-bed) reservation: OCR passport reading, per-place room selection, multi-row payments, service customization (Avion/Visa) + plan (Économique/Normal/VIP), price reduction/proposition, and supplier doc statuses.
**User roles who use it:** Both

### DATA DISPLAYED
- Calculated price (dynamic): program settings + room prices + plan profit + Avion/Visa toggles + days
- Program details (nbJoursMadina/Makkah, exchange, prixAvionDH, prixVisaRiyal, profit variants)
- Room candidates for Madina + Makkah, sorted by occupancy + availability
- Place grid visualization (green free, yellow selected, red occupied)
- Selected hotels + room IDs
- Customization state (includeAvion, includeVisa, jours overrides, plan)
- Occupant fields (nom, prenom, téléphone, gender, passportNumber, groupe, remarque, transport)
- Payment rows (type, amount, receipt file)
- Supplier doc switches (Statut Visa / Vol / Hôtel)
- OCR extraction popup (firstName, lastName, passportNumber, sex)
- Reduction amount or proposed price override

### ACTIONS AVAILABLE
- Program / room-type / gender selects
- Plan segmented control (Économique / Normal / VIP) with theme change
- Customization panel toggle ("Éditer") — Avion/Visa switches + jours overrides + Réinitialiser
- Hotel Madina / Hotel Makkah selects ("none" allowed)
- Click a room card to auto-select first available place (per Madina/Makkah)
- Upload passport file → auto-triggers OCR; OCR data confirmation dialog
- View / Zoom / Remove passport
- Add / remove payment row; upload payment receipt; "Générer reçu" canvas-to-PNG
- Switch supplier doc statuses (conditional on services + hotel selection)
- Toggle "Réduc." or "Propos." with amount input
- Submit (button + fixed bottom-bar "Confirmer la Réservation")
- Cancel back to /reservations

### CURRENT LAYOUT STRUCTURE
- Top: Card with gradient header "Nouvelle Réservation" + prix suggéré chip
- Main (long single form):
  - Section "Configuration du Voyage" (programme, typeChambre, plan, customization collapse, hotels, room candidate grids)
  - Section "Informations Client" (text fields + passport upload + OCR)
  - Section "Paiements" (dynamic rows)
  - Section "Documents Fournisseur" (3 switches, conditional)
  - Section "Progression / Statut" (section completion indicators)
- Bottom: Fixed bottom bar with price summary + Confirm button
- Modals/side panels: OCR confirmation dialog, document preview/zoom dialog, room-guide dialog

### FORMS ON THIS PAGE
- Fields:
  - programme (select, required), typeChambre (SINGLE/DOUBLE/TRIPLE/QUAD/QUINT, required), gender (Homme/Femme, required), plan (Économique/Normal/VIP)
  - includeAvion (switch), includeVisa (switch), joursMadina (number), joursMakkah (number)
  - hotelMadina / hotelMakkah (select, "none" allowed)
  - nom (text, required), prenom (text, required)
  - telephone (split input, regex `+\d{3} \d{9}`, required)
  - passportNumber (text uppercase, regex `^[A-Z]{2}\d{7}$`, required if passport file attached)
  - groupe (text), remarque (text), transport (switch)
  - Passport (file: image/PDF)
  - Per payment: type (select especes/virement/carte/cheque), amount (number), receipt (file)
  - statutVisa / statutVol / statutHotel (switches; conditionally shown)
  - reduction (number) or prixPropose (number)
- Validation:
  - baseFieldsValid: programme + typeChambre + gender + nom + prenom + telephone (regex) + prix > 0
  - passportNumberOk: regex if file attached
  - arePaymentsValid: each row has type + amount; total ≤ price
  - section1Complete / section2Complete / section3Complete / section4Complete computed live
- On submit:
  1. Validate phone, passport (if file), payment totals
  2. Compute status ("Complet" iff all docs + paid in full)
  3. POST /api/reservations
  4. Upload passport via /api/upload-cloudinary; upload visa/flight/hotel via /api/upload (legacy local)
  5. POST /api/payments per row (with optional /api/upload-cloudinary for receipt)
  6. Auto-create /api/expenses for Vol/Visa/HotelMadina/HotelMakkah
  7. PATCH /api/reservations/{id} to set statuts
  8. Redirect to /reservations

### CURRENT PROBLEMS
- Massive file (~3464 lines); form, OCR, file orchestration, pricing all in one component
- 80+ `console.log` lines (debug) shipped to prod
- OCR confirmation dialog pops every time, even when previously confirmed
- Payment row UI is cramped — 3-column grid squeezed on mobile
- Room selection: click selects, no explicit confirm, place dots tiny — hard on mobile/touch
- Customization panel hidden by default; users may miss Avion/Visa toggles or day overrides
- Reduction/proposition controls live at bottom-right, easy to miss on tall forms
- No bulk-upload for accompagnants (this page is for LIT only — one person at a time)
- Expenses auto-created with no feedback if failure
- Two upload endpoints used (cloudinary + local /api/upload) — inconsistent
- Statut switches show ON/OFF but no help text on what each means

### API CALLS
- GET /api/programs
- GET /api/programs/{id}
- POST /api/passport-ocr
- POST /api/reservations
- POST /api/upload-cloudinary
- POST /api/upload (legacy local for visa/flight/hotel)
- POST /api/payments
- POST /api/expenses (×4 services)
- PATCH /api/reservations/{id}

---

## PAGE: Nouvelle Chambre Privée (CHAMBRE_PRIVEE — family group)
**Route:** /reservations/nouvelle-chambre
**File:** app/reservations/nouvelle-chambre/page.tsx
**Purpose:** Create a whole-room family-group reservation with 2–5 occupants (1 leader + accompagnants), per-occupant OCR, shared price, auto-split expenses per occupant.
**User roles who use it:** Both

### DATA DISPLAYED
- Calculated price for the whole room (unit × capacity)
- Program details (same fields as Nouvelle Réservation)
- Room candidates (Madina + Makkah) filtered to fully-vacant rooms (room is exclusive for the family)
- Capacity (2–5 based on room type; SINGLE not allowed)
- Occupants array: [leader, accompagnant_1, …]
- "Famille mixte" toggle (if false, candidate rooms must match leader gender or be Mixte)
- Per-payment rows (linked to leader's reservation only)
- Supplier statuses (statutVisa/statutVol/statutHotel)
- OCR popup per occupant
- Leader-only fields: groupe, remarque, transport
- `paidAmount` separate input (takes priority over sum of rows on submit)

### ACTIONS AVAILABLE
- Programme select (resets hotel/room selections)
- Room type select (DOUBLE/TRIPLE/QUAD/QUINT) — resizes occupants array
- Leader gender select
- Plan segmented control (Économique/Normal/VIP)
- Customization toggle (Avion/Visa switches, jours overrides, Famille mixte switch, Réinitialiser)
- Hotel Madina / Makkah selects
- Click room candidate to select; auto-selects first available on filter change
- Per occupant: edit firstName/lastName/passportNumber (+ phone for leader only) + upload passport file (triggers OCR + apply-data dialog) + zoom + remove
- Per accompagnant: gender select (leader uses formData.gender)
- Payment rows: add / remove / upload receipt / "Générer reçu"
- Supplier doc switches
- Price reduction / proposition (bottom bar)
- Submit (button + fixed bottom bar)
- Cancel back to /reservations

### CURRENT LAYOUT STRUCTURE
- Top: Gradient header card "Nouvelle Chambre Privée / Familiale" + prix suggéré chip
- Main (single long form):
  - Section "Configuration du Voyage" (programme, typeChambre, plan, customization, hotels, room candidates)
  - Section "Informations Client" — repeating block per occupant (leader has phone + groupe + remarque + transport; accompagnants have name + passport only)
  - Section "Paiements" (dynamic rows)
  - Section "Documents Fournisseur" (3 switches)
- Bottom: Fixed bottom bar with price + Confirmer button
- Modals/side panels: OCR confirmation dialog per occupant, document preview/zoom

### FORMS ON THIS PAGE
- Top-level fields:
  - programme (required), typeChambre (DOUBLE/TRIPLE/QUAD/QUINT, required), gender (leader, required), plan
  - customization { includeAvion, includeVisa, joursMadina, joursMakkah, plan }
  - familyMixed (switch)
  - hotelMadina / hotelMakkah (required), roomMadinaId / roomMakkahId (required, auto-selected)
- Per occupant:
  - firstName (required), lastName (required)
  - phone (leader only, regex `+\d{3} \d{9}`, required)
  - passportNumber (regex if passport file attached)
  - gender (accompagnants only)
  - passport file (optional)
- Payments: type + amount (≤ price) + receipt (optional)
- Validation:
  - identitiesMinimumOk: each occupant has firstName+lastName; leader has valid phone; passport regex if file present
  - allPassportFilesProvided: every occupant has a passport file
  - prixGenere: calculated price > 0 and formData.prix > 0
  - canSubmit combines configuration + identities + price
- On submit:
  1. Validate leader phone, passports (if files), totals
  2. Compute group status ("Complet" iff all passports + supplier docs + paid in full)
  3. POST /api/reservations/group (groupId UUID, typeReservation CHAMBRE_PRIVEE, familyMixed, roomType, roomMadinaId, roomMakkahId, occupants[], common{programId, hotels, statuts, reduction, plan, groupe, remarque, transport})
  4. Parallel uploads of each occupant's passport via /api/upload-cloudinary
  5. POST /api/payments for each payment row (with optional receipt upload)
  6. Auto-create /api/expenses (×4 service types × N occupants), each amount = unit×capacity ÷ capacity
  7. PATCH /api/reservations/{leaderId} to set leader statuts
  8. Redirect to /reservations

### CURRENT PROBLEMS
- Occupants array resizes when room type changes; downsizing silently drops accompagnant fields
- OCR confirmation dialog appears once per occupant — heavy for QUINT (5 dialogs)
- "Famille mixte" switch not prominent; default true; easy to overlook
- Room candidate grid place dots small and tight
- Confusing dual amount inputs: `paidAmount` AND payment rows (paidAmount wins on submit)
- Auto-expense creation per occupant: partial failures leave inconsistent data, no rollback
- Group creation: leader and accompagnants are separate reservations linked by groupId — deleting a single member can orphan the rest (UI doesn't enforce group integrity)
- "Plan" theming reused from Nouvelle Réservation — visually similar, can't distinguish "I'm in chambre vs lit" easily
- Bottom-bar Confirmer button always visible — does not signal unfilled required fields above

### API CALLS
- GET /api/programs
- GET /api/programs/{id}
- POST /api/passport-ocr
- POST /api/reservations/group
- POST /api/upload-cloudinary (passport per occupant; payment receipts)
- POST /api/payments
- POST /api/expenses (×4 per occupant)
- PATCH /api/reservations/{leaderId}

---

## PAGE: Détail Réservation
**Route:** /reservations/[id]
**File:** app/reservations/[id]/page.tsx
**Purpose:** Read-only view of a single reservation: client info, hotels, payments, documents.
**User roles who use it:** Both

### DATA DISPLAYED
- nom, prenom, téléphone, programme, room type, prix, paiementRecu
- hotelMadina, hotelMakkah
- dateReservation, statut (Complet/Incomplet)
- Doc booleans (statutPasseport / statutVisa / statutHotel / statutVol)
- Payment list (type, montant, date, receipt with thumbnail)
- Document list (passport, visa, hotelBooked, flightBooked) — preview + zoom button
- Program hotels (for context)

### ACTIONS AVAILABLE
- Click thumbnails to open the preview modal — both roles

### CURRENT LAYOUT STRUCTURE
- Top: Gradient header card "Détail Réservation" + Sparkles icon
- Main: One large Card with six color-coded sub-sections
  1. Informations Client (blue gradient)
  2. Hôtels (green gradient)
  3. Paiements (orange gradient) — repeating cards
  4. Documents attachés (purple gradient) — 4-column grid
- Bottom: Document preview modal (fixed black 60% backdrop)
- Modals: Preview modal with PDF embed/iframe or `<img>` and close button

### FORMS ON THIS PAGE
None

### CURRENT PROBLEMS
- `isPdfFile()` uses extension only; misses URLs without `.pdf` extension or with query strings
- Cloudinary PDFs may fail to embed if MIME header is wrong
- No drill-back to the reservations list (no breadcrumb)
- This page isn't actually linked from the list (the eye/details button in the list is commented out) — possibly dead route in the user-facing flow
- No "Edit" button on the detail view itself

### API CALLS
- GET /api/reservations/{id}

---

## PAGE: Modifier Réservation Simplifiée (Simple Edit — used by LIT)
**Route:** /reservations/modifier-simple/[id]
**File:** app/reservations/modifier-simple/[id]/page.tsx
**Purpose:** Streamlined edit for a single LIT reservation (or one member of a group). Limited to identity + passport + status flags + payments.
**User roles who use it:** Both

### DATA DISPLAYED
- Reservation: nom, prenom, telephone, passportNumber, prix (inherited), gender, dateReservation
- Existing payments list (read-only on this page)
- Passport document preview (single)
- Computed Complet/Incomplet status

### ACTIONS AVAILABLE
- Edit identity fields (nom, prenom, téléphone, passportNumber, gender, dateReservation)
- Upload / replace / delete passport document
- Submit and redirect to /reservations
- (No hotel/program changes, no payment additions in this view)

### CURRENT LAYOUT STRUCTURE
- Top: Card with gradient header "Modifier Réservation Simplifiée"
- Main: Sequential sections
  1. Personal Info (required fields)
  2. Documents (passport only)
  3. Existing Payments (read-only list)
  4. Status display (Complet/Incomplet)
- Bottom: "Enregistrer" button
- Modals: passport preview/zoom

### FORMS ON THIS PAGE
- Fields:
  - nom (text, required), prenom (text, required), telephone (regex `+\d{3} \d{9}`, required)
  - passportNumber (regex `^[A-Z]{2}\d{7}$`, required if passport file attached)
  - gender (select, required), dateReservation (date)
  - passport (file: image or PDF)
- Validation:
  - phone regex, passport regex when file attached
  - payment totals ≤ price
- On submit:
  1. Validate phone + passport
  2. PUT /api/reservations/{id} with updated fields
  3. /api/upload-cloudinary for any new passport file; DELETE /api/upload-cloudinary/{fichierId} for replaced/old
  4. Redirect to /reservations

### CURRENT PROBLEMS
- Strict phone regex fails for any number not formatted exactly as `+XXX XXXXXXXXX`
- Accompagnants state loaded but never displayed/edited — dead code from copy-paste
- Existing payments are read-only here; no inline path to add a payment for this person
- Status logic not re-explained — users may not understand why Complet flips
- Form duplicates large amounts of code from `modifier-chambre` and `modifier`

### API CALLS
- GET /api/reservations/{id}
- GET /api/programs/{programId}
- POST /api/payments (when used)
- POST /api/upload-cloudinary
- DELETE /api/upload-cloudinary/{fileId}
- PUT /api/reservations/{id}

---

## PAGE: Modifier Réservation (Legacy Full Edit)
**Route:** /reservations/modifier/[id]
**File:** app/reservations/modifier/[id]/page.tsx
**Purpose:** Original full edit page covering every reservation field, payment row, and document upload. Likely legacy — the reservations list no longer routes to it.
**User roles who use it:** Both

### DATA DISPLAYED
- Full formData (nom, prenom, telephone, prix, hotelMadina/Makkah, dateReservation, gender, passportNumber, groupe, remarque, transport)
- Payments list (editable rows)
- Documents (passport, visa, hotelBooked, flightBooked + payment receipts) with previews
- Programs list
- Computed completion state per section + final statut

### ACTIONS AVAILABLE
- Update all text fields, toggle transport/statutVisa/statutVol/statutHotel
- Change program, room type, gender, hotels
- Manage payment rows (add/remove/update/receipt upload)
- Upload/replace/delete documents (passport/visa/hotel/flight + payment receipts)
- Submit and redirect

### CURRENT LAYOUT STRUCTURE
- Top: Gradient header "Modifier Réservation"
- Main: Multiple collapsible sections — client info, hotels, additional fields, documents, payments, progress/status
- Bottom: "Enregistrer" button
- Modals: PdfPreviewModal, room guide modal

### FORMS ON THIS PAGE
- Same fields as "Nouvelle Réservation" but pre-filled
- Validation: nom/prenom/téléphone/typeChambre/prix required, payment total ≤ price, passport regex if file
- On submit:
  1. Create new payments + upload receipts
  2. PUT /api/reservations/{id}
  3. Delete + replace documents via /api/upload-cloudinary
  4. If leader of a group: PUT /api/reservations/group-update/{id}
  5. Redirect to /reservations

### CURRENT PROBLEMS
- ~3350 lines, mixed concerns (form, OCR, blob handling, payment validation, status calc)
- Appears unused from the list — list links to `modifier-simple` or `modifier-chambre` only. Likely DEAD route worth removing or repurposing
- `usePdfBlob` and helpers duplicated in three edit files (could be shared)
- Real-time validation absent — only on submit
- Phone normalization inconsistent with the stricter modifier-simple / modifier-chambre
- Accompagnants data loaded but UI doesn't expose editing for them — confused intent

### API CALLS
- GET /api/reservations/{id}
- GET /api/programs/{programId}
- POST /api/payments
- POST /api/upload-cloudinary
- DELETE /api/upload-cloudinary/{fileId}
- PUT /api/reservations/{id}
- PUT /api/reservations/group-update/{id} (conditional)

---

## PAGE: Modifier Chambre Privée
**Route:** /reservations/modifier-chambre/[id]
**File:** app/reservations/modifier-chambre/[id]/page.tsx
**Purpose:** Edit a CHAMBRE_PRIVEE group dossier — leader + all accompagnants in one screen, per-occupant passports, leader-driven payments, coordinated status.
**User roles who use it:** Both

### DATA DISPLAYED
- Leader fields (nom, prenom, telephone, passportNumber, prix, gender, groupe, remarque, transport)
- Accompagnants[] (firstName/lastName/phone/passportNumber/passport document/read-only payments)
- Combined status: Complet only if every member has passport + all supplier docs ok + paid in full
- Leader payments (editable rows)
- Selected program/hotels (apply to the whole group)

### ACTIONS AVAILABLE
- Edit leader identity, hotels, plan, dates
- Edit each accompagnant's identity + passport (upload/zoom/delete)
- Add/remove leader payments (+ receipts)
- Save group via a single grouped API call

### CURRENT LAYOUT STRUCTURE
- Top: Gradient header "Modifier Chambre Privée"
- Main:
  1. Leader section (full personal/hotel/document/payments)
  2. Accordion/Collapsible accompagnants — one block per member
  3. Room/status summary (e.g. missing passports check)
- Bottom: "Enregistrer"
- Modals: PdfPreviewModal / passport zoom

### FORMS ON THIS PAGE
- Leader: same fields as Nouvelle Réservation
- Per accompagnant: firstName, lastName, phone (formatPhoneInput, regex), passportNumber (formatPassportInput, regex if passport file), gender, passport (file)
- Payments rows: type, montant, date, receipt
- Validation:
  - Phone regex `+\d{3} \d{9}` (leader and each accompagnant via formatPhoneInput)
  - Passport regex `^[A-Z]{2}\d{7}$` if file attached
  - Status "Complet" requires every member's passport + visa + hotel + flight + paid in full
- On submit:
  1. Validate every member's phone/passport
  2. Create new payments + upload receipts
  3. Upload/delete passports for leader and each accompagnant
  4. PUT /api/reservations/{leaderId}
  5. PUT /api/reservations/group-update/{leaderId} for grouped accompagnants (single transaction); fallback to per-member PUTs

### CURRENT PROBLEMS
- ~3630 lines, biggest of the edit pages
- Mix of "editable" and "read-only" accompagnant fields is unclear in the UI
- Group-status logic complex; page doesn't surface which exact occupant is missing what
- Phone/passport format helpers (formatPhoneInput/formatPassportInput) not consistently applied to all inputs
- `memberPassportFiles` / `memberPassportDelete` per-accompagnant arrays risk race conditions on quick uploads
- Two submit paths (group-update vs per-member) can produce duplicate journal entries
- No "delete entire group" action available here

### API CALLS
- GET /api/reservations/{id}
- GET /api/programs/{programId}
- POST /api/payments
- POST /api/upload-cloudinary
- DELETE /api/upload-cloudinary/{fileId}
- PUT /api/reservations/{id}
- PUT /api/reservations/group-update/{leaderId}
- PUT /api/reservations/{accompagnantId} (per-member fallback)

---

## PAGE: Programmes List
**Route:** /programmes
**File:** app/programmes/page.tsx
**Purpose:** Dashboard for OMRA travel programs: financial overview, room capacity, deadlines, plus soft-deleted view and Excel export.
**User roles who use it:** ADMIN (role-protected)

### DATA DISPLAYED
- Program cards: name, creation date, total revenue (DH), reservation count
- Per-program panels:
  - Hotels (Madina + Makkah badges) + transport stats
  - Room capacity (5 room types) with occupancy animation and remaining places
  - Deadlines (visa/hotels/flights/passport) color-coded (expired / urgent ≤10d / ok)
  - Financial breakdown: revenue, expenses by category (Hôtel/Vol/Visa/Autre), net profit
  - Reservation counts by room type
- Top stat cards: total programs, total reservations, total revenue, "partner hotels" (hardcoded 8)
- Soft-deleted programs section (separate styling, preservation note)

### ACTIONS AVAILABLE
- "Nouveau Programme" → /programmes/nouveau (ADMIN)
- Debounced search by program name
- Filter by program name (select, "tous" or specific)
- View reservations → /reservations?programme={id}
- View expenses → /depenses?programme={id} (ADMIN)
- Edit program → /programmes/modifier/{id} (ADMIN)
- Hard delete program (confirmation modal, irreversible) — ADMIN
- Soft-delete (logic exists, commented out in UI)
- Export Excel (agency roster) via /api/export

### CURRENT LAYOUT STRUCTURE
- Top: Header + "Nouveau Programme" CTA
- Filters: Card with search input + program-name select
- Stats row: 4 top-level cards
- Main: Tabbed cards per program with Details / Reservations / Finances tabs
  - Details: hotels (Madina/Makkah) + transport / room capacity grid / deadline status badges
  - Reservations: room capacity grid + total reservations + revenue
  - Finances: revenue/expenses/net + expense bar chart
  - Footer per card: action buttons (View reservations, View expenses ADMIN, Export Excel, Edit, Hard Delete)
- Bottom: Soft-deleted section (yellow, warning note)
- Modals: DeleteConfirmation component

### FORMS ON THIS PAGE
- Search input (debounced)
- Filter select
- DeleteConfirmation dialog (title/description differs for soft vs hard delete)

### CURRENT PROBLEMS
- "Partner Hotels" stat is hardcoded to 8 rather than computed
- Expense breakdown filters out `montant > 0` — hides zero categories that might still matter
- Soft-delete vs hard-delete logic conditionally targets `/api/programs/{id}/hard` vs `/api/programs/{id}` — soft path commented out in UI but live in code
- Room capacity row uses static index-based animation delays; labels hardcoded (not dynamic mapping)
- Per-card tabs cause inconsistent height — page jumps as user toggles

### API CALLS
- GET /api/programs/overview — full overview
- DELETE /api/programs/{id}/hard or /api/programs/{id} — soft vs hard
- GET /api/export?programId={id} — Excel roster

---

## PAGE: Nouveau Programme
**Route:** /programmes/nouveau
**File:** app/programmes/nouveau/page.tsx
**Purpose:** Create a new program: basic info, financial parameters, hotel inventory per city (rooms × prices), deadlines, and a live profitability simulator with PDF report.
**User roles who use it:** ADMIN

### DATA DISPLAYED
- Form values (text/number/date)
- Hotel lists (Madina + Makkah) from /api/hotels/available
- Room types (Simple, Double, Triple, Quadruple, Quintuple)
- Simulation: revenue at full capacity, cost breakdown (flight, hotels, visa), by-room-type table (places, unit price, subtotal), agent cost rough calc, projected net profit (color box)
- Validation errors list
- Unsaved-changes warning

### ACTIONS AVAILABLE
- Edit basic info (name, creation date read-only)
- Edit financial inputs (nbJoursMadina/Makkah, exchange, prixAvion, prixVisa, profitÉconomique/Normal/VIP)
- Select hotels per city (checkboxes), set room counts +/- and prices per type
- Pick deadlines via popover calendars
- Toggle "include Avion / Visa" and pick plan to simulate
- Download simulation PDF (jsPDF + jspdf-autotable, dynamic import)
- Save / Cancel back to /programmes

### CURRENT LAYOUT STRUCTURE
- Top: Gradient header card "Créer un nouveau programme" + Simulation breadcrumb link
- Main: Vertical stack of color-themed sections
  1. Basic Info (blue)
  2. Financial & Duration (green) — incl. 3-col profit grid
  3. Hôtels Madina (yellow) — checkboxes + 5 room cards per hotel
  4. Hôtels Makkah (blue) — same pattern
  5. Dates Limites (orange) — 4 calendar pickers
  6. Simulation (purple, collapsible) — toggles, plan select, override jours, agent costs, by-type table, forecast box + Download PDF
- Footer: Save (blue), Cancel
- Modals/side panels: calendar popovers; PDF generated as a download (no modal)

### FORMS ON THIS PAGE
- Fields:
  - name (required), nbJoursMadina/Makkah (number, required), exchange (number step 0.01, required)
  - prixAvionDH (required), prixVisaRiyal (required)
  - profitÉconomique / profitNormal / profitVIP (number, required)
  - Hotel checkboxes (Madina/Makkah)
  - Per hotel × room type: count +/- buttons + price (Riyal) number input
  - 4 deadlines (calendar pickers, required)
  - Simulation params: includeAvion (checkbox), includeVisa (checkbox), plan (select), agent places, agent cost, autres charges
- Validation: submit-time check that name + 4 dates set + each room with count > 0 has a price; `parseNum()` coercion throughout
- On submit: POST /api/programs with full payload (hotel arrays + rooms + prices + dates)

### CURRENT PROBLEMS
- File is huge (~2347 lines) — form, simulation, PDF export all coupled
- Multi-select hotel picker is bespoke instead of using a shared component
- Room editor (count + price) is inline +/- with no validation feedback
- Simulation panel hidden by default — important pricing logic easily missed
- Silent catch on jsPDF dynamic import; if import fails, user gets nothing
- Validation reasons list hardcoded in JSX — no i18n
- No autosave / draft

### API CALLS
- GET /api/hotels/available?city=Madina
- GET /api/hotels/available?city=Makkah
- POST /api/programs

---

## PAGE: Modifier Programme
**Route:** /programmes/modifier/[id]
**File:** app/programmes/modifier/[id]/page.tsx
**Purpose:** Edit an existing program. Pre-populated with current data. Enforces "cannot reduce room count below occupied count".
**User roles who use it:** ADMIN

### DATA DISPLAYED
- Loaded program (name, dates, all financials, deadlines, selected hotels, existing room inventory + constraints)
- Per hotel × type: current count, occupied count, max-decrementable, price
- Disabled hotel checkboxes (can't swap hotels here)

### ACTIONS AVAILABLE
- Edit name, financial fields, deadlines
- Adjust room counts (+/− with constraints — minus disabled if count ≤ occupied)
- Edit room prices
- Save / Cancel → /programmes

### CURRENT LAYOUT STRUCTURE
- Top: Gradient header card "Modifier le programme"
- Loading: "Chargement..." text
- Main: Same color-themed sections as Nouveau Programme
  - Hotels: checkboxes disabled (selection locked); rooms show occupied count and total
- Footer: Save (green), Cancel
- No Simulation section

### FORMS ON THIS PAGE
- Same fields as Nouveau Programme except:
  - Hotel selection is read-only
  - Decrement on room count constrained: `canDecrement = currentValue > occupied`
- Validation: name + 4 dates required (isFormValid)
- On submit: PUT /api/programs/{id} — backend reconciles room creation/deletion/update against constraints

### CURRENT PROBLEMS
- Cannot swap hotels here — only edit the rooms of currently linked hotels (no UX cue for how to do this)
- `roomConstraints` computed on load; stale if hotels change underneath
- Decrement boundary slightly ambiguous ("Occupées: X • Total actuel: Y" — what does "current" mean?)
- No simulation preview here — user flies blind on price impact
- Heavy console logs (analyzeRoomChanges) shipped to prod

### API CALLS
- GET /api/programs/{id}
- GET /api/hotels/available?city=Madina
- GET /api/hotels/available?city=Makkah
- PUT /api/programs/{id}

---

## PAGE: Paiements (list)
**Route:** /paiements
**File:** app/paiements/page.tsx
**Purpose:** Browse all payment records, filter by client / programme / payment method, view/download receipt files.
**User roles who use it:** Both

### DATA DISPLAYED
- Per payment: date/time, client name (from reservation) or description, phone, programme, method (Carte/Espèces/Virement/Chèque), agent name, amount (DH)
- Receipt file (download + preview buttons) if attached
- 5 stat cards: Total, Carte, Espèces, Virement, Chèque

### ACTIONS AVAILABLE
- "Nouveau Paiement" → /paiements/nouveau
- Search (firstName, lastName, phone, description)
- Filter by programme (dropdown), by method (dropdown)
- Reset filters
- Download receipt; preview receipt modal (image or PDF iframe)

### CURRENT LAYOUT STRUCTURE
- Top: Header "Gestion des Paiements" + "Nouveau Paiement" button
- Stats row: 5 stat cards
- Filters section (Search + 2 selects)
- Main: List rows (flexbox, wraps on mobile)
- Modals: File preview modal (image or PDF iframe)
- Background: gradient slate→blue→indigo

### FORMS ON THIS PAGE
None for data entry. Filters only (search input + program select + method select).

### CURRENT PROBLEMS
- `localhost:5000` hardcoded in receipt-download URLs (lines ~488 and ~501) — broken in production
- Row layout wraps with variable column widths on smaller screens
- PDF iframe shows full URL chrome and may include toolbar
- No date-range filter on this list, unlike Solde
- Receipts cannot be replaced/deleted from this page

### API CALLS
- GET /api/payments
- GET /api/programs (dropdown)

---

## PAGE: Nouveau Paiement
**Route:** /paiements/nouveau
**File:** app/paiements/nouveau/page.tsx
**Purpose:** ADMIN-only manual entry of a single payment (description + amount + method + optional programme).
**User roles who use it:** ADMIN only (useAuth gate, access-denied for AGENT)

### DATA DISPLAYED
- Form labels with icons
- Program dropdown
- Loading state
- Toast feedback

### ACTIONS AVAILABLE
- Enter description, amount (>0.01, step 0.01), select method (Espèces/Carte/Virement/Chèque), optionally pick program
- Submit (POST then redirect to /paiements)
- Cancel back to /paiements

### CURRENT LAYOUT STRUCTURE
- Top: Gradient header (indigo→purple→blue) with back button + title + icon card
- Main: Single Card with form
  - description (textarea, full width)
  - amount + type in 2-col row
  - programId full width
  - buttons row (Cancel outline + Submit gradient)
- Background: gradient indigo→white→cyan

### FORMS ON THIS PAGE
- Fields:
  - description (textarea, required)
  - amount (number, step 0.01, required, ≥ 0.01)
  - type (select: especes/carte/virement/cheque, default especes)
  - programId (select with "Aucun programme" = "none", optional)
- Validation: only `description.trim()` is enforced client-side
- On submit: POST /api/payments → redirect

### CURRENT PROBLEMS
- No amount validation (apart from HTML5 min)
- "Aucun programme" sentinel "none" handled inconsistently elsewhere
- ADMIN-only check is page-level, but role gating not reflected on the list ("Nouveau Paiement" button is always shown)
- No way to attach a receipt file from this page

### API CALLS
- GET /api/programs
- POST /api/payments

---

## PAGE: Dépenses (list)
**Route:** /depenses
**File:** app/depenses/page.tsx
**Purpose:** List expenses grouped by reservation, with stats by type and a search/filter bar.
**User roles who use it:** ADMIN only

### DATA DISPLAYED
- 6 stat cards: Total, Vol, Hotel Madina, Hotel Makkah, Visa, Autre
- Grouped expense list (per reservation): name (or "Non attribué"), programme, date, breakdown badges per type with amounts
- Expandable details — individual expense items (type icon, type badge, date, description, amount)
- Status badges "payé"/"en_attente"

### ACTIONS AVAILABLE
- "Nouvelle Dépense" → /depenses/nouvelle
- Search (description/program/type)
- Filter by program / type
- Expand/collapse group details

### CURRENT LAYOUT STRUCTURE
- Top: Header + "Nouvelle Dépense" button
- Stats row: 6 stat cards (responsive 1/3/6 col)
- Filters section
- Main: Grouped expense list (collapsible cards)
- Background: gradient slate→blue→indigo
- Modals: none

### FORMS ON THIS PAGE
Filters only.

### CURRENT PROBLEMS
- ADMIN-only check via useAuth — no visible role guard / access-denied screen
- Stats mix backend stats with client-side fallback calculations
- Filter mixes normalized search (normalizeText) with exact-name program matching — inconsistent
- Stat cards have duplicate visual effects (two circular div backgrounds)
- No edit/delete actions for expenses
- No date-range filter

### API CALLS
- GET /api/expenses?program={...}&type={...}&page=1&limit=100
- GET /api/programs
- GET /api/expenses/stats?program={...}&type={...}

---

## PAGE: Nouvelle Dépense
**Route:** /depenses/nouvelle
**File:** app/depenses/nouvelle/page.tsx
**Purpose:** ADMIN-only manual entry of an expense.
**User roles who use it:** ADMIN only

### DATA DISPLAYED
- Form labels with icons
- Type select with 5 options
- Program select (optional)
- Date input prefilled to today
- Loading state + toasts

### ACTIONS AVAILABLE
- Enter description, amount, pick type / program / date
- Submit and redirect to /depenses
- Cancel back to /depenses

### CURRENT LAYOUT STRUCTURE
- Top: Same gradient header pattern as Nouveau Paiement
- Main: Single Card form
  - description (textarea, full width)
  - amount + type in 2-col row
  - programId + date in 2-col row
  - Buttons row
- Background: gradient indigo→white→cyan

### FORMS ON THIS PAGE
- Fields:
  - description (textarea, required)
  - amount (number, step 0.01, required)
  - type (select: Vol/Hotel Madina/Hotel Makkah/Visa/Autre, required)
  - programId (select with "none", optional)
  - date (date, default today, required)
- Validation: required fields only
- On submit: POST /api/expenses → redirect

### CURRENT PROBLEMS
- `getTypeIcon()` only handles Vol and Hôtel; Visa/Autre/Madina/Makkah fall back to generic icon
- Date default uses local ISO split — timezone inconsistencies possible
- Minor indentation/structure quirks (~lines 170–176)
- Expenses can't be attached to a specific reservation from this page (only program)
- No receipt file attachment

### API CALLS
- GET /api/programs
- POST /api/expenses

---

## PAGE: Hôtels
**Route:** /hotels
**File:** app/hotels/page.tsx
**Purpose:** Catalog management for Madina / Makkah hotels. Shows how many programs use each hotel.
**User roles who use it:** Both ADMIN + AGENT

### DATA DISPLAYED
- Hotel table: Name, City (green/blue badge with emoji), program count for Madina + Makkah
- Loading spinner, red error banner

### ACTIONS AVAILABLE
- "Nouvel Hôtel" button → toggles create form
- "Modifier" per row → populate form
- "Supprimer" per row → cannot delete if linked to programs (backend constraint surfaces in banner)
- Save (Create or Update) / Cancel

### CURRENT LAYOUT STRUCTURE
- Top: Header "Gestion des Hôtels" + subtitle
- Error banner (conditional)
- Main: Card with "Liste des Hôtels" + "Nouvel Hôtel" button
  - Inline Create/Edit form (Card with gradient header)
  - Hotels table with Modifier / Supprimer per row
- Bottom: Empty state if no hotels
- Modals: none

### FORMS ON THIS PAGE
- Create/Edit form:
  - Fields: name (text, required), city (select: Madina / Makkah)
  - Validation: required name; city has default
  - On submit: POST /api/hotels (create) or PUT /api/hotels/{id} (update)

### CURRENT PROBLEMS
- No success toast — form just closes
- No soft-delete / archive — delete is permanent unless constraint blocks it
- No search box despite potentially many hotels
- No pagination
- Inline create/edit form pushes table down — disorienting

### API CALLS
- GET /api/hotels
- POST /api/hotels
- PUT /api/hotels/{id}
- DELETE /api/hotels/{id}

---

## PAGE: Solde (financial dashboard)
**Route:** /solde
**File:** app/solde/page.tsx
**Purpose:** Comprehensive financial dashboard: KPIs, timeline & monthly charts, per-program / per-agent breakdowns. Filterable, exports CSV.
**User roles who use it:** ADMIN only

### DATA DISPLAYED
- KPI banner: Total Paiements, Total Paiement Prévu, Total Dépenses, Solde Prévu, Solde Final (green/red)
- Timeline (Paiements / Dépenses / Profit) with brushing, reference dots, clickable days
- Monthly comparison (actual vs expected)
- Program comparison (paiements / dépenses / expected)
- Method breakdown (count + amount)
- Expense-type breakdown
- Agent performance (top 8 agents)
- Rooms chart (LIT vs CHAMBRE_PRIVEE by program)
- Hotels chart (pilgrim count by hotel)
- Gender chart
- Solde pie chart
- Analytics cards: program ranking, agent ranking, trends, cashflow, performance metrics (trend %, best period, expense ratio, program diversity)

### ACTIONS AVAILABLE
- Filter by program (dropdown), period (month/quarter/year)
- Chart scale mode (linear vs log signed)
- Chart view mode (raw vs indexed base 100)
- Reset chart preferences (localStorage)
- Click timeline → fetch and modal-show day details
- Export CSV

### CURRENT LAYOUT STRUCTURE
- Top: Page title + Exporter button
- KPI banner (large dark gradient)
- Filters card (5 controls)
- Charts: timeline (large) → 2-col grid (monthly actual / expected) → 2-col (program comparison / others) → rooms/hotels/gender/solde → agent performance
- Below: analytics cards
- Modals: timeline-day details modal

### FORMS ON THIS PAGE
None — filters only.

### CURRENT PROBLEMS
- ~2100+ lines — many chart configs in one file
- localStorage chart prefs lack visible "current setting" indicator
- Scale modes (linear vs log, raw vs indexed) lack inline help
- Agents ranking capped at 8 — no expand or paginate
- Day-detail modal requires extra fetch; lacks skeleton
- No quick filter to look at a single agent or method

### API CALLS
- GET /api/balance
- GET /api/analytics/dashboard
- GET /api/programs
- GET /api/balance/charts/rooms
- GET /api/balance/charts/hotels
- GET /api/balance/charts/gender
- GET /api/balance/charts/solde
- GET /api/balance/charts/timeline
- GET /api/balance/charts/monthly-comparison
- GET /api/balance/charts/program-comparison
- GET /api/balance/charts/timeline/details
- (CSV built client-side)

---

## PAGE: Charges Fixes
**Route:** /charges-fixes
**File:** app/charges-fixes/page.tsx
**Purpose:** ADMIN-only management of monthly recurring charges (LOYER, SALAIRE, CHARGES_DIVERSES, AUTRE). Templates auto-spawn expense records each month via cron (1st @ 06:00) or via the manual "Générer" button.
**User roles who use it:** ADMIN only

### DATA DISPLAYED
- Charge templates table: Libellé, Catégorie, Montant (MAD), Agent (optional), Statut (Actif/Inactif badge), Générations count, Modifier/Supprimer
- Occurrences table (for selected month): charge name, catégorie, montant, linked Expense # + description

### ACTIONS AVAILABLE
- "Nouvelle charge" → dialog
- Pencil → edit dialog
- Trash → delete/deactivate confirmation
- Generate for month: yearMonth picker + Générer button
- Change occurrences view month (yearMonth input)
- Cancel dialog

### CURRENT LAYOUT STRUCTURE
- Top: Title + subtitle (link to /depenses) + "Nouvelle charge" button
- Conditional messages: error (red) / success (green)
- Card 1: "Générer les dépenses pour un mois" — month input + Générer button (spin animation)
- Card 2: "Modèles de charges" — templates table
- Card 3: "Dépenses générées" — month picker + occurrences table
- Modal: Create/Edit dialog

### FORMS ON THIS PAGE
- Create/Edit Charge dialog:
  - Fields: libellé (text, required), montant (decimal accept `,` or `.`, required), catégorie (select LOYER/SALAIRE/CHARGES_DIVERSES/AUTRE, required), agent (optional, select), isActive (checkbox, default true)
  - Validation: label trim required, amount parsed as float
  - On submit: POST /api/fixed-charges (create) or PUT /api/fixed-charges/{id} (update)

### CURRENT PROBLEMS
- No inline validation; errors surface only after submit
- "Générer" can be run on past months with no warning of duplicates (skipped count returned but no preview)
- Occurrences table has no direct edit/delete link to the spawned Expense
- No bulk operations
- Dialog title changes by mode but form layout doesn't visually distinguish

### API CALLS
- GET /api/fixed-charges
- GET /api/admin/agents
- GET /api/fixed-charges/occurrences?yearMonth={YYYY-MM}
- POST /api/fixed-charges
- PUT /api/fixed-charges/{id}
- DELETE /api/fixed-charges/{id}
- POST /api/fixed-charges/generate-month

---

## PAGE: Gestion des Utilisateurs
**Route:** /admin/utilisateurs
**File:** app/admin/utilisateurs/page.tsx
**Purpose:** ADMIN-only CRUD of agent accounts with role + active/inactive toggling.
**User roles who use it:** ADMIN only (RoleProtectedRoute)

### DATA DISPLAYED
- Table: Nom / Email / Rôle (ADMIN purple, AGENT blue) / Statut (Actif green, Inactif red) / Créé le / Actions

### ACTIONS AVAILABLE
- "Nouvel Utilisateur" → shows form
- Modifier (per row) → populate form
- Toggle Activer / Désactiver (PUT with isActive flip)
- Supprimer (DELETE — soft set isActive=false, native browser `confirm()`)
- Cancel (X button clears form)

### CURRENT LAYOUT STRUCTURE
- Top: Title + subtitle + error alert (conditional)
- Main: Card with "Liste des Utilisateurs" header + "Nouvel Utilisateur" button
  - Inline Create/Edit form (Card with blue gradient header, 2-col grid)
  - Users table with action buttons
- Modals: native browser `confirm()` for delete

### FORMS ON THIS PAGE
- Create/Edit form:
  - Fields: nom (text, required), email (email, required), motDePasse (password — required on create, optional on edit), role (select AGENT/ADMIN, default AGENT)
  - Validation: HTML5 required attributes; backend validates uniqueness + password strength
  - On submit:
    - Create → POST /api/admin/agents
    - Edit → PUT /api/admin/agents/{id}

### CURRENT PROBLEMS
- Native `confirm()` instead of the project's Dialog component — inconsistent
- No success toast — only red error alert if something fails
- Toggle button visually similar to Edit — accidental clicks possible
- Table needs horizontal scroll on mobile
- Password optional-on-edit communicated via small text only

### API CALLS
- GET /api/admin/agents
- POST /api/admin/agents
- PUT /api/admin/agents/{id}
- DELETE /api/admin/agents/{id}

---

## PAGE: Journal d'Activité
**Route:** /admin/journal
**File:** app/admin/journal/page.tsx
**Purpose:** ADMIN-only append-only activity log (creations / modifications / deletions / deactivations) across reservations, programs, rooms, charges fixes, agents. Optional per-day filter shows daily expenses + payments.
**User roles who use it:** ADMIN only (RoleProtectedRoute)

### DATA DISPLAYED
- Journal table (25/page): Date (fr-FR), Action (label from ACTION_LABELS), Résumé (truncated), Action par (actor name + role snapshot), Détail
- Detail modal: full `detailText` in monospace, actor info, summary, action type
- Day filter context: Expenses of the day (type, program, agent, amount) + Payments of the day (reservation, program, method, agent, amount) with totals

### ACTIONS AVAILABLE
- Date input filter (YYYY-MM-DD, UTC), Clear all
- Eye → "Détail" modal
- Pagination prev/next (disabled at bounds)
- Toggle journal table collapse

### CURRENT LAYOUT STRUCTURE
- Top: Title (ScrollText in amber circle) + subtitle, day filter bar
- Main: Journal card (header + filtered count + collapse toggle); table with pagination
- Conditional grid (when day filter set): Expenses card (red-tinted) + Payments card (emerald-tinted)
- Modal: Detail dialog (max-w-3xl, scrollable)

### FORMS ON THIS PAGE
- Day filter:
  - Field: filterDay (date input, optional)
  - Validation: regex `/^\d{4}-\d{2}-\d{2}$/`
  - On change: setFilterDay, reset page to 1, fetch

### CURRENT PROBLEMS
- Date input labeled "UTC" but local Date used in helper — TZ confusion
- Daily expenses/payments only show when a day is filtered — no "today" default shortcut
- Long `detailText` may overflow on small screens despite overflow-auto
- Agent label fallback logic is hidden in code; users can't tell why a row's "Action par" looks different
- Pagination silently resets when filter changes (no confirmation)
- Unmapped action enums render raw

### API CALLS
- GET /api/journal-suppressions?page&limit&day

---

## CROSS-PAGE INCONSISTENCIES

Items where the same UX element behaves differently across pages. Each one is a redesign opportunity.

### 1. List page chrome is not unified
- Reservations: card-row layout (custom 2-tier rows)
- Paiements: flexbox rows with wrap
- Dépenses: grouped collapsible cards (per reservation)
- Programmes: card-with-tabs per program
- Hôtels: classic HTML table
- Utilisateurs: classic HTML table
- Charges fixes: classic HTML table
- Solde: chart-driven, no list
→ No shared `<DataList>` component.

### 2. Search/filter affordance is inconsistent
- Reservations: large search bar + 3 selects + rows-per-page select
- Paiements: search + program + method
- Dépenses: search + program + type
- Programmes: search + program select only
- Hôtels: no search at all
- Utilisateurs: no search at all
- Charges fixes: no search at all
- Journal: only date filter
→ Some lists have search, others don't, despite all being scannable lists.

### 3. Pagination is inconsistent
- Reservations: real backend pagination + rows-per-page selector
- Paiements / Dépenses / Hôtels / Utilisateurs / Charges fixes: load-all, no pagination at all
- Journal: backend pagination (fixed 25/page, no rows-per-page selector)
→ Three different paradigms.

### 4. "Nouveau X" CTA pattern differs
- Reservations: two coloured gradient buttons (blue + emerald) in the header
- Paiements / Dépenses / Hôtels / Utilisateurs / Charges fixes / Programmes: a single button in the header
- Programmes: button shows only when ADMIN
- Paiements: button shows for both roles even though the action is ADMIN-only
→ Role gating not reflected at trigger level uniformly.

### 5. Stat-card style differs
- Reservations: large coloured gradient cards with absolute-positioned bubbles + hover scale
- Paiements / Dépenses: smaller gradient cards with two circular ornament divs
- Programmes: flat shadow cards
- Solde: a single dark gradient banner with inline KPIs
- Dashboard: white cards with coloured icons only
→ No consistent KPI card.

### 6. Delete confirmation widget varies
- Reservations: shadcn `Dialog`
- Programmes: a `DeleteConfirmation` component
- Utilisateurs: native browser `confirm()`
- Hôtels: no confirmation — relies on backend constraint
- Charges fixes: an inline confirmation block
→ Four different patterns for the same action.

### 7. Feedback after success varies
- Reservations / Nouvelle Réservation / Edits: shadcn toast via `useToast`
- Paiements / Dépenses creates: toast
- Hôtels: no toast — form just closes
- Utilisateurs: no toast — only red error alert if it fails
- Charges fixes: green/red message banner (custom)
→ Toast + banner + silent across the app.

### 8. Phone & passport validation rules differ
- Nouvelle Réservation: strict regex `^\+\d{3}\s\d{9}$`, passport `^[A-Z]{2}\d{7}$`
- Nouvelle Chambre Privée: same strict regex applied to leader
- Modifier-simple / Modifier-chambre: strict regex
- Modifier (legacy full edit): no regex on phone, free text
- Login / Register / Utilisateurs forms: no phone field, but Utilisateurs has no email format check beyond HTML5
→ Same data, different validation across pages.

### 9. Reservation edit routes are three different files
- `/reservations/[id]` → read-only (unused — list never links to it)
- `/reservations/modifier/[id]` → legacy full editor (unused from list)
- `/reservations/modifier-simple/[id]` → simple LIT edit (linked from list)
- `/reservations/modifier-chambre/[id]` → group edit (linked from list)
→ Two of the four reservation routes appear effectively dead.

### 10. Document upload endpoints are mixed
- Passport / payment receipts: POST /api/upload-cloudinary
- Visa / hotelBooked / flightBooked (legacy): POST /api/upload (local multer)
→ Two upload pipelines coexist, with different deletion semantics.

### 11. "Plan" theming reused across LIT and CHAMBRE pages
- Économique / Normal / VIP — same theme map (Leaf / ShieldCheck / Crown, slate / emerald / amber) inlined in both Nouvelle Réservation and Nouvelle Chambre
- Reusable theme component absent; both files re-declare `planThemes`
→ Drift risk.

### 12. Room picker UI is different for the same task
- Nouvelle Réservation: place-grid with per-place dot click
- Nouvelle Chambre Privée: room candidate cards, click to select an entire vacant room
- Modifier-chambre / Modifier-simple: rooms not editable
- Programmes (admin): +/- buttons with occupied count constraint
→ Four UIs for "pick a room".

### 13. Pricing controls (reduction / proposition) reused but hidden
- On both new-reservation pages, the controls sit in a small bottom-bar widget that can be missed
- Edit pages don't expose the same "Reduc/Propos" toggle in the same place
→ Inconsistent placement of the same control.

### 14. Customization panel is collapsed by default everywhere
- Avion/Visa toggles, days override, plan selection, family mixed: all hidden behind "Éditer"
- Important pricing inputs essentially invisible on first load
→ Consistently hidden — consistent but consistently bad.

### 15. Stats sometimes derived twice
- Dépenses page mixes `/api/expenses/stats` and client-side fallback computation — possible drift
- Reservations stats come from a dedicated endpoint
- Programmes overview returns stats inline with each program
→ No unified stats shape.

### 16. Hotel name display inconsistent
- Reservations list: `hotels.find(h => h.id.toString() === reservation.hotelMadina)?.name || reservation.hotelMadina` — but `hotels` state is never populated; shows raw IDs
- Dashboard / Programmes: shows hotel.name directly
- Reservation detail: shows the stored value (which is a name on new pages, an ID on edit pages — divergence)
→ A reservation row may show an ID, a name, or a stale label.

### 17. Empty states differ
- Dashboard: full card with 🏨 and copy
- Reservations / Paiements / Dépenses: implicit empty (no row)
- Programmes: empty state present but small
- Hôtels: explicit "Aucun hôtel" copy
→ No shared `<EmptyState>`.

### 18. Page background style differs
- Reservations / Dashboard / Hôtels / Paiements / Dépenses: `from-slate-50 via-blue-50 to-indigo-100`
- Nouveau Paiement / Nouvelle Dépense: `from-indigo-50 via-white to-cyan-50`
- Login: dark with image
- Solde: KPI banner dark, body white
→ Visual disconnect between list and create pages.

### 19. Role gating placement
- Admin pages (Utilisateurs / Journal): use `RoleProtectedRoute`
- Paiements/Nouveau, Dépenses, Charges fixes: inline `useAuth().isAdmin` check
- Programmes list: page-level role gate
- Reservations: per-action gate (delete button visible only to admin)
→ Three different role-gate mechanisms.

### 20. Soft-delete / journal coverage uneven
- Programmes, reservations, fixed charges: spawn JournalSuppression entries
- Hotels: hard delete only (no soft state) — visible in /hotels page
- Users: soft delete only (sets isActive=false)
→ Same domain, different deletion semantics.

### 21. Sticky / fixed bottom bars only on Nouvelle pages
- Nouvelle Réservation and Nouvelle Chambre Privée: fixed bottom bar with prix and Confirm button
- Modifier-simple / Modifier-chambre / Modifier (legacy): no fixed bar
→ Same form intent, different submit affordance.

### 22. Two upload deletion behaviors
- Modifier-simple / Modifier-chambre: explicit DELETE /api/upload-cloudinary/{id} on replace
- Modifier (legacy): same path
- Nouvelle (creation): no delete needed; uploads go through immediately
→ Cleanup logic duplicated across 3 edit files.

### 23. "Generate receipt" canvas dialog is identical code on both new-reservation pages
- Same canvas dimensions, fonts, text layout duplicated in both Nouvelle Réservation and Nouvelle Chambre Privée
→ Cannot evolve receipt template without touching two files.

### 24. Date inputs vary
- Reservations / Edit: native HTML date input
- Programmes (Nouveau / Modifier): popover calendar picker (Radix-based)
- Journal: native date input
- Charges fixes: native month input
→ Multiple date-picker styles.

### 25. Notification stack
- Most pages use `useToast` (Sonner)
- Hôtels uses inline error banner
- Charges fixes uses custom green/red banner
- Login/Register use inline error in the form
→ At least 4 distinct notification mechanisms.
