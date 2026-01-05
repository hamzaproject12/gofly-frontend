# Checklist - Fonctionnalité d'Import Excel pour Réservations

## ✅ État d'avancement actuel

### 1. ✅ Modifications du Schéma de Base de Données

**Fichier modifié :** `backend/prisma/schema.prisma`

**Nouveaux champs ajoutés dans `Reservation` :**
- ✅ `passportNumber` (String?, VarChar(50)) - Numéro de passeport
- ✅ `transport` (String?, VarChar(100)) - Type de transport
- ✅ `remarque` (String?, Text) - Notes/remarques
- ✅ `groupe` (String?, VarChar(100)) - Groupe de réservation

**Migration créée :** `backend/prisma/migrations/20251231143246_add_reservation_fields/`
- ⚠️ **À APPLIQUER** : Exécuter `npx prisma migrate dev` dans le dossier `backend`

---

### 2. ✅ Fichiers créés pour l'import

#### 2.1. Parser Excel avec mapping arabe/français
**Fichier :** `lib/excelParser.ts`

**Fonctionnalités :**
- ✅ Parse les fichiers Excel (.xlsx, .xls)
- ✅ Extraction des hyperliens depuis les cellules (pour Google Drive)
- ✅ Mapping automatique des colonnes (français/arabe)
- ✅ Mapping des types de chambres : "خماسي" → "QUINT", "رباعي" → "QUAD", etc.
- ✅ Normalisation du genre : "H"/"F" → "Homme"/"Femme"
- ✅ Détection flexible des colonnes (nom, prénom, téléphone, hôtels, etc.)

**Colonnes supportées :**
- Nom et Prenom / الاسم الكامل
- H/F (genre)
- N° passport
- Hotel Makkah (arabe supporté : أبراج الكسوة)
- Hotel medina (arabe supporté : الانصار جولدن توليب)
- Chambre (arabe supporté : خماسي)
- Image passport (hyperlien Google Drive)
- Image CIN (hyperlien Google Drive)
- Téléphone
- Vente / Total des ventes
- Avance 1, 2, 3
- Remis
- Groupe
- Transport
- Remarque

#### 2.2. Service de téléchargement Google Drive
**Fichier :** `lib/googleDriveDownloader.ts`

**Fonctionnalités :**
- ✅ Conversion URL Google Drive → URL de téléchargement direct
- ✅ Téléchargement des fichiers depuis Google Drive
- ✅ Détection du type MIME (JPEG, PNG, PDF)
- ✅ Gestion des erreurs (fichier non public, etc.)

#### 2.3. Fonction d'import complète
**Fichier :** `lib/reservationImporter.ts`

**Fonctionnalités :**
- ✅ Trouve ou crée les hôtels automatiquement
- ✅ Trouve les chambres disponibles
- ✅ Crée la réservation (reproduit le flux manuel)
- ✅ Met à jour les chambres (Room) automatiquement
- ✅ Upload les fichiers depuis Google Drive vers Cloudinary
- ✅ Crée les paiements (Avance 1, 2, 3)
- ✅ Crée les expenses automatiques (Vol, Visa, Hôtel Madina, Hôtel Makkah)
- ✅ Met à jour les statuts de la réservation

**Flux reproduit exactement comme l'insertion manuelle :**
1. POST /api/reservations (avec roomMadinaId/roomMakkahId)
2. Upload fichiers vers Cloudinary
3. POST /api/payments (pour chaque avance)
4. POST /api/expenses (pour chaque service)
5. PATCH /api/reservations/:id (mise à jour statuts)

#### 2.4. Interface utilisateur
**Fichier modifié :** `app/reservations/page.tsx`

**Ajouts :**
- ✅ Bouton "Importer Excel" dans l'en-tête
- ✅ Dialog modal pour l'import
- ✅ Sélection du programme
- ✅ Upload du fichier Excel
- ✅ Barre de progression
- ✅ Affichage des résultats (succès/erreurs/avertissements)

---

### 3. ⚠️ À FAIRE / À VÉRIFIER

