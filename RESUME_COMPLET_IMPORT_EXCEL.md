# 📋 Résumé Complet - Fonctionnalité d'Import Excel

## 🎯 Objectif

Créer une fonctionnalité complète d'import de réservations depuis un fichier Excel, en reproduisant exactement le flux manuel de création de réservation.

---

## ✅ Ce qui a été fait

### 1. **Base de Données - Migration Prisma** ✅

**Fichier :** `backend/prisma/schema.prisma`

**Nouveaux champs ajoutés dans `Reservation` :**
- `passportNumber` (String?, VarChar(50)) - Numéro de passeport
- `transport` (String?, VarChar(100)) - Type de transport
- `remarque` (String?, Text) - Notes/remarques
- `groupe` (String?, VarChar(100)) - Groupe de réservation

**Migration :** `20251231143246_add_reservation_fields`
- ✅ **APPLIQUÉE** : Migration exécutée avec succès

---

### 2. **Dépendances** ✅

- ✅ `xlsx` installé : `npm install xlsx`

---

### 3. **Fichiers Créés/Modifiés**

#### 3.1. `lib/excelParser.ts` ✅

**Fonctionnalités :**
- Parse les fichiers Excel (.xlsx, .xls)
- Extraction des hyperliens depuis les cellules (pour Google Drive)
- Mapping automatique des colonnes (français/arabe)
- Mapping des types de chambres : "خماسي" → "QUINT", "رباعي" → "QUAD", etc.
- Normalisation du genre : "H"/"F"/"HOMME"/"FEMME" → "Homme"/"Femme"
- Détection flexible des colonnes

**Colonnes supportées :**
- Nom et Prenom / الاسم الكامل
- H/F (genre)
- N° passport / passportNumber
- Hotel Makkah (arabe : أبراج الكسوة)
- Hotel medina (arabe : الانصار جولدن توليب)
- Chambre / roomType (arabe : خماسي)
- Image passport (hyperlien Google Drive)
- Image CIN (hyperlien Google Drive)
- Téléphone
- Vente / Total des ventes / price
- Avance 1, 2, 3
- Remis / reduction
- Groupe / groupName
- Transport
- Remarque

#### 3.2. `lib/googleDriveDownloader.ts` ✅

**Fonctionnalités :**
- Conversion URL Google Drive → URL de téléchargement direct
- Téléchargement des fichiers depuis Google Drive
- Détection du type MIME (JPEG, PNG, PDF)
- Gestion des erreurs (fichier non public, etc.)

**Fonctions :**
- `downloadFileFromGoogleDrive(url: string): Promise<Buffer>`
- `getMimeTypeFromBuffer(buffer: Buffer): string | null`

#### 3.3. `lib/reservationImporter.ts` ✅

**Fonctionnalités :**
- Trouve ou crée les hôtels automatiquement (avec normalisation des noms arabes)
- Trouve les chambres disponibles
- Crée la réservation (reproduit le flux manuel)
- Met à jour les chambres (Room) automatiquement
- Upload les fichiers depuis Google Drive vers Cloudinary
- Crée les paiements (Avance 1, 2, 3 ou array dynamique)
- Crée les expenses automatiques (Vol, Visa, Hôtel Madina, Hôtel Makkah)
- Met à jour les statuts de la réservation

**Fonction principale :**
- `importReservationFromExcel(row: ExcelRow, programId: number, agentId: number | null): Promise<ImportResult>`

**Fonctions helper :**
- `findOrCreateHotel()` - Trouve ou crée un hôtel, le lie au programme
- `ensureHotelLinkedToProgram()` - S'assure qu'un hôtel est lié au programme
- `findAvailableRoom()` - Trouve une chambre disponible
- `uploadFileFromGoogleDriveToCloudinary()` - Upload depuis Google Drive vers Cloudinary

#### 3.4. `app/reservations/page.tsx` ✅

**Ajouts :**
- Bouton "Importer Excel" dans l'en-tête
- Dialog modal pour l'import
- Sélection du programme
- Upload du fichier Excel
- Barre de progression
- Affichage des résultats (succès/erreurs/avertissements)

