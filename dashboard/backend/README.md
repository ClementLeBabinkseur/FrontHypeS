# Backend - Hyperliquid Dashboard API

Backend Node.js pour le dashboard de wallets Hyperliquid et Ethereum.

## 🚀 Installation

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer les variables d'environnement

Créer un fichier `.env` à la racine du dossier backend :

```env
PORT=3001
ALCHEMY_API_KEY=ta_cle_alchemy_ici
```

### 3. Lancer le serveur

**Mode développement (avec auto-reload) :**
```bash
npm run dev
```

**Mode production :**
```bash
npm start
```

Le serveur démarre sur `http://localhost:3001`

---

## 📡 API Endpoints

### Wallets

#### `GET /api/wallets`
Récupère tous les wallets enregistrés.

**Réponse :**
```json
{
  "wallets": [
    {
      "id": "1234567890",
      "address": "0x123...",
      "blockchain": "hyperliquid",
      "nickname": "Trading Wallet",
      "tags": ["Main", "Trading"],
      "selectedTokens": ["HYPE", "USDC", "totalUSD"],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "availableTags": ["Main", "Trading", "DeFi"]
}
```

#### `POST /api/wallets`
Ajoute un nouveau wallet.

**Body :**
```json
{
  "address": "0x123...",
  "blockchain": "hyperliquid",
  "nickname": "My Wallet",
  "tags": ["Trading"]
}
```

#### `PUT /api/wallets/:id`
Modifie un wallet existant.

**Body :**
```json
{
  "nickname": "Updated Name",
  "tags": ["DeFi", "Main"],
  "selectedTokens": ["HYPE", "USDC"]
}
```

#### `DELETE /api/wallets/:id`
Supprime un wallet.

---

### Balances

#### `GET /api/wallets/:address/balances?blockchain=hyperliquid`
Récupère les balances d'un wallet.

**Paramètres :**
- `address` : Adresse du wallet
- `blockchain` : `hyperliquid` ou `ethereum`

**Réponse :**
```json
{
  "address": "0x123...",
  "blockchain": "hyperliquid",
  "balances": [
    {
      "token": "HYPE",
      "balance": "1500.5",
      "usdValue": 7500.25
    },
    {
      "token": "USDC",
      "balance": "10000",
      "usdValue": 10000
    }
  ],
  "totalUSD": 17500.25,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### Tags

#### `POST /api/tags`
Ajoute des nouveaux tags à la liste globale.

**Body :**
```json
{
  "tags": ["DeFi", "Staking"]
}
```

---

### Health Check

#### `GET /health`
Vérifie l'état du serveur.

**Réponse :**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🔧 Structure des fichiers

```
backend/
├── server.js          # Serveur Express principal
├── package.json       # Dépendances Node.js
├── .env              # Variables d'environnement (à créer)
├── .gitignore        # Fichiers à ignorer dans Git
├── wallets.json      # Base de données JSON (créé automatiquement)
└── README.md         # Cette documentation
```

---

## 🌐 APIs utilisées

### Hyperliquid Native API
- **Endpoint** : `https://api.hyperliquid.xyz/info`
- **Authentification** : Aucune (API publique)
- **Tokens supportés** : HYPE, USDC, ETH, BTC, et autres tokens Hyperliquid

### Ethereum via Alchemy
- **Endpoint** : `https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
- **Authentification** : Clé API Alchemy
- **Tokens supportés** : ETH natif + tous les tokens ERC-20

---

## 📝 Notes importantes

1. **Hyperliquid** : Pas besoin de clé API, l'endpoint public est utilisé
2. **Ethereum** : Nécessite une clé API Alchemy (gratuite jusqu'à 300M compute units/mois)
3. **wallets.json** : Fichier créé automatiquement au premier démarrage
4. **CORS** : Activé pour permettre les requêtes depuis le frontend

---

## 🐛 Troubleshooting

### Erreur "Cannot find module"
```bash
npm install
```

### Port 3001 déjà utilisé
Modifier le `PORT` dans `.env` :
```env
PORT=3002
```

### Erreur Alchemy API
Vérifier que `ALCHEMY_API_KEY` est correctement configuré dans `.env`