#### 3.1. Dépendances
- ⚠️ **Installer xlsx** : `npm install xlsx`
- ⚠️ **Installer @types/xlsx** (optionnel) : `npm install --save-dev @types/xlsx`

#### 3.2. Migration Prisma
- ⚠️ **Appliquer la migration** :
  ```bash
  cd backend
  npx prisma migrate dev
  ```
  Cela ajoutera les colonnes `passportNumber`, `transport`, `remarque`, `groupe` à la table `Reservation`

#### 3.3. Vérifications à faire

**Mapping des colonnes Excel :**
- [ ] Vérifier que le parser détecte correctement toutes les colonnes
- [ ] Tester avec un fichier Excel réel contenant des noms arabes
- [ ] Vérifier que les hyperliens sont bien extraits

**Gestion des hôtels :**
- [ ] Vérifier que les hôtels en arabe sont bien trouvés/créés
- [ ] Tester la correspondance des noms (normalisation des espaces, casse)
- [ ] Vérifier que les hôtels créés sont bien liés au programme

**Gestion des chambres :**
- [ ] Vérifier que les chambres disponibles sont bien trouvées
- [ ] Tester avec différents types de chambres (خماسي, رباعي, etc.)
- [ ] Vérifier que la mise à jour des chambres fonctionne correctement

**Upload Google Drive :**
- [ ] Tester le téléchargement depuis Google Drive
- [ ] Vérifier que les fichiers sont bien uploadés vers Cloudinary
- [ ] Vérifier que les entrées Fichier sont bien créées

**Gestion des erreurs :**
- [ ] Tester avec un fichier Excel invalide
- [ ] Tester avec des hôtels manquants
- [ ] Tester avec des chambres non disponibles
- [ ] Vérifier que les erreurs sont bien collectées et affichées

---

### 4. 📋 Structure des fichiers créés/modifiés

```
lib/
  ├── excelParser.ts              ✅ NOUVEAU - Parser Excel avec mapping arabe
  ├── googleDriveDownloader.ts    ✅ NOUVEAU - Téléchargement Google Drive
  └── reservationImporter.ts      ✅ NOUVEAU - Fonction d'import complète

app/reservations/
  └── page.tsx                    ✅ MODIFIÉ - Ajout du Dialog d'import

backend/prisma/
  ├── schema.prisma               ✅ MODIFIÉ - Nouveaux champs Reservation
  └── migrations/
      └── 20251231143246_add_reservation_fields/  ✅ CRÉÉ - Migration
```

---

### 5. 🔧 Configuration requise

#### Variables d'environnement
- ✅ `CLOUDINARY_CLOUD_NAME` - Déjà configuré
- ✅ `CLOUDINARY_API_KEY` - Déjà configuré
- ✅ `CLOUDINARY_API_SECRET` - Déjà configuré
- ✅ `DATABASE_URL` - Déjà configuré

#### Permissions Google Drive
- ⚠️ **IMPORTANT** : Les fichiers Google Drive doivent être partagés en mode **"Toute personne avec le lien"** pour que le téléchargement fonctionne
- Alternative : Utiliser l'API Google Drive avec OAuth (plus complexe)

---

### 6. 📝 Points d'attention

#### Mapping des colonnes
Le parser détecte automatiquement les colonnes en cherchant des mots-clés dans les headers. Si les noms de colonnes dans votre Excel sont différents, vous devrez peut-être ajuster le mapping dans `lib/excelParser.ts` (lignes ~200-250).

#### Gestion des hôtels en arabe
Les noms d'hôtels en arabe sont comparés avec une normalisation (trim, lowercase). Si un hôtel existe déjà avec un nom similaire mais pas exactement identique, il sera créé en double. Vous devrez peut-être améliorer la logique de correspondance.

#### Gestion des chambres
Si aucune chambre n'est disponible pour un hôtel donné, la réservation sera créée mais sans assignation de chambre. Un avertissement sera affiché.

