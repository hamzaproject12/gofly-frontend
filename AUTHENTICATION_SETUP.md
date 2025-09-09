# Configuration du Système d'Authentification

## Vue d'ensemble

Ce système d'authentification sécurisé a été implémenté selon les meilleures pratiques de sécurité :

✅ **Mots de passe hashés** avec bcrypt (12 rounds de salt)  
✅ **JWT tokens** signés avec une clé secrète  
✅ **Cookies sécurisés** (httpOnly, secure en production)  
✅ **Protection des routes** avec middleware  
✅ **Validation des comptes** (isActive)  
✅ **HTTPS** (automatique sur Vercel/Railway)  

## Configuration Backend

### 1. Variables d'environnement

Créez un fichier `.env` dans le dossier `backend/` avec :

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/omra_travel_db"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"

# Cookie Configuration
COOKIE_SECRET="your-super-secret-cookie-key-change-this-in-production"

# Environment
NODE_ENV="development"
```

### 2. Dépendances installées

```bash
cd backend
npm install bcrypt @types/bcrypt cookie-parser @types/cookie-parser
```

### 3. Base de données

Le système utilise le modèle `Agent` existant dans Prisma. Aucune migration n'est nécessaire.

## Configuration Frontend

### 1. Variables d'environnement

Créez un fichier `.env.local` dans la racine du projet :

```env
# Backend URL
BACKEND_URL=http://localhost:5000
```

## Fonctionnalités

### Pages d'authentification

- **`/login`** - Page de connexion
- **`/register`** - Page d'inscription
- **`/`** - Page d'accueil (protégée)

### API Endpoints

#### Backend (Port 5000)
- `POST /api/auth/register` - Inscription d'un nouvel agent
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/profile` - Profil de l'agent connecté
- `PUT /api/auth/profile` - Mise à jour du profil
- `PUT /api/auth/change-password` - Changement de mot de passe

#### Frontend (Port 3000)
- `POST /api/auth/login` - Proxy vers le backend
- `POST /api/auth/register` - Proxy vers le backend
- `POST /api/auth/logout` - Proxy vers le backend
- `GET /api/auth/profile` - Proxy vers le backend

## Sécurité

### 1. Mots de passe
- Hashés avec bcrypt (12 rounds)
- Minimum 6 caractères requis
- Validation côté client et serveur

### 2. Tokens JWT
- Signés avec une clé secrète
- Expiration configurable (7 jours par défaut)
- Stockés dans des cookies httpOnly

### 3. Cookies
- `httpOnly` : Non accessibles via JavaScript
- `secure` : HTTPS uniquement en production
- `sameSite: strict` : Protection CSRF

### 4. Protection des routes
- Middleware Next.js pour redirection automatique
- Vérification du statut `isActive`
- Composant `ProtectedRoute` pour les pages sensibles

## Utilisation

### 1. Démarrer le backend
```bash
cd backend
npm run dev
```

### 2. Démarrer le frontend
```bash
npm run dev
```

### 3. Accéder à l'application
- Ouvrir http://localhost:3000
- Redirection automatique vers `/login` si non connecté
- Créer un compte ou se connecter

## Structure des fichiers

```
backend/
├── src/
│   ├── controllers/
│   │   └── authController.ts    # Logique d'authentification
│   ├── routes/
│   │   └── auth.ts             # Routes d'authentification
│   ├── middleware/
│   │   └── auth.ts             # Middleware de vérification JWT
│   └── server.ts               # Configuration du serveur
└── prisma/
    └── schema.prisma           # Modèle Agent existant

app/
├── (protected)/                # Pages protégées
│   ├── layout.tsx             # Layout avec protection
│   └── page.tsx               # Page d'accueil
├── components/
│   ├── AuthNav.tsx            # Navigation avec auth
│   └── ProtectedRoute.tsx     # Composant de protection
├── api/auth/                  # Routes API Next.js
│   ├── login/route.ts
│   ├── register/route.ts
│   ├── logout/route.ts
│   └── profile/route.ts
├── login/page.tsx             # Page de connexion
├── register/page.tsx          # Page d'inscription
└── middleware.ts              # Middleware Next.js
```

## Tests

### 1. Test d'inscription
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nom":"Test Agent","email":"test@example.com","motDePasse":"password123"}'
```

### 2. Test de connexion
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","motDePasse":"password123"}'
```

### 3. Test du profil (avec cookie)
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Cookie: authToken=YOUR_JWT_TOKEN"
```

## Déploiement

### Variables d'environnement de production

Assurez-vous de définir ces variables dans votre plateforme de déploiement :

**Backend (Railway/Vercel) :**
- `DATABASE_URL`
- `JWT_SECRET` (générez une clé forte)
- `JWT_EXPIRES_IN`
- `COOKIE_SECRET` (générez une clé forte)
- `NODE_ENV=production`

**Frontend (Vercel) :**
- `BACKEND_URL` (URL de votre backend déployé)

## Notes importantes

1. **Génération de clés sécurisées** : Utilisez des générateurs de clés cryptographiques pour `JWT_SECRET` et `COOKIE_SECRET`

2. **Base de données** : Le système utilise le modèle `Agent` existant, aucun changement de schéma requis

3. **CORS** : Configuré pour accepter les cookies et les requêtes cross-origin

4. **Gestion des erreurs** : Messages d'erreur en français pour une meilleure UX

5. **Responsive** : Interface adaptée aux mobiles et tablettes
