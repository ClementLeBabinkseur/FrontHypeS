# 🔐 Système d'Authentification JWT

## 🎯 Fonctionnalités

✅ **Page de login obligatoire** avant d'accéder au dashboard
✅ **JWT tokens** avec expiration 7 jours
✅ **Mots de passe hashés** avec bcrypt (sécurité)
✅ **Stockage utilisateurs** dans JSON
✅ **Protection de toutes les routes** API
✅ **Bouton logout** dans sidebar
✅ **Compte admin par défaut** (admin/admin)
✅ **Token auto-vérification** au chargement
✅ **Session persistante** (localStorage)

---

## 🏗️ Architecture

### Backend

**Nouvelles dépendances** :
- `bcrypt` - Hashage des mots de passe
- `jsonwebtoken` - Génération/vérification JWT

**Nouveaux fichiers** :
- `users.json` - Base de données utilisateurs

**Nouvelles routes** :
```
POST /api/auth/login       → Login (retourne token)
GET  /api/auth/verify      → Vérifier token valide
POST /api/auth/logout      → Logout (optionnel)
```

**Routes protégées** (toutes nécessitent token) :
```
GET/POST/PUT/DELETE /api/wallets/*
GET/POST /api/vault/*
GET/POST/DELETE /api/vault/transactions/*
GET /api/prices
GET /api/token-contracts
...
```

---

### Frontend

**Nouveau composant** :
- `LoginPage.jsx` - Page de connexion

**App.jsx modifié** :
- État d'authentification
- Vérification token au chargement
- Redirection si non authentifié
- Bouton logout dans sidebar
- Inclusion du token dans toutes les requêtes

---

## 📊 Structure users.json

```json
{
  "users": [
    {
      "id": "1",
      "username": "admin",
      "password": "$2b$10$...",  // Hash bcrypt
      "createdAt": "2025-12-12T21:00:00Z"
    }
  ]
}
```

---

## 🔑 Compte par défaut

**Username** : `admin`  
**Password** : `admin`

**⚠️ IMPORTANT** : Changez ce mot de passe en production !

---

## 🚀 Installation

### 1. Backend - Installer les dépendances

```bash
cd backend
npm install bcrypt jsonwebtoken
```

### 2. Backend - Déployer le nouveau server.js

```bash
cp outputs/server.js ./
```

### 3. Frontend - Copier les nouveaux fichiers

```bash
cd frontend/src
cp outputs/App.jsx ./
cp outputs/LoginPage.jsx ./components/
```

### 4. Variables d'environnement (optionnel)

Créer `.env` dans `/backend` :

```env
JWT_SECRET=votre-super-secret-key-tres-longue-et-aleatoire-change-moi-stp
DATA_DIR=/path/to/data
PORT=3001
```

**⚠️ Important** : Changez `JWT_SECRET` en production pour un secret fort !

### 5. Redémarrer l'application

```bash
# Docker
docker compose down
docker compose up --build -d

# Ou local
cd backend && npm run dev
cd frontend && npm run dev
```

---

## 🧪 Test

### 1. Ouvrir l'application

```
http://localhost:5173
# ou
http://clement94.duckdns.org:8080
```

**Résultat** : Page de login s'affiche

---

### 2. Se connecter

**Username** : `admin`  
**Password** : `admin`

**Résultat** : Dashboard s'affiche

---

### 3. Vérifier le token

Ouvrir DevTools (F12) → Application → Local Storage :

```
token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
user: {"id":"1","username":"admin"}
```

---

### 4. Tester la protection

Ouvrir un nouvel onglet privé → Ouvrir l'app

**Résultat** : Page de login (pas de token)

---

### 5. Logout

Cliquer sur "Logout" dans la sidebar

**Résultat** : Retour à la page de login

---

## 🔒 Sécurité

### Mot de passe hashé

```javascript
// Le mot de passe n'est jamais stocké en clair
const hashedPassword = await bcrypt.hash('admin', 10)
// Résultat: $2b$10$XyZ...abc (impossible à déchiffrer)
```

### Token JWT

```javascript
// Token signé avec secret
const token = jwt.sign(
  { userId: '1', username: 'admin' },
  JWT_SECRET,
  { expiresIn: '7d' }
)
// Token auto-expire après 7 jours
```

### Protection des routes

```javascript
// Middleware sur toutes les routes
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1]
  
  if (!token) return res.status(401).json({ error: 'Token requis' })
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' })
    next()
  })
}
```

---

## 👥 Gérer les utilisateurs

### Ajouter un utilisateur manuellement

**Méthode 1 : Via code temporaire**

Dans `server.js`, décommenter la route `/api/auth/register` :

```javascript
// Ligne ~415
app.post('/api/auth/register', async (req, res) => {
  // Code déjà présent, juste décommenter
})
```

Puis créer un utilisateur :

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"password123"}'
```

**⚠️ Recommenter ensuite** pour empêcher l'auto-registration !

---

**Méthode 2 : Manuellement dans users.json**

```bash
# 1. Générer le hash du mot de passe
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('password123', 10).then(h => console.log(h))"

# Résultat
$2b$10$xyz...abc