#### Performance
Pour de gros fichiers Excel (100+ lignes), l'import peut prendre du temps car :
- Chaque ligne nécessite plusieurs appels API
- Le téléchargement depuis Google Drive peut être lent
- L'upload vers Cloudinary prend du temps

**Recommandation** : Traiter les imports en batch ou avec un système de queue.

---

### 7. 🧪 Tests à effectuer

#### Test 1 : Import basique
- [ ] Créer un fichier Excel avec 2-3 réservations
- [ ] Vérifier que toutes les colonnes sont bien mappées
- [ ] Vérifier que les réservations sont créées
- [ ] Vérifier que les chambres sont mises à jour
- [ ] Vérifier que les paiements sont créés
- [ ] Vérifier que les expenses sont créées

#### Test 2 : Import avec hôtels arabes
- [ ] Créer un fichier Excel avec des noms d'hôtels en arabe
- [ ] Vérifier que les hôtels sont trouvés/créés
- [ ] Vérifier que les chambres sont assignées

#### Test 3 : Import avec hyperliens Google Drive
- [ ] Créer un fichier Excel avec des hyperliens vers Google Drive
- [ ] Vérifier que les fichiers sont téléchargés
- [ ] Vérifier que les fichiers sont uploadés vers Cloudinary
- [ ] Vérifier que les entrées Fichier sont créées

#### Test 4 : Gestion des erreurs
- [ ] Tester avec un programme invalide
- [ ] Tester avec des hôtels manquants
- [ ] Tester avec des chambres non disponibles
- [ ] Vérifier que les erreurs sont bien affichées

---

### 8. 🚀 Prochaines étapes recommandées

1. **Installer les dépendances** :
   ```bash
   npm install xlsx
   ```

2. **Appliquer la migration** :
   ```bash
   cd backend
   npx prisma migrate dev
   ```

3. **Tester avec un fichier Excel réel** :
   - Créer un fichier Excel de test avec quelques réservations
   - Tester l'import
   - Vérifier que tout fonctionne

4. **Améliorer le mapping** (si nécessaire) :
   - Ajuster la détection des colonnes selon votre format Excel exact
   - Améliorer la correspondance des noms d'hôtels (normalisation, similarité)

5. **Optimiser les performances** (si nécessaire) :
   - Implémenter un système de queue pour les gros imports
   - Traiter les uploads en parallèle

---

### 9. 📚 Documentation des fonctions principales

#### `parseExcelWithHyperlinks(file: File): Promise<ExcelRow[]>`
Parse un fichier Excel et retourne un tableau de lignes avec les hyperliens extraits.

#### `downloadFileFromGoogleDrive(url: string): Promise<Buffer>`
Télécharge un fichier depuis Google Drive et retourne un Buffer.

#### `importReservationFromExcel(row: ExcelRow, programId: number, agentId: number | null): Promise<ImportResult>`
Importe une réservation depuis une ligne Excel en reproduisant exactement le flux manuel.

---

### 10. ⚠️ Problèmes connus / Limitations

1. **Google Drive** : Les fichiers doivent être partagés publiquement
2. **Performance** : Les gros imports peuvent être lents
3. **Mapping** : La détection automatique des colonnes peut nécessiter des ajustements selon votre format Excel exact
4. **Hôtels** : La correspondance des noms peut créer des doublons si les noms sont similaires mais pas identiques

---

## 🎯 Résumé pour nouvelle conversation

**État actuel :**
- ✅ Schéma Prisma modifié (migration créée mais pas appliquée)
- ✅ Parser Excel créé avec mapping arabe/français
- ✅ Service Google Drive créé
- ✅ Fonction d'import complète créée
- ✅ Interface utilisateur ajoutée dans la page des réservations
- ⚠️ Dépendance `xlsx` à installer
- ⚠️ Migration à appliquer

**Pour continuer :**
1. Installer `xlsx` : `npm install xlsx`
2. Appliquer la migration : `cd backend && npx prisma migrate dev`
3. Tester avec un fichier Excel réel
4. Ajuster le mapping des colonnes si nécessaire
5. Améliorer la gestion des hôtels arabes si nécessaire

