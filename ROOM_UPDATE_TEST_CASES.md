# 📋 Synthèse des Cas de Figure - Mise à Jour des Rooms

## 🎯 Vue d'ensemble
Ce document décrit tous les cas de figure possibles lors de la mise à jour d'un programme avec modification des hôtels et chambres.

---

## 🔍 Détection des Rooms Occupées

Une room est considérée **OCCUPÉE** si :
- `listeIdsReservation.length > 0` (contient des IDs de réservations)
- **OU** `nbrPlaceRestantes < nbrPlaceTotal` (places réservées)

Une room est considérée **LIBRE** si :
- `listeIdsReservation.length === 0` (aucune réservation)
- **ET** `nbrPlaceRestantes === nbrPlaceTotal` (toutes les places disponibles)

---

## 📊 Cas de Figure Détaillés

### **Cas 1 : Pas de changement (`desiredCount === currentTotal`)**

**Situation initiale :**
- Total actuel : 5 rooms
- Rooms libres : 5
- Rooms occupées : 0
- Demandé : 5 rooms

**Actions exécutées :**
1. ✅ Lecture des rooms existantes
2. ✅ Détection : 5 libres, 0 occupées
3. ✅ Mise à jour du prix si `desiredPrice > 0` (toutes les rooms)
4. ⏭️ Pas de création
5. ⏭️ Pas de suppression
6. ✅ Log : "No change needed"

**Résultat final :** 5 rooms (inchangé)

---

### **Cas 2 : Augmentation sans rooms occupées (`desiredCount > currentTotal`, toutes libres)**

**Situation initiale :**
- Total actuel : 5 rooms
- Rooms libres : 5
- Rooms occupées : 0
- Demandé : 8 rooms

**Actions exécutées :**
1. ✅ Lecture des rooms existantes
2. ✅ Détection : 5 libres, 0 occupées
3. ✅ Mise à jour du prix si `desiredPrice > 0` (5 rooms existantes)
4. ✅ **Création de 3 nouvelles rooms** (8 - 5 = 3)
   - `nbrPlaceTotal = type`
   - `nbrPlaceRestantes = type`
   - `prixRoom = desiredPrice` (ou prix existant si `desiredPrice = 0`)
   - `listeIdsReservation = []`
5. ⏭️ Pas de suppression
6. ✅ Log : "Created 3 new rooms"

**Résultat final :** 8 rooms (5 existantes + 3 nouvelles)

---

### **Cas 3 : Augmentation avec rooms occupées (`desiredCount > currentTotal`, certaines occupées)**

**Situation initiale :**
- Total actuel : 6 rooms
- Rooms libres : 5
- Rooms occupées : 1 (avec réservation)
- Demandé : 8 rooms

**Actions exécutées :**
1. ✅ Lecture des rooms existantes
2. ✅ Détection : 5 libres, 1 occupée
3. ✅ Mise à jour du prix si `desiredPrice > 0` (6 rooms existantes)
4. ✅ **Création de 2 nouvelles rooms** (8 - 6 = 2)
   - Les rooms occupées sont **protégées** (non modifiées)
5. ⏭️ Pas de suppression
6. ✅ Log : "Created 2 new rooms"

**Résultat final :** 8 rooms (6 existantes dont 1 occupée + 2 nouvelles)

---

### **Cas 4 : Diminution sans rooms occupées (`desiredCount < currentTotal`, toutes libres)**

**Situation initiale :**
- Total actuel : 8 rooms
- Rooms libres : 8
- Rooms occupées : 0
- Demandé : 5 rooms

**Actions exécutées :**
1. ✅ Lecture des rooms existantes
2. ✅ Détection : 8 libres, 0 occupées
3. ✅ Mise à jour du prix si `desiredPrice > 0` (8 rooms existantes)
4. ⏭️ Pas de création
5. ✅ **Suppression de 3 rooms libres** (8 - 5 = 3)
   - Suppression des 3 premières rooms libres
6. ✅ Log : "Deleted 3 free rooms"

**Résultat final :** 5 rooms (8 - 3 = 5)

---

### **Cas 5 : Diminution avec rooms occupées (`desiredCount < currentTotal`, certaines occupées)**

**Situation initiale :**
- Total actuel : 7 rooms
- Rooms libres : 6
- Rooms occupées : 1 (avec réservation)
- Demandé : 5 rooms

**Actions exécutées :**
1. ✅ Lecture des rooms existantes
2. ✅ Détection : 6 libres, 1 occupée
3. ✅ Mise à jour du prix si `desiredPrice > 0` (7 rooms existantes)
4. ⏭️ Pas de création
5. ✅ **Suppression de 2 rooms libres** (7 - 5 = 2)
   - **Seulement les rooms libres** sont supprimées
   - La room occupée est **protégée** (non supprimée)
6. ✅ Log : "Deleted 2 free rooms"

**Résultat final :** 5 rooms (7 - 2 = 5, dont 1 occupée)