# 2. Éditer users.json
nano data/users.json
```

Ajouter :

```json
{
  "users": [
    {
      "id": "1",
      "username": "admin",
      "password": "$2b$10$...",
      "createdAt": "2025-12-12T21:00:00Z"
    },
    {
      "id": "2",
      "username": "john",
      "password": "$2b$10$xyz...abc",
      "createdAt": "2025-12-12T22:00:00Z"
    }
  ]
}
```

---

### Changer le mot de passe admin

```bash
# 1. Générer nouveau hash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('nouveau-mdp-fort', 10).then(h => console.log(h))"

# 2. Éditer users.json
nano data/users.json

# 3. Remplacer le hash de admin
```

---

## 🔧 Personnalisation

### Changer la durée d'expiration du token

Dans `server.js` :

```javascript
// Ligne ~423
const token = jwt.sign(
  { userId: user.id, username: user.username },
  JWT_SECRET,
  { expiresIn: '30d' } // ← Change ici (ex: 30 jours)
)
```

---

### Activer l'auto-registration

Décommenter la route dans `server.js` (ligne ~449) :

```javascript
app.post('/api/auth/register', async (req, res) => {
  // ...
})
```

**⚠️ Attention** : Permet à n'importe qui de créer un compte !

Pour limiter, ajouter :

```javascript
// Vérifier nombre d'utilisateurs
if (data.users.length >= 5) {
  return res.status(400).json({ error: 'Max users reached' })
}
```

---

### Personnaliser la page de login

Éditer `LoginPage.jsx` :

```jsx
// Logo / Titre
<h1 className="text-4xl font-bold text-white mb-2">
  Votre Titre
</h1>

// Message
<p className="text-gray-500">Votre sous-titre</p>

// Couleurs
className="bg-white text-black"  // Bouton
className="bg-blue-500/10"       // Hint box
```

---

## 📋 Workflow utilisateur

### Première connexion

```
1. Ouvrir http://localhost:5173
2. Voir page de login
3. Entrer: admin / admin
4. Cliquer "Sign in"
5. Token généré et stocké
6. Dashboard s'affiche
```

---

### Sessions suivantes

```
1. Ouvrir http://localhost:5173
2. Token vérifié automatiquement
3. Si valide: Dashboard direct
4. Si expiré/invalide: Page de login
```

---

### Logout

```
1. Cliquer "Logout" dans sidebar
2. Token supprimé du localStorage
3. Retour à page de login
```

---

## 🐛 Troubleshooting

### Erreur : "bcrypt not found"

```bash
cd backend
npm install bcrypt jsonwebtoken
```

---

### Erreur : "Invalid credentials"

- Vérifier username/password
- Check users.json existe
- Vérifier hash bcrypt correct

---

### Token expire immédiatement

Vérifier `JWT_SECRET` est identique :
- Au moment de la génération
- Au moment de la vérification

---

### "Authorization header required"

Le token n'est pas envoyé. Vérifier :

```javascript
// Dans App.jsx
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
```

---

### users.json n'est pas créé

Vérifier les permissions :

```bash
# Backend doit pouvoir écrire dans data/
chmod 755 data/
```

---

## 📊 Logs backend

**Au démarrage** :

```bash
🚀 Hyperliquid Dashboard Backend starting...
📁 Data file: /app/data/wallets.json
👥 Users file: /app/data/users.json
👤 Created default admin user (username: admin, password: admin)
⏰ Starting PNL auto-tracking cron job (every 2 minutes)...
🚀 Backend server running on http://localhost:3001
```

**À la connexion** :

```bash
POST /api/auth/login 200 - 123ms
```

**Requête protégée** :

```bash
GET /api/wallets 200 - 45ms
```

---

## ✅ Checklist de déploiement

- [ ] Installer bcrypt et jsonwebtoken
- [ ] Copier nouveau server.js
- [ ] Copier App.jsx et LoginPage.jsx
- [ ] Créer .env avec JWT_SECRET fort
- [ ] Tester login avec admin/admin
- [ ] Changer mot de passe admin
- [ ] Vérifier protection des routes
- [ ] Tester logout
- [ ] Tester token expiration (7 jours)
- [ ] Documenter comptes utilisateurs

---

## 🔐 Bonnes pratiques

### En production

1. **Changer JWT_SECRET** :
```env
JWT_SECRET=votre-cle-super-secrete-de-minimum-32-caracteres-aleatoires-xyz123
```

2. **Changer mot de passe admin** immédiatement

3. **Utiliser HTTPS** (pas HTTP)

4. **Limiter nombre d'utilisateurs** si auto-registration

5. **Logs d'audit** :
```javascript
console.log(`Login attempt: ${username} at ${new Date()}`)
```

6. **Rate limiting** :
```javascript
const rateLimit = require('express-rate-limit')
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 5 }))
```

---

## 🎉 Résumé

✅ **Système complet d'authentification JWT**
✅ **Page de login** avec validation
✅ **Toutes les routes protégées**
✅ **Mots de passe sécurisés** (bcrypt)
✅ **Sessions persistantes** (7 jours)
✅ **Bouton logout** intégré
✅ **Compte admin par défaut**
✅ **Prêt pour la production** (avec bonnes pratiques)

**Le dashboard est maintenant totalement sécurisé !** 🔒🎉