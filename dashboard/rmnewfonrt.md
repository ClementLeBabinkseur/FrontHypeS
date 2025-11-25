# 🎨 Déploiement du Nouveau Dashboard

## 📋 Changements majeurs

### Backend
- ✅ Nouveau champ `walletType`: vault, liquidwallet, executor
- ✅ Logique de remplacement automatique pour vault/liquidwallet
- ✅ Suppression des tags et widgetType

### Frontend
- ✅ Design noir complet (comme les images)
- ✅ Sidebar avec navigation
- ✅ VaultSection avec graphique PNL
- ✅ LiquidWalletSection
- ✅ ExecutorSection (lignes compactes)
- ✅ Nouvelle modal avec 3 types de wallets
- ✅ Emojis pour les tokens: 🟡 HYPE, ⚪ ETH, 🟠 BTC, 🟢 USDT

---

## 🚀 Étapes de déploiement

### 1. Backend (server.js)

**Fichier:** `backend/server.js`

Remplace le contenu complet par l'artifact **"Backend - server.js"** (mis à jour)

### 2. Frontend - Fichiers à REMPLACER

**App.jsx:**
- `frontend/src/App.jsx`
- Copie le contenu de l'artifact **"New App.jsx - Dashboard complet"**

**index.css:**
- `frontend/src/index.css`
- Copie le contenu de l'artifact mis à jour (style noir)

### 3. Frontend - Fichiers à CRÉER

**Nouveaux composants dans `frontend/src/components/` :**

```
frontend/src/components/
├── VaultSection.jsx          (copie artifact)
├── LiquidWalletSection.jsx   (copie artifact)
├── ExecutorSection.jsx       (copie artifact)
└── AddWalletModal.jsx        (REMPLACER l'ancien)
```

### 4. Frontend - Fichiers à SUPPRIMER

Ces fichiers ne sont plus utilisés :
```
frontend/src/components/
├── WalletWidget.jsx          ❌ Supprimer
├── WalletWidgetLine.jsx      ❌ Supprimer
├── TagFilter.jsx             ❌ Supprimer
└── TokenSelector.jsx         ❌ Supprimer
```

### 5. Dépendances - Ajouter Recharts

Le graphique utilise Recharts. Ajoute-le au `package.json` :

**Méthode 1 - Manuel :**
```powershell
cd frontend
npm install recharts
```

**Méthode 2 - package.json :**
Ajoute dans `dependencies` :
```json
"recharts": "^2.10.3"
```

---

## 📂 Structure finale

```
dashboard/
├── backend/
│   ├── server.js          (mis à jour)
│   ├── package.json       (inchangé)
│   └── wallets.json       (structure change auto)
│
└── frontend/
    ├── src/
    │   ├── App.jsx        (REMPLACÉ)
    │   ├── index.css      (REMPLACÉ)
    │   ├── main.jsx       (inchangé)
    │   └── components/
    │       ├── VaultSection.jsx          (NOUVEAU)
    │       ├── LiquidWalletSection.jsx   (NOUVEAU)
    │       ├── ExecutorSection.jsx       (NOUVEAU)
    │       └── AddWalletModal.jsx        (REMPLACÉ)
    │
    └── package.json       (+ recharts)
```

---

## 🔧 Commandes de déploiement

### Sur Windows :

```powershell
cd C:\Users\moric\github\HypeSniper\dashboard

# 1. Installer Recharts
cd frontend
npm install recharts
cd ..

# 2. Rebuild Docker
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 3. Vérifier les logs
docker-compose logs -f
```

### Sur Raspberry Pi :

```bash
cd /var/www/dashboard/hyperliquid-dashboard/dashboard

# 1. Pull les changements
git pull origin front

# 2. Installer Recharts
cd frontend
npm install recharts
cd ..

# 3. Rebuild Docker
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 4. Logs
docker-compose logs -f
```

---

## ✅ Vérification post-déploiement

### 1. Test de l'interface

Ouvre http://localhost:8080

Tu devrais voir :
- ✅ Sidebar noire à gauche
- ✅ Titre "VAULT" avec bouton +
- ✅ Message "No Vault wallet configured"

### 2. Ajouter un Vault

1. Clique sur le **+**
2. Choisis **"Vault"**
3. Entre une adresse HyperEVM
4. Clique **"Add Wallet"**
5. Le graphique et vault balance apparaissent

### 3. Ajouter un LiquidWallet

1. Clique sur le **+**
2. Choisis **"LiquidWallet"**
3. Entre une adresse Hyperliquid
4. Section "liquid wallet balance" apparaît en dessous

### 4. Ajouter des Executors

1. Clique sur le **+**
2. Choisis **"Executor"**
3. Entre adresse + nickname
4. Les lignes executor apparaissent en bas

---

## 🎯 Fonctionnalités

### Vault (1 seul)
- Graphique avec tabs (1D, 1W, 1M, 6M, 1Y, All)
- Box PNL (% et $, base $5,000)
- 4 tokens: HYPE, ETH, BTC, USDT
- Blockchain: HyperEVM

### LiquidWallet (1 seul)
- 4 tokens: HYPE, ETH, BTC, USDT
- Blockchain: Hyperliquid
- Pas de graphique

### Executor (illimité)
- Token: HYPE uniquement
- Affichage ligne compacte
- Blockchain: HyperEVM

---

## 🐛 Troubleshooting

### Erreur "recharts not found"
```bash
cd frontend
npm install recharts
docker-compose build --no-cache frontend
docker-compose up -d
```

### Graphique ne s'affiche pas
- Vérifie que Recharts est installé
- Vérifie les logs: `docker-compose logs frontend`

### "Cannot read property 'balances' of undefined"
- Normal au premier chargement
- Clique sur "Load balances" ou l'icône refresh

### Les anciens wallets ne s'affichent pas
- Ils ont l'ancien format (tags, widgetType)
- Supprime `backend/wallets.json` et recrée les wallets
- Ou migre manuellement en ajoutant `walletType`

---

## 📊 Format wallets.json

Nouveau format :
```json
{
  "wallets": [
    {
      "id": "1234567890",
      "address": "0x...",
      "blockchain": "hyperevm",
      "nickname": "Main Vault",
      "walletType": "vault",
      "createdAt": "2025-11-24T..."
    }
  ]
}
```

---

## 🎉 C'est tout !

Ton dashboard devrait maintenant ressembler exactement aux images ! 

Questions ? Vérifie les logs ou demande de l'aide ! 🚀