**Fonction :**
- `handleImportExcel()` - Gère tout le processus d'import

---

### 4. **Backend - Nouveaux Endpoints** ✅

#### 4.1. `POST /api/programs/:programId/link-hotel` ✅

**Fichier :** `backend/src/routes/programs.ts`

**Fonction :** Lie un hôtel à un programme (pour l'import Excel)

**Body :**
```json
{
  "hotelId": 123,
  "city": "Madina" ou "Makkah"
}
```

---

### 5. **Améliorations et Corrections** ✅

#### 5.1. Normalisation des Noms d'Hôtels
- Fonction `normalizeHotelName()` qui supprime les espaces multiples
- Comparaison insensible à la casse
- Support des noms arabes

#### 5.2. Gestion des Paiements
- Support de l'array `payments` avec `amount` et `method`
- Mapping des méthodes : "ESPECE" → "Espèce", "VIREMENT" → "Virement", etc.
- Fallback sur `avance1`, `avance2`, `avance3` si array non fourni

#### 5.3. Gestion des Documents
- Support de l'array `documents` avec `fileType`, `fileName`, `filePath`
- Détection automatique des URLs Google Drive vs noms de fichiers locaux
- Upload automatique si URL Google Drive
- Avertissement si nom de fichier local

#### 5.4. Bugs Corrigés
- ✅ Logique de détection de la colonne "price" corrigée
- ✅ Extraction des hyperliens améliorée (fallback sur valeur de cellule)
- ✅ Logique de séparation du nom complet corrigée
- ✅ Import dupliqué de `useAuth` supprimé
- ✅ `programId` rendu optionnel dans `ExcelRow`

---

## 📊 Flux Complet d'Import

```
1. Utilisateur sélectionne programme + fichier Excel
   ↓
2. Parser Excel (lib/excelParser.ts)
   - Lit le fichier avec xlsx
   - Extrait les hyperliens (worksheet['!hyperlinks'])
   - Détecte les colonnes (français/arabe)
   - Mappe les données → ExcelRow[]
   ↓
3. Pour chaque ligne Excel :
   ↓
   a. Trouver/Créer les hôtels (findOrCreateHotel)
      - Recherche par nom normalisé
      - Création si n'existe pas
      - Liaison au programme
   ↓
   b. Trouver les chambres disponibles (findAvailableRoom)
      - Recherche dans les chambres du programme
      - Filtre par type, genre, disponibilité
   ↓
   c. Créer la réservation (POST /api/reservations)
      - Backend met à jour les chambres automatiquement
      - Obtient reservationId
   ↓
   d. Upload des fichiers (uploadFileFromGoogleDriveToCloudinary)
      - Télécharge depuis Google Drive
      - Upload vers Cloudinary
      - Backend crée entrée Fichier
   ↓
   e. Créer les paiements (POST /api/payments)
      - Depuis array payments OU avance1/avance2/avance3
   ↓
   f. Créer les expenses (POST /api/expenses)
      - Vol (si statutVol = true)
      - Visa (si statutVisa = true)
      - Hotel Madina (si hôtel fourni)
      - Hotel Makkah (si hôtel fourni)
   ↓
   g. Mettre à jour les statuts (PATCH /api/reservations/:id)
      - statutPasseport, statutVisa, statutHotel, statutVol
   ↓
4. Afficher les résultats (succès/erreurs/avertissements)
```

---

## 📋 Tables de Base de Données Modifiées

### INSERT (Créations)

1. **`Hotel`** (0-2) - Si hôtel n'existe pas
2. **`ProgramHotelMadina` / `ProgramHotelMakkah`** (0-2) - Liaison hôtel-programme
3. **`Reservation`** (1) - Toujours créée
4. **`Fichier`** (0-2) - Si fichiers uploadés
5. **`Payment`** (0-3+) - Selon nombre de paiements
6. **`Expense`** (0-4) - Selon services (Vol, Visa, Hôtels)

### UPDATE (Mises à jour)

7. **`Room`** (0-2) - Décrémente places, ajoute réservation
8. **`Reservation`** (1) - Met à jour les statuts

**Total par réservation :** 1 à 12 insertions + 0 à 3 updates

---

## 🔑 Points Clés

### 1. Extraction des Hyperliens Excel
- Utilise `cellHyperlinks: true` dans `XLSX.read()`
- Les hyperliens sont dans `worksheet['!hyperlinks']`
- Stockage par adresse de cellule (K5, L6, etc.)

### 2. Téléchargement Google Drive
- Convertit `https://drive.google.com/file/d/FILE_ID/view` 
- En `https://drive.google.com/uc?export=download&id=FILE_ID`
- ⚠️ Fichier doit être partagé publiquement

### 3. Upload Cloudinary
- Convertit Buffer → File → FormData
- POST `/api/upload-cloudinary`
- Backend gère upload Cloudinary + création entrée Fichier

### 4. Normalisation
- **Hôtels** : Supprime espaces multiples, insensible à la casse
- **Genre** : "HOMME"/"FEMME" → "Homme"/"Femme"
- **Chambres** : "خماسي" → "QUINT", etc.

---

## ⚠️ Points d'Attention

### 1. Permissions Google Drive
Les fichiers doivent être partagés en mode **"Toute personne avec le lien"** pour que le téléchargement fonctionne.

### 2. Format Excel
- Les hyperliens doivent être de **vrais hyperliens** (pas juste du texte)
- Les colonnes peuvent être en français ou en arabe
- Le parser détecte automatiquement les colonnes

### 3. Performance
Pour de gros fichiers (100+ lignes), l'import peut être lent car :
- Chaque ligne nécessite plusieurs appels API
- Téléchargement depuis Google Drive
- Upload vers Cloudinary

---

## 📁 Structure des Fichiers

```
lib/
  ├── excelParser.ts              ✅ Parser Excel avec mapping arabe
  ├── googleDriveDownloader.ts    ✅ Téléchargement Google Drive
  └── reservationImporter.ts     ✅ Fonction d'import complète

app/reservations/
  └── page.tsx                    ✅ Interface utilisateur (Dialog)

backend/
  ├── prisma/
  │   ├── schema.prisma           ✅ Modifié (nouveaux champs)
  │   └── migrations/
  │       └── 20251231143246_add_reservation_fields/  ✅ Appliquée
  └── src/routes/
      └── programs.ts             ✅ Nouvel endpoint link-hotel
```

---

## ✅ Checklist Finale

- [x] Dépendance `xlsx` installée
- [x] Migration Prisma appliquée
- [x] Parser Excel créé avec mapping arabe/français
- [x] Service Google Drive créé
- [x] Fonction d'import complète créée
- [x] Interface utilisateur ajoutée
- [x] Normalisation des hôtels améliorée
- [x] Liaison automatique hôtel-programme
- [x] Support des arrays de paiements et documents
- [x] Bugs corrigés
- [ ] **À FAIRE : Tester avec fichier Excel réel**

---

## 🚀 État Actuel

**Le système est prêt pour l'import !**

Tous les fichiers sont créés, les bugs sont corrigés, et le code est adapté pour gérer :
- ✅ Colonnes en français et en arabe
- ✅ Noms d'hôtels en arabe
- ✅ Types de chambres en arabe
- ✅ Hyperliens Google Drive
- ✅ Arrays de paiements et documents
- ✅ Normalisation et gestion des erreurs

**Prochaine étape :** Tester avec votre fichier Excel réel pour vérifier que tout fonctionne correctement.

---

## 📝 Notes Importantes

1. **Hyperliens Excel** : Assurez-vous que les cellules "Image passport" contiennent des **hyperliens** (clic droit → Lien hypertexte), pas juste du texte.

2. **Format des Colonnes** : Le parser détecte automatiquement les colonnes, mais si vos noms de colonnes sont très différents, vous devrez peut-être ajuster le mapping dans `lib/excelParser.ts`.

3. **Gestion des Erreurs** : Chaque réservation est traitée indépendamment. Une erreur n'arrête pas tout l'import.

4. **Résultats** : Les résultats (succès/erreurs/avertissements) sont affichés à la fin de l'import dans le Dialog.

---

**Le système est complet et prêt à être testé !** 🎉

