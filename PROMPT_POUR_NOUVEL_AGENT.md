# 🚀 PROMPT POUR NOUVEL AGENT - Import Excel Réservations

## 📋 CONTEXTE DU PROJET

Vous travaillez sur une **application de gestion de voyages Omra** (Next.js + TypeScript + Prisma + PostgreSQL). L'application permet de gérer des programmes de voyage, des réservations, des paiements, des dépenses, etc.

**Structure principale :**
- Frontend : Next.js (app/ directory)
- Backend : Express.js (backend/src/)
- Base de données : PostgreSQL avec Prisma ORM
- Stockage fichiers : Cloudinary

---

## 🎯 OBJECTIF DE LA TÂCHE

**Implémenter une fonctionnalité d'import Excel** qui permet d'importer plusieurs réservations depuis un fichier Excel en une seule fois. Le fichier Excel contient des données en français et en arabe, avec des hyperliens vers Google Drive pour les images.

**Exigences :**
1. Parser un fichier Excel avec colonnes en français/arabe
2. Extraire les hyperliens Google Drive depuis les cellules
3. Télécharger les fichiers depuis Google Drive
4. Créer les réservations en reproduisant EXACTEMENT le flux de création manuelle
5. Gérer les hôtels (trouver ou créer automatiquement)
6. Assigner les chambres disponibles
7. Créer les paiements, expenses, et uploader les fichiers

---

## ✅ CE QUI A DÉJÀ ÉTÉ FAIT

### 1. Modifications du Schéma de Base de Données

**Fichier :** `backend/prisma/schema.prisma`

**Champs ajoutés dans le modèle `Reservation` :**
- `passportNumber String? @db.VarChar(50)` - Numéro de passeport
- `transport String? @db.VarChar(100)` - Type de transport
- `remarque String? @db.Text` - Notes/remarques
- `groupe String? @db.VarChar(100)` - Groupe de réservation

**Migration créée :** `backend/prisma/migrations/20251231143246_add_reservation_fields/`
- ⚠️ **À APPLIQUER** : `cd backend && npx prisma migrate dev`

---

### 2. Fichiers Créés

#### `lib/excelParser.ts`
**Fonction :** `parseExcelWithHyperlinks(file: File): Promise<ExcelRow[]>`

**Ce qu'il fait :**
- Parse les fichiers Excel (.xlsx, .xls)
- Extrait les hyperliens depuis les cellules (pour Google Drive)
- Mappe automatiquement les colonnes (détection flexible français/arabe)
- Convertit les types de chambres : "خماسي" → "QUINT", "رباعي" → "QUAD", etc.
- Normalise le genre : "H"/"F" → "Homme"/"Femme"

**Colonnes supportées :**
- Nom et Prenom / الاسم الكامل
- H/F (genre)
- N° passport
- Hotel Makkah (arabe : أبراج الكسوة)
- Hotel medina (arabe : الانصار جولدن توليب)
- Chambre (arabe : خماسي, رباعي, etc.)
- Image passport (hyperlien)
- Image CIN (hyperlien)
- Téléphone, Vente, Avance 1/2/3, Remis, Groupe, Transport, Remarque

#### `lib/googleDriveDownloader.ts`
**Fonctions :**
- `downloadFileFromGoogleDrive(url: string): Promise<Buffer>`
- `getMimeTypeFromBuffer(buffer: Buffer): string | null`

**Ce qu'il fait :**
- Convertit URL Google Drive → URL de téléchargement direct
- Télécharge les fichiers depuis Google Drive
- Détecte le type MIME (JPEG, PNG, PDF)

#### `lib/reservationImporter.ts`
**Fonction principale :** `importReservationFromExcel(row: ExcelRow, programId: number, agentId: number | null): Promise<ImportResult>`