---

### **Cas 6 : Diminution avec toutes rooms occupées (`desiredCount < currentTotal`, toutes occupées)**

**Situation initiale :**
- Total actuel : 5 rooms
- Rooms libres : 0
- Rooms occupées : 5 (toutes avec réservations)
- Demandé : 3 rooms

**Actions exécutées :**
1. ✅ Lecture des rooms existantes
2. ✅ Détection : 0 libres, 5 occupées
3. ✅ Mise à jour du prix si `desiredPrice > 0` (5 rooms existantes)
4. ⏭️ Pas de création
5. ⚠️ **Aucune suppression possible** (toutes occupées)
   - Log : "WARNING: Cannot remove 2 rooms - all 5 rooms are occupied!"
6. ⚠️ Le nombre de rooms reste à 5 (impossible de supprimer)

**Résultat final :** 5 rooms (inchangé, toutes occupées)

---

### **Cas 7 : Suppression totale (`desiredCount = 0`)**

**Situation initiale :**
- Total actuel : 5 rooms
- Rooms libres : 5
- Rooms occupées : 0
- Demandé : 0 rooms

**Actions exécutées :**
1. ✅ Lecture des rooms existantes
2. ✅ Détection : 5 libres, 0 occupées
3. ✅ Mise à jour du prix si `desiredPrice > 0` (5 rooms existantes)
4. ⏭️ Pas de création
5. ✅ **Suppression de toutes les rooms libres** (5)
   - Si des rooms occupées existent, elles ne sont **pas** supprimées
6. ✅ Log : "Deleted 5 free rooms (desiredCount = 0)"

**Résultat final :** 0 rooms (si toutes libres) ou N rooms occupées (si certaines occupées)

---

### **Cas 8 : Mise à jour du prix uniquement (`desiredCount === currentTotal`, `desiredPrice > 0`)**

**Situation initiale :**
- Total actuel : 6 rooms
- Rooms libres : 5
- Rooms occupées : 1
- Demandé : 6 rooms, Prix : 700 DH

**Actions exécutées :**
1. ✅ Lecture des rooms existantes
2. ✅ Détection : 5 libres, 1 occupée
3. ✅ **Mise à jour du prix pour TOUTES les 6 rooms** (libres + occupées)
   - `prixRoom = 700` pour toutes
4. ⏭️ Pas de création
5. ⏭️ Pas de suppression
6. ✅ Log : "Updated price for all 6 rooms to 700"

**Résultat final :** 6 rooms (même nombre, prix mis à jour)

---

## 🔄 Ordre d'Exécution des Actions

Pour **TOUS** les cas, l'ordre est toujours :

1. **Lecture** des rooms existantes depuis la transaction
2. **Détection** des rooms libres vs occupées
3. **Mise à jour du prix** (si `desiredPrice > 0`) - **TOUJOURS EN PREMIER**
4. **Suppression** des rooms libres (si `desiredCount < currentTotal`)
5. **Création** des nouvelles rooms (si `desiredCount > currentTotal`)

---

## 🛡️ Règles de Protection

### ✅ **Protection des Rooms Occupées**
- Les rooms occupées **NE SONT JAMAIS** :
  - Supprimées
  - Modifiées dans leur structure (nbrPlaceTotal, nbrPlaceRestantes)
- Les rooms occupées **PEUVENT** :
  - Avoir leur prix mis à jour (`prixRoom`)
  - Être comptées dans le total

### ✅ **Protection des Réservations**
- `listeIdsReservation` n'est **JAMAIS** modifié lors de la mise à jour
- Les rooms avec réservations sont toujours protégées

---

## 📝 Logs de Débogage

Chaque action génère des logs détaillés :

```
[Room Update] [TX] DB Query - Found X existing rooms for HotelName ROOMTYPE
[Room Update] [TX] Breakdown - Free: X, Occupied: Y, Total: Z
[Room Update] [TX] Occupied rooms details: [{id, nbrPlaceRestantes, nbrPlaceTotal, listeIdsReservation}]
[Room Update] [TX] Hotel: HotelName, Type: ROOMTYPE, desiredCount: X, currentTotal: Y
[Room Update] [TX] Updated price for all X rooms (free + occupied) to Y
[Room Update] [TX] Created X new rooms
[Room Update] [TX] Deleted X free rooms (requested: Y)
[Room Update] [TX] WARNING: Cannot remove X rooms - all Y rooms are occupied!
```

---

## ✅ Validation

Pour chaque cas, vérifier :
- ✅ Le nombre total de rooms correspond à `desiredCount` (sauf si toutes occupées)
- ✅ Les rooms occupées ne sont jamais supprimées
- ✅ Les prix sont mis à jour si `desiredPrice > 0`
- ✅ Les nouvelles rooms ont `listeIdsReservation = []`
- ✅ Les nouvelles rooms ont `nbrPlaceRestantes = nbrPlaceTotal = type`

