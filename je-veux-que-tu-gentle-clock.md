# Plan — Hôtels « Autre » génériques dans un programme

> **Document de passation — à suivre dans une nouvelle session Claude Code.**
> Ce fichier est **autonome** : il contient tout le contexte (schéma actuel, chemins de fichiers, numéros de ligne, formes de payload) pour implémenter sans ré-explorer le code.
>
> **Comment l'utiliser** : ouvrir une nouvelle session Claude Code à la racine du projet et écrire :
> « Implémente le plan décrit dans `C:\Users\BXBD1836\.claude\plans\je-veux-que-tu-gentle-clock.md`. Commence par le commit 1 (Phases 1-3). »
> La session doit lire ce fichier en entier, puis ouvrir uniquement les fichiers cités pour appliquer les changements. Toujours valider au runtime (les builds ignorent les erreurs TS/ESLint).
>
> Repo : Next.js 14 (racine) + Express/Prisma (`backend/`). UI en français. Voir l'**Annexe** en bas pour l'état actuel exact du code.
>
> **Pour REPRENDRE dans une nouvelle conversation** : lire ce fichier EN ENTIER + la section « 📍 État d'avancement » ci-dessous, ET vérifier l'état réel via `git log`/`git status` sur la branche `feat/hotels-autre`. Continuer à la « prochaine étape » indiquée, mêmes garde-fous. **Mettre à jour « 📍 État d'avancement » après chaque étape.**

## ⚠️ Règles permanentes (toute session)