**Ce qu'il fait (reproduit le flux manuel) :**
1. Trouve ou crée les hôtels par nom (gère l'arabe)
2. Trouve les chambres disponibles
3. Crée la réservation via POST /api/reservations (avec roomMadinaId/roomMakkahId)
4. Le backend met à jour automatiquement les chambres (Room)
5. Upload les fichiers depuis Google Drive vers Cloudinary
6. Crée les paiements (Avance 1, 2, 3)
7. Crée les expenses (Vol, Visa, Hôtel Madina, Hôtel Makkah)
8. Met à jour les statuts via PATCH /api/reservations/:id

#### `app/reservations/page.tsx`
**Modifications :**
- Ajout d'un bouton "Importer Excel" dans l'en-tête
- Ajout d'un Dialog modal pour l'import
- Fonction `handleImportExcel()` pour traiter l'import

---

## ⚠️ CE QUI RESTE À FAIRE

### 1. INSTALLER LES DÉPENDANCES

```bash
npm install xlsx
```

### 2. APPLIQUER LA MIGRATION PRISMA

```bash
cd backend
npx prisma migrate dev
```

Cela ajoutera les colonnes `passportNumber`, `transport`, `remarque`, `groupe` à la table `Reservation`.

### 3. VÉRIFIER ET CORRIGER LE MAPPING DES COLONNES

**Fichier :** `lib/excelParser.ts`

**Problème potentiel :** La détection automatique des colonnes peut ne pas fonctionner si les noms de colonnes dans l'Excel sont différents.

**À faire :**
- Tester avec un fichier Excel réel
- Vérifier que toutes les colonnes sont bien détectées
- Ajuster le mapping si nécessaire (lignes ~200-250 dans `excelParser.ts`)

**Mapping actuel :**
- Cherche "nom" + "prenom" → colonne nomComplet
- Cherche "الاسم" → colonne nomComplet (arabe)
- Cherche "h/f" → colonne gender
- Cherche "hotel" + "makkah" → colonne hotelMakkah
- Cherche "hotel" + "medina"/"madina" → colonne hotelMadina
- Cherche "chambre" → colonne typeChambre
- Cherche "image" + "passport" → colonne imagePassport (pour hyperlien)
- etc.

### 4. AMÉLIORER LA GESTION DES HÔTELS ARABES

**Fichier :** `lib/reservationImporter.ts` - fonction `findOrCreateHotel()`

**Problème potentiel :** La correspondance des noms d'hôtels peut créer des doublons si les noms sont similaires mais pas exactement identiques.

**À faire :**
- Améliorer la logique de correspondance (normalisation, similarité)
- Gérer les variations d'espaces, de casse, de caractères spéciaux
- Peut-être utiliser une bibliothèque de similarité de chaînes

### 5. TESTER ET CORRIGER LES BUGS

**Tests à effectuer :**
1. Import avec fichier Excel réel
2. Vérifier que les hôtels arabes sont bien trouvés/créés
3. Vérifier que les chambres sont bien assignées
4. Vérifier que les fichiers Google Drive sont bien téléchargés
5. Vérifier que les paiements et expenses sont bien créés
6. Tester avec des erreurs (hôtel manquant, chambre non disponible, etc.)

---

## 🔍 COMPRÉHENSION DU FLUX DE CRÉATION MANUELLE

Quand un utilisateur crée une réservation manuellement, voici ce qui se passe :

### Étape 1 : Création de la réservation
**Endpoint :** `POST /api/reservations`
**Fichier :** `backend/src/routes/reservations.ts` (lignes 275-442)

**Ce qui se passe :**
- Crée l'entrée `Reservation` dans la base
- Si `roomMadinaId` et `roomMakkahId` sont fournis :
  - Met à jour les chambres (Room) :
    - Décrémente `nbrPlaceRestantes` de 1
    - Ajoute `reservation.id` à `listeIdsReservation`
    - Si chambre est "Mixte", change le `gender` vers celui du client

### Étape 2 : Upload des fichiers
**Endpoint :** `POST /api/upload-cloudinary`
**Fichier :** `backend/src/routes/upload-cloudinary.ts`

**Ce qui se passe :**
- Upload vers Cloudinary
- Crée automatiquement l'entrée `Fichier` dans la base avec :
  - `cloudinaryId`, `cloudinaryUrl`
  - `fileType`, `fileCategory`
  - Lié à `reservationId`

### Étape 3 : Création des paiements
**Endpoint :** `POST /api/payments`
**Fichier :** `backend/src/routes/payments.ts` (probablement)

**Ce qui se passe :**
- Crée une entrée `Payment` pour chaque avance
- Peut être lié à un `Fichier` (reçu de paiement)
- Lié à `reservationId`, `programId`, `agentId`

### Étape 4 : Création des expenses
**Endpoint :** `POST /api/expenses`
**Fichier :** `backend/src/routes/expenses.ts`

**Ce qui se passe :**
- Crée automatiquement des expenses selon les services :
  - Expense "Vol" si `statutVol = true` (montant = `program.prixAvionDH`)
  - Expense "Visa" si `statutVisa = true` (montant = `program.prixVisaRiyal * program.exchange`)
  - Expense "Hotel Madina" si hôtel sélectionné (calculé selon `room.prixRoom`, `nbJoursMadina`, `exchange`)
  - Expense "Hotel Makkah" si hôtel sélectionné (même logique)
- Chaque expense peut être lié à un `Fichier` (billet, visa, réservation hôtel)

### Étape 5 : Mise à jour des statuts
**Endpoint :** `PATCH /api/reservations/:id`

**Ce qui se passe :**
- Met à jour `statutPasseport`, `statutVisa`, `statutHotel`, `statutVol`
- Selon si les fichiers ont été uploadés

---

## 📊 STRUCTURE DE LA BASE DE DONNÉES

### Relations importantes :

```
Program
  ├── ProgramHotelMadina → Hotel (Madina)
  ├── ProgramHotelMakkah → Hotel (Makkah)
  ├── Room → Hotel, Program
  └── Reservation → Program

Reservation
  ├── Agent (optionnel)
  ├── Program
  ├── Fichier[] (documents)
  ├── Payment[] (paiements)
  └── Expense[] (dépenses)

Room
  ├── Program
  ├── Hotel
  ├── nbrPlaceRestantes (places disponibles)
  └── listeIdsReservation[] (IDs des réservations)

Hotel
  ├── name (peut être en arabe)
  └── city (Madina ou Makkah)
```

---

## 🛠️ COMMENT CONTINUER LE TRAVAIL

### Étape 1 : Installer les dépendances
```bash
npm install xlsx
```

### Étape 2 : Appliquer la migration
```bash
cd backend
npx prisma migrate dev
```

### Étape 3 : Tester le parser Excel
1. Créer un fichier Excel de test avec quelques lignes
2. Tester la fonction `parseExcelWithHyperlinks()`
3. Vérifier que toutes les colonnes sont bien détectées
4. Vérifier que les hyperliens sont bien extraits

### Étape 4 : Tester l'import complet
1. Ouvrir la page `/reservations`
2. Cliquer sur "Importer Excel"
3. Sélectionner un programme
4. Uploader un fichier Excel
5. Vérifier que les réservations sont créées
6. Vérifier dans la base de données que tout est correct

### Étape 5 : Corriger les bugs
- Si les colonnes ne sont pas détectées → ajuster le mapping dans `excelParser.ts`
- Si les hôtels ne sont pas trouvés → améliorer la logique de correspondance
- Si les chambres ne sont pas assignées → vérifier la logique de recherche
- Si les fichiers ne sont pas uploadés → vérifier les permissions Google Drive

---

## 📝 FICHIERS À CONSULTER

### Pour comprendre le flux de création manuelle :
- `app/reservations/nouvelle/page.tsx` (lignes 1155-1533) - Fonction `handleSubmit()`
- `backend/src/routes/reservations.ts` (lignes 275-442) - POST /api/reservations
- `backend/src/routes/upload-cloudinary.ts` - Upload vers Cloudinary
- `backend/src/routes/expenses.ts` - Création des expenses

### Fichiers créés pour l'import :
- `lib/excelParser.ts` - Parser Excel
- `lib/googleDriveDownloader.ts` - Téléchargement Google Drive
- `lib/reservationImporter.ts` - Fonction d'import complète
- `app/reservations/page.tsx` - Interface utilisateur (Dialog d'import)

---

## ⚠️ POINTS D'ATTENTION IMPORTANTS

1. **L'import doit reproduire EXACTEMENT le flux manuel** - Ne pas créer de raccourcis qui pourraient causer des incohérences

2. **Les chambres sont mises à jour automatiquement par le backend** - Il suffit de fournir `roomMadinaId` et `roomMakkahId` dans la requête POST /api/reservations

3. **Les hôtels peuvent être en arabe** - Il faut gérer la correspondance des noms (normalisation, similarité)

4. **Les fichiers Google Drive doivent être publics** - Sinon le téléchargement échouera

5. **Gérer les erreurs gracieusement** - Ne pas faire échouer tout l'import si une ligne a une erreur

---

## 🎯 RÉSUMÉ POUR COMMENCER

**État actuel :**
- ✅ Code créé et prêt
- ⚠️ Dépendance `xlsx` à installer
- ⚠️ Migration Prisma à appliquer
- ⚠️ Tests à effectuer

**Actions immédiates :**
1. Installer `xlsx` : `npm install xlsx`
2. Appliquer la migration : `cd backend && npx prisma migrate dev`
3. Tester avec un fichier Excel réel
4. Corriger les bugs trouvés
5. Améliorer le mapping/la correspondance si nécessaire

**Objectif final :**
Avoir une fonctionnalité d'import Excel qui permet d'importer des réservations en masse depuis un fichier Excel contenant des données en français/arabe, avec gestion automatique des hôtels, chambres, paiements, expenses et upload des fichiers depuis Google Drive.