- **NE JAMAIS toucher la table `Agent`** (comptes de connexion — c'est ce qui permet d'accéder à l'app). Aucune suppression/modification de lignes `Agent`, aucun `ALTER`/drop du modèle `Agent`, aucun seed qui le réinitialise. Si une opération risque d'y toucher → **STOP et demande**.
- **DB = Railway prod**, schéma appliqué via `npx prisma db push` (ce repo n'a **pas** de migrations). **Interdits** : `--accept-data-loss`, `migrate reset`, `--force-reset`, `prisma:seed`. Changements de schéma **uniquement additifs**. Si Prisma signale la moindre perte de données → **STOP**.
- Le build ignore les erreurs TS/ESLint → valider au **runtime**, jamais sur « ça compile ».
- **UI en français.** Réutiliser les helpers existants, ne rien réimplémenter.
- **Committer à chaque fin de phase** sur `feat/hotels-autre` (checkpoint durable) — c'est ce qui permet à une nouvelle conversation de reprendre proprement via `git log`.

## 📍 État d'avancement (Claude Code MET À JOUR cette section après CHAQUE étape)

- **Branche** : `feat/hotels-autre`
- **Dernier commit** : `88d5c36` — fin Phase 3 (pages `modifier*` + détail affichent les hôtels Autre). Avant : `90815c7` (Phases 1-3 création).
- **Fait** : Phase 1 ✅ · Phase 2 ✅ (vérifié runtime API) · Phase 3 ✅ COMPLÈTE — création (`nouvelle`, `nouvelle-chambre`, `programmes/nouveau`, `hotels`) + `modifier/[id]`, `modifier-chambre/[id]`, `modifier-simple/[id]`, détail `[id]`. Toutes compilent + rendent (HTTP 200). **Click-through navigateur reste à confirmer par l'utilisateur.**
- **Prochaine étape** : confirmer Phase 3 au navigateur (scénarios Phase 5) → push prod (Vercel + Railway) → Phase 4 (reporting : export, balance, analytics, reçu)
- **Reste après ça** : Phase 4 (reporting) — voir Phase 4 du plan
- **Repères déjà créés** : helper `parseHotelsAutre` → `backend/src/services/hotelsAutreService.ts` ; `applyRoomBooking` factorisé dans `reservations.ts` ; composant `components/reservations/HotelCategoryBlock.tsx`
- **Données de test (Railway)** : programme id 36 « TEST M+M+Autre » (Madina+Makkah+2 Autre) ; id 37 « TEST Autre seul » (2 Autre uniquement) ; hôtels Autre « Hotel Istanbul TEST », « Hotel Le Caire TEST » ; réservation id 167 (LIT sur prog 36 avec 1 hôtel Autre) pour tester pages modifier*/détail

## Contexte

Aujourd'hui un programme OMRA n'a que **2 catégories d'hôtels figées** : Madina et Makkah. C'est codé en dur partout (enum `City { Madina, Makkah }`, deux tables de jointure `ProgramHotelMadina`/`ProgramHotelMakkah`, deux champs `hotelMadina`/`hotelMakkah` sur la réservation, deux blocs UI dupliqués sur 6 pages).

**Besoin** : l'Admin doit pouvoir inclure dans un programme **un nombre quelconque d'hôtels supplémentaires** (ex : Turquie → ville X → ville Y), chacun avec ses chambres et son nombre de nuits. Ces hôtels sont créés sur la page `/hotels` avec la ville **« Autre »**. Lors de la création/modification d'une réservation (et d'une chambre), un **3ᵉ bloc « Autre »** apparaît sous Madina/Makkah, listant uniquement les hôtels Autre liés au programme sélectionné, avec la même sélection de chambres/places. La sélection est **optionnelle**, et chaque hôtel Autre entre dans le **calcul du prix** (prix chambre × nb nuits × taux de change), exactement comme Madina/Makkah.

**Principe directeur** : garder strictement le même concept que Madina/Makkah, en le généralisant à N hôtels « Autre ».

**Important (précision utilisateur)** : un programme peut contenir **n'importe quelle combinaison** d'hôtels — uniquement des Autre, uniquement Madina, uniquement Makkah, ou un mélange. **Aucune catégorie n'est obligatoire** : Madina et Makkah deviennent optionnels au même titre qu'Autre. Tout ce qui impose aujourd'hui Madina/Makkah (labels `*`, validations de formulaire, calcul de prix exigeant les deux hôtels) doit être assoupli. Chaque formulaire n'affiche que les blocs des catégories réellement présentes dans le programme sélectionné.

## Décision technique

- **Source des hôtels** : enum `City` étendu avec la valeur `Autre`. La page `/hotels` permet de créer des hôtels `Autre`.
- **Programme ↔ hôtels Autre** : nouvelle table de jointure `ProgramHotelAutre` qui, contrairement aux deux existantes, porte `nbJours` (nuits par hôtel) et `ordre` (séquence d'affichage Turquie→X→Y).
- **Chambres** : réutilisation **telle quelle** du modèle `Room` (déjà lié par `hotelId`+`programId`, ville implicite via `hotel.city`). Aucun changement de modèle.
- **Réservation ↔ hôtels Autre** : nouveau champ JSON `hotelsAutre Json?` sur `Reservation`, stockant un tableau `[{ hotelId, roomId, hotelName }]` (le **nom est snapshoté** pour que exports/reçus restent lisibles si l'hôtel est renommé/supprimé). Choix cohérent avec le style dénormalisé existant (`hotelMadina` en string, `listeIdsReservation Int[]`) et qui évite d'alourdir les très nombreux `include` de réservation. Le décrément des places réutilise le mécanisme existant (`nbrPlaceRestantes` + `listeIdsReservation`).
- **Helper partagé unique** : définir côté backend un type `HotelAutreEntry = { hotelId: number; roomId: number; hotelName: string }` + une fonction `parseHotelsAutre(json): HotelAutreEntry[]`, utilisés par `reservations.ts`, `export.ts`, `balance.ts`, analytics et `generateReceipt`. Évite que chaque endroit parse le JSON différemment (cause des incohérences).

### Découvertes de la relecture du code (intégrées)
- **Suppression déjà générique — aucun changement requis.** `reservations.ts:1315-1335` retrouve les rooms via `listeIdsReservation: { hasSome }` (sans regarder la ville) et recalcule `nbrPlaceRestantes = nbrPlaceTotal − ids.length`. Tant que le booking Autre pousse l'id dans `listeIdsReservation`, les places Autre sont restaurées automatiquement à la suppression.
- **Incohérence `balance.ts` à corriger.** `balance.ts:426-432` agrège en utilisant la **chaîne brute** comme nom (`hotelStats[reservation.hotelMadina]`), alors qu'`export.ts:277-293` la traite comme un **id à résoudre**. Comme `hotelsAutre` contient des ids, l'agrégation doit résoudre id→nom (utiliser `hotelName` snapshoté ou résoudre via la table Hotel) ; aligner aussi Madina/Makkah au passage.
- **`nbJours` par hôtel (jointure) vs par programme.** `Program.nbJoursMadina/Makkah` sont par programme ; `ProgramHotelAutre.nbJours` est par hôtel (justifié : Turquie→X→Y ont chacun leurs nuits). Le prix Autre lit les nuits depuis `hotelsAutre[].nbJours` du programme.

---

## Phase 1 — Schéma & migration (`backend/prisma/schema.prisma`)

1. `enum City { Madina, Makkah, Autre }`.
2. Nouveau modèle :
   ```prisma
   model ProgramHotelAutre {
     id        Int     @id @default(autoincrement())
     programId Int
     hotelId   Int
     nbJours   Int     @default(0)
     ordre     Int     @default(0)
     hotel     Hotel   @relation(fields: [hotelId], references: [id], onDelete: Cascade)
     program   Program @relation(fields: [programId], references: [id], onDelete: Cascade)
     @@unique([programId, hotelId])
   }
   ```
3. `Program` : ajouter `hotelsAutre ProgramHotelAutre[]`.
4. `Hotel` : ajouter `programsAutre ProgramHotelAutre[]`.
5. `Reservation` : ajouter `hotelsAutre Json?`.
6. Migration : `npx prisma migrate dev` en local (puis `prisma migrate deploy` en prod via Railway). `npm run build` du backend régénère le client Prisma.

---

## Phase 2 — Backend cœur (commit 1)

### `backend/src/routes/hotels.ts`
- `VALID_CITIES = ['Madina', 'Makkah', 'Autre']` (ligne 7) — débloque la création/màj d'hôtels `Autre` et `GET /available?city=Autre`.
- Messages d'erreur « Use Madina or Makkah » → inclure Autre.
- `DELETE /:id` : ajouter le comptage `programHotelAutre` (lignes 283-300) pour empêcher la suppression d'un hôtel Autre utilisé.

### `backend/src/routes/programs.ts`
- POST `/` et PUT `/:id` : extraire `hotelsAutre` du body (chaque entrée : `{ name, nbJours, ordre, chambres: {1..5:{nb,prix}} }`).
- Généraliser `findOrCreateHotel` et les helpers `upsertRoomsForEntries`/`upsertRoomsForEntriesWithTx` au type `city: 'Madina' | 'Makkah' | 'Autre'`, et ajouter la branche de liaison `programHotelAutre` (avec `nbJours`/`ordre`) à côté des branches `programHotelMadina`/`programHotelMakkah` (lignes ~390-396, ~606-626). La création des chambres (types 1-5, gender `Mixte`) est identique.
- Appeler le helper pour `hotelsAutre` (à côté des lignes 835-836 et 159-282).
- Inclure `hotelsAutre: { include: { hotel: true } }` dans **tous** les `include` de programme (GET `/`, GET `/:id`, retours de POST/PUT — lignes 25-28, 47-50, 288-291, 848-851).
- Hard-delete (lignes 977-984) : ajouter `tx.programHotelAutre.deleteMany({ where: { programId } })`.
- `ProgramOverviewController` : vérifier si l'overview agrège par hôtel/ville et y inclure Autre.

### `backend/src/routes/reservations.ts`
- POST `/` (ligne 511) : accepter `hotelsAutre` (tableau `[{hotelId, roomId, hotelName}]`) + persister `hotelsAutre` JSON sur la réservation (zone lignes 526-556). Après création, **boucler** sur les rooms Autre pour décrémenter `nbrPlaceRestantes` et pousser l'id dans `listeIdsReservation` — réutiliser exactement le bloc Madina (lignes 582-627) factorisé en une petite fonction `applyRoomBooking(roomId, roomType, gender, reservationId)`.
- POST `/group` (ligne 317) : accepter `common.hotelsAutre` + un tableau de `roomAutreIds`, décrémenter chaque room Autre (groupSize) comme Madina/Makkah (lignes 416-431), persister `hotelsAutre` sur chaque membre. **Assouplir la validation** lignes 339-341 qui impose actuellement `roomMadinaId` ET `roomMakkahId` : exiger qu'**au moins une** room (Madina, Makkah ou Autre) soit fournie, et ne décrémenter que les rooms réellement présentes.
- PUT `/:id` + `buildReservationUpdateData` (lignes 732-735, 950-951) : gérer `hotelsAutre` comme `hotelMadina`/`hotelMakkah` (champ leader uniquement). Si le changement de room Autre doit re-décrémenter, suivre la logique existante (à vérifier : le PUT actuel ne réajuste pas les places Madina/Makkah → rester cohérent et ne pas le faire non plus pour Autre dans cette itération).
- DELETE `/:id` : **aucun changement** — la restauration des places (lignes 1315-1335) est déjà générique (scan par `listeIdsReservation`).

### `services/journalSuppressionService.ts` (cœur — commit 1)
- Libellés d'affichage (lignes 136-137, 208-209, 270) : ajouter « Autre » pour les logs de suppression.

---

## Phase 3 — Frontend cœur (commit 1)

### Types partagés
- Interfaces `Program` / `Hotel` (dans `app/reservations/nouvelle/page.tsx`, `nouvelle-chambre`, les 3 `modifier*`, et `app/programmes/*`) : ajouter `hotelsAutre: Array<{ hotel: Hotel; nbJours: number; ordre: number }>`. `Hotel.city` accepte `'Autre'`.

### Composant réutilisable (amélioration clé)
- Extraire un composant `HotelCategoryBlock` (ex. `components/reservations/HotelCategoryBlock.tsx`) paramétré par : libellé/icône, liste d'hôtels de la catégorie, valeur sélectionnée, état des places (`selectedPlaces`), callbacks. L'utiliser pour **Madina, Makkah et Autre** sur les pages de saisie (`nouvelle`, `nouvelle-chambre`). L'affichage « uniquement les catégories présentes » devient un simple rendu conditionnel/`.map()`, et le bloc Autre n'est qu'un `.map()` sur `hotelsAutre`. Réduit fortement la surface de bug par rapport à un copier-coller dans 6 pages.

### Page `/hotels` (formulaire de création/édition d'hôtel)
- Ajouter l'option **« Autre »** dans le `Select` de ville. (Repérer le composant via grep `city` / `Madina` sous `app/hotels/`.)

### Formulaire programme — `app/programmes/nouveau/page.tsx` & `app/programmes/modifier/[id]/page.tsx`
- Ajouter une **3ᵉ section « Hôtels Autre »** sous Makkah, sur le modèle exact des sections Madina/Makkah (cases à cocher des hôtels `city='Autre'` chargés depuis `/api/hotels/available?city=Autre`, config chambres types 1-5, option « Autre » free-input pour créer un hôtel à la volée).
- Ajouter par hôtel Autre un champ **nb de nuits** (`nbJours`) et l'ordre (séquence). Inclure `hotelsAutre` dans `formData` et dans le payload POST/PUT.
- **Rendre Madina/Makkah optionnels** : retirer le `*` des titres « Hôtels à Madina/Makkah » et toute validation qui empêche de soumettre un programme sans hôtel Madina ou Makkah. Un programme peut être enregistré avec uniquement des hôtels Autre.

### Réservation — `app/reservations/nouvelle/page.tsx`
- **Affichage conditionnel** : n'afficher le bloc Madina que si `hotelsMadina.length > 0`, idem Makkah, idem Autre. Un programme sans Madina/Makkah ne montre pas ces blocs. Retirer les `*` et toute validation imposant Madina/Makkah.
- **Bloc « Autre »** sous le grid Madina/Makkah (lignes ~2194-2450) : pour **chaque** hôtel de `programmeSelectionne.hotelsAutre`, un `Select` (« Sans hôtel » + l'hôtel) + la visualisation des chambres/places (réutiliser le composant de places, state `selectedPlacesAutre: { [hotelId]: { [roomId]: number[] } }`).
- **Prix** (calcul lignes 620-680) : assouplir le garde-fou actuel qui retourne 0 si `hotelMadina`/`hotelMakkah` absents (ligne ~620) → calculer à partir des catégories **présentes**. Ajouter `prixHotelAutre = Σ (prixRoom/nbPersonnes) * nbJours(hôtel)` pour chaque hôtel Autre sélectionné. Total = `prixAvion + profit + (prixVisa + prixHotelMadina + prixHotelMakkah + prixHotelAutre) * exchange`, chaque terme hôtel valant 0 si la catégorie est absente/non sélectionnée.
- **Submit** (lignes 1544-1545) : ajouter `hotelsAutre: [{hotelId, roomId, hotelName}]` dérivé de `selectedPlacesAutre`. `roomMadinaId`/`roomMakkahId` restent `null` si absents.

### Réservation chambre privée/groupe — `app/reservations/nouvelle-chambre/page.tsx`
- Même 3ᵉ bloc (lignes ~1462-1524), affichage conditionnel par catégorie, envoi de `common.hotelsAutre` + `roomAutreIds` au POST `/group`. Retirer les `*` Madina/Makkah et n'exiger qu'au moins une room sélectionnée (cohérent avec l'assouplissement backend).

### Pages de modification — `modifier/[id]`, `modifier-chambre/[id]`, `modifier-simple/[id]`
- Afficher/éditer le bloc Autre en cohérence (lecture de `reservation.hotelsAutre`, résolution des noms via `getHotelName` ou `hotelName` snapshoté), même rendu que Madina/Makkah ; affichage conditionnel par catégorie.

### Page détail (lecture seule) — `app/reservations/[id]/page.tsx`
- Afficher les hôtels Autre assignés (à partir de `reservation.hotelsAutre`), comme Madina/Makkah. (Oubliée par le périmètre initial.)

---

## Phase 4 — Reporting (commit 2, séparable)

Tout ce qui lit `hotelsAutre` pour de l'affichage/agrégation, via le helper `parseHotelsAutre`.

- **`backend/src/routes/export.ts`** : alimenter `hotelIdSet` depuis `r.hotelsAutre` (lignes 277-293) ; ajouter colonne(s) « Hôtels Autre » résolvant chaque entrée → nom (`hotelName` snapshoté ou `resolveHotel`).
- **`backend/src/routes/balance.ts`** : ajouter `hotelsAutre: true` au `select` (lignes 416-417) ; agréger `hotelStats` en itérant le JSON avec **résolution id→nom** ; corriger au passage l'incohérence Madina/Makkah qui agrège la chaîne brute (lignes 426-432).
- **`analytics` / `ProgramOverviewController`** : si l'overview agrège par hôtel/ville, y inclure Autre.
- **`lib/generateReceipt.ts`** : si le reçu liste les hôtels, y inclure les hôtels Autre (réutiliser le helper existant, cf. mémoire `receipt-generator-helper` — ne pas réimplémenter le canvas).
- **`backend/src/routes/expenses.ts`** : les « Madina/Makkah » concernent les **catégories de dépense**, pas les liens hôtel — vérifier s'il faut une catégorie « Autre » (changement léger, à confirmer pendant l'exécution).

## Phase 5 — Vérification (end-to-end)

1. **DB** : `cd backend; npx prisma migrate dev` puis `npm run build` (régénère le client). Démarrer backend `npm run dev` et frontend `npm run dev`.
2. **Hôtels** : sur `/hotels`, créer 2 hôtels avec ville **Autre** (ex. « Hôtel Istanbul », « Hôtel Le Caire »).
3. **Programme** : créer un programme incluant 1 hôtel Madina + 1 Makkah + 2 Autre (avec nb nuits + chambres). Vérifier en DB que `ProgramHotelAutre` et les `Room` Autre sont créés. Modifier le programme (changer un prix/nb chambres Autre) → vérifier l'upsert non destructif. **Créer aussi un programme avec UNIQUEMENT des hôtels Autre** (aucun Madina/Makkah) → doit s'enregistrer sans erreur.
4. **Réservation (LIT)** : sur `/reservations/nouvelle`, sélectionner le programme → le bloc Autre liste les 2 hôtels. Choisir une chambre Autre, vérifier que le **prix** intègre les nuits Autre et que `nbrPlaceRestantes` décrémente. Laisser un hôtel Autre « Sans hôtel » → doit rester optionnel. **Tester avec le programme « Autre uniquement »** : les blocs Madina/Makkah ne s'affichent pas et le prix se calcule correctement sans eux.
5. **Chambre privée (groupe)** : créer un groupe avec room Autre → décrément `groupSize` sur la room Autre.
6. **Modification** : modifier la réservation, vérifier l'affichage/édition du bloc Autre.
7. **Suppression** : supprimer la réservation → vérifier la restauration des places Autre.
8. **Exports/Solde** : export Excel affiche les hôtels Autre ; page `/solde` agrège les stats hôtels Autre.

---

## Notes / risques
- Migration de production sur Railway (`prisma migrate deploy` au démarrage) — vérifier que la migration est bien committée.
- `next.config.mjs` ignore les erreurs TS/ESLint au build → ne pas se reposer dessus ; tester le runtime.
- Les réservations existantes auront `hotelsAutre = null` → tous les chemins doivent traiter l'absence comme « aucun hôtel Autre ».
- **Découpage validé en 2 commits** : commit 1 = cœur (Phases 1-3, testable de bout en bout) ; commit 2 = reporting (Phase 4 : exports, solde, analytics, reçu).
- Décisions validées : snapshot `hotelName` dans le JSON ; extraction d'un composant `HotelCategoryBlock` ; livraison en 2 commits.

---

## Annexe — État actuel du code (référence, pour éviter toute ré-exploration)

### Schéma Prisma actuel (`backend/prisma/schema.prisma`)
- `enum City { Madina  Makkah }` (≈ lignes 279-282).
- `Program` (≈ 93-118) : champs `nbJoursMadina`, `nbJoursMakkah`, `exchange`, `prixAvionDH`, `prixVisaRiyal`, `profit*`, deadlines ; relations `hotelsMadina ProgramHotelMadina[]`, `hotelsMakkah ProgramHotelMakkah[]`, `rooms Room[]`, `reservations`, `expenses`, `payments`. **Pas** de FK hôtel directe.
- `Hotel` (≈ 120-129) : `id`, `name @db.VarChar(150)`, `city City`, relations `programsMadina`, `programsMakkah`, `rooms` ; `@@unique([name, city])`.
- `ProgramHotelMadina` / `ProgramHotelMakkah` (≈ 131-149) : `{ id, programId, hotelId, hotel, program, @@unique([programId, hotelId]) }`, `onDelete: Cascade`. **Aucun** `nbJours`/`ordre`.
- `Room` (≈ 151-165) : `{ id, programId, hotelId, roomType RoomType, gender String, nbrPlaceTotal, nbrPlaceRestantes, prixRoom, listeIdsReservation Int[], ... }`. Pas de FK vers Reservation (lien dénormalisé via `listeIdsReservation`).
- `Reservation` (≈ 167-210) : hôtels stockés en **string** `hotelMadina String?` / `hotelMakkah String?` (contiennent l'**id** de l'hôtel en texte) ; `roomSlot Int?` ; hiérarchie famille `parentId`/`groupId`/`isLeader`. Pas de `roomId`.
- `enum RoomType { SINGLE DOUBLE TRIPLE QUAD QUINT }` ; mapping type→capacité : 1=SINGLE…5=QUINT.

### Ancres backend
- `programs.ts` : `findOrCreateHotel(city: 'Madina'|'Makkah', name)` (118, 369) ; création rooms POST (159-282) ; `upsertRoomsForEntries` hors-tx (382) et `upsertRoomsForEntriesWithTx` en tx (585) ; appels finaux (835-836) ; includes programme (25-28, 47-50, 288-291, 848-851) ; hard-delete cascade (961-995, jointures 977-984).
- `hotels.ts` : `VALID_CITIES` (7-8) ; validations « Use Madina or Makkah » (90, 199, 234) ; garde DELETE comptant les jointures (283-300).
- `reservations.ts` : POST `/` (509) avec `roomMadinaId`/`roomMakkahId` → décrément (582-627 Madina, 630-675 Makkah) via `getPlacesByRoomType(roomType)` ; POST `/group` (317) exige les 2 rooms (339-341), décrément groupSize (416-431) ; PUT `/:id` (873) + `buildReservationUpdateData` (715, champs hôtel 732-735, 950-951) ; DELETE restauration **générique** (1315-1335, scan `listeIdsReservation: { hasSome }`).
- `export.ts` : collecte ids hôtels (277-293) ; résolution `resolveHotel` + affichage (374-375).
- `balance.ts` : `select` hôtels (416-417) ; `hotelStats` par chaîne brute (426-432) — **bug** à corriger en id→nom.

### Ancres frontend
- `app/reservations/nouvelle/page.tsx` : interfaces `Program`/`Hotel` ; `hotelsMadina = programmeSelectionne?.hotelsMadina?.map(ph => ph.hotel)` ; blocs hôtels (≈ 2194-2450) ; calcul prix (620-680, garde-fou exigeant les 2 hôtels ≈ 620, `prixHotelMadina` 625) ; `selectedPlacesMadina`/`selectedPlacesMakkah` ; submit `roomMadinaId`/`roomMakkahId` (1544-1545).
- `app/reservations/nouvelle-chambre/page.tsx` : blocs hôtels (≈ 1462-1524), POST `/group`.
- `app/programmes/nouveau/page.tsx` : `formData.hotelsMadina/hotelsMakkah` (`{name, chambres:{1..5:{nb,prix}}}`), sections Madina (≈ 1350-1545) / Makkah (≈ 1547-1729), option « Autre » free-input existante (ajoute un hôtel dans une catégorie existante — à ne pas confondre avec la nouvelle catégorie Autre).
- `app/programmes/modifier/[id]/page.tsx`, `app/reservations/modifier/[id]`, `modifier-chambre/[id]`, `modifier-simple/[id]`, `app/reservations/[id]/page.tsx` (détail), `app/hotels/*` (formulaire ville).

### Payloads de référence
- **POST/PUT `/api/programs`** : `{ name, nbJoursMadina, nbJoursMakkah, exchange, prixAvionDH, prixVisaRiyal, profit*, *Deadline, hotelsMadina:[{name, chambres:{1:{nb,prix},…,5:{…}}}], hotelsMakkah:[…] }`. → **ajouter** `hotelsAutre:[{name, nbJours, ordre, chambres:{…}}]`.
- **POST `/api/reservations`** : `{ firstName, lastName, phone, programId, roomType, gender, hotelMadina, hotelMakkah, price, reservationDate, status, statut*, paidAmount, reduction, roomMadinaId, roomMakkahId, plan, typeReservation, isLeader, parentId, groupId, familyMixed, roomSlot }`. → **ajouter** `hotelsAutre:[{hotelId, roomId, hotelName}]` (+ décrément des rooms Autre).
- **POST `/api/reservations/group`** : `{ groupId, typeReservation, familyMixed, roomType, roomMadinaId, roomMakkahId, occupants:[…], leaderPrice, leaderPaidAmount, reservationDate, common:{ programId, hotelMadina, hotelMakkah, status, statut*, reduction, plan, groupe, remarque, transport } }`. → **ajouter** `common.hotelsAutre` + `roomAutreIds:[…]`, assouplir l'exigence des 2 rooms.

### Commandes
- Backend : `cd backend; npx prisma migrate dev` (local) ; `npm run build` (tsc + prisma generate) ; `npm run dev`. Prod Railway : `prisma migrate deploy` au démarrage.
- Frontend : `npm run dev` (port 3000).
