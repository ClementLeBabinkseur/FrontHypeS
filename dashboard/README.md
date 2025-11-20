# 🚀 Hyperliquid Dashboard

Dashboard moderne pour tracker vos wallets Hyperliquid et Ethereum avec des balances en temps réel.

![Dashboard Preview](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![Node](https://img.shields.io/badge/Node-20%2B-green)

---

## ✨ Fonctionnalités

### 💰 Gestion des Wallets
- ✅ Support **Hyperliquid** (natif) et **Ethereum** (via Alchemy)
- ✅ Ajout dynamique de wallets avec validation d'adresse
- ✅ Nicknames personnalisables
- ✅ Suppression en un clic

### 🏷️ Système de Tags
- ✅ Tags personnalisables (Trading, DeFi, Main, etc.)
- ✅ Filtrage multi-tags
- ✅ Organisation flexible

### 📊 Balances & Tokens
- ✅ Refresh manuel des balances (économise les quotas API)
- ✅ Sélection personnalisée des tokens à afficher
- ✅ Total USD optionnel par wallet
- ✅ Refresh individuel ou global

### 🎨 Interface
- ✅ Design **dark mode** moderne avec effet **glassmorphism**
- ✅ Animations fluides
- ✅ Responsive (mobile/tablet/desktop)
- ✅ Icons Lucide React

---

## 🏗️ Architecture

```
hyperliquid-dashboard/
├── backend/               # API Node.js + Express
│   ├── server.js         # Serveur principal
│   ├── package.json      # Dépendances
│   ├── .env              # Variables (Alchemy API key)
│   └── wallets.json      # Base de données JSON
│
├── frontend/             # React + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx       # Application principale
│   │   └── components/   # Composants React
│   ├── nginx.conf        # Config Nginx (Docker)
│   └── package.json      # Dépendances
│
├── docker-compose.yml    # Orchestration Docker
├── .env.example          # Template variables
└── README.md             # Ce fichier
```

---

## 🚀 Démarrage rapide

### Option 1 : Docker (Recommandé) 🐳

**Prérequis :** Docker & Docker Compose installés

```bash
# 1. Cloner le projet
git clone <repo-url>
cd hyperliquid-dashboard

# 2. Configurer les variables
cp .env.example .env
nano .env  # Ajouter votre ALCHEMY_API_KEY

# 3. Lancer avec Docker
docker-compose up -d --build

# 4. Accéder à l'app
# Frontend: http://localhost
# Backend API: http://localhost:3001
```

**Scripts automatiques :**
- **Windows** : Double-cliquez sur `start-docker.bat`
- **Linux** : `chmod +x start-docker.sh && ./start-docker.sh`

📖 **Documentation complète :** [DOCKER-README.md](DOCKER-README.md)

---

### Option 2 : Développement local

**Prérequis :** Node.js 20+ installé

#### Backend
```bash
cd backend
npm install
cp .env.example .env
nano .env  # Ajouter ALCHEMY_API_KEY
npm run dev
```

#### Frontend (nouveau terminal)
```bash
cd frontend
npm install
npm run dev
```

Accès : http://localhost:5173

---

## 🔧 Configuration

### Variables d'environnement

**Backend (`.env` dans `/backend`):**
```env
PORT=3001
ALCHEMY_API_KEY=votre_cle_alchemy
```

**Docker Compose (`.env` à la racine):**
```env
ALCHEMY_API_KEY=votre_cle_alchemy
```

### Obtenir une clé Alchemy

1. Créez un compte sur [Alchemy](https://www.alchemy.com/)
2. Créez une nouvelle app
3. Sélectionnez **Ethereum Mainnet** et/ou **Hyperliquid**
4. Copiez votre API Key

---

## 📡 API Endpoints

### Wallets
- `GET /api/wallets` - Liste tous les wallets
- `POST /api/wallets` - Ajouter un wallet
- `PUT /api/wallets/:id` - Modifier un wallet
- `DELETE /api/wallets/:id` - Supprimer un wallet

### Balances
- `GET /api/wallets/:address/balances?blockchain=hyperliquid` - Récupérer les balances

### Tags
- `POST /api/tags` - Ajouter des tags

### Health
- `GET /health` - Statut du serveur

---

## 🐳 Docker

### Commandes utiles

```bash
# Démarrer
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart

# Rebuild après changement
docker-compose up -d --build
```

### Ports
- **Frontend** : `80` (HTTP)
- **Backend** : `3001` (API)

### Volumes
Les données des wallets sont persistées dans `backend/wallets.json`

---

## 🛠️ Stack technique

### Backend
- **Node.js** 20+ avec Express
- **Axios** pour les appels API
- **Cors** pour les requêtes cross-origin
- **dotenv** pour les variables d'environnement

### Frontend
- **React** 18 avec Hooks
- **Vite** pour le build ultra-rapide
- **Tailwind CSS** pour le styling
- **Lucide React** pour les icônes
- **Axios** pour les requêtes API

### APIs externes
- **Hyperliquid API** : `https://api.hyperliquid.xyz/info`
- **Alchemy** : Pour Ethereum & tokens ERC-20

### DevOps
- **Docker** & **Docker Compose**
- **Nginx** pour servir le frontend en production

---

## 📊 Blockchains supportées

| Blockchain | Tokens supportés | API utilisée |
|------------|------------------|--------------|
| **Hyperliquid** | HYPE, USDC, BTC, ETH, + autres | API native publique |
| **Ethereum** | ETH + tous les ERC-20 | Alchemy |

---

## 🔒 Sécurité

- ✅ Clés API stockées dans `.env` (jamais commité)
- ✅ CORS configuré
- ✅ Validation des adresses wallet
- ✅ Health checks Docker
- ⚠️ En production : Utilisez HTTPS (Nginx + Certbot)

---

## 📝 Données persistées

Les wallets et leurs configurations sont stockés dans `backend/wallets.json` :

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
      "createdAt": "2024-11-20T10:00:00.000Z"
    }
  ],
  "availableTags": ["Main", "Trading", "DeFi"]
}
```

**Backup :**
```bash
cp backend/wallets.json backup-$(date +%Y%m%d).json
```

---

## 🐛 Troubleshooting

### Le backend ne démarre pas
```bash
# Vérifier les logs
docker-compose logs backend

# Vérifier que le port 3001 est libre
netstat -ano | findstr :3001  # Windows
sudo netstat -tulpn | grep :3001  # Linux
```

### Erreur "Failed to fetch Hyperliquid balances"
- Vérifiez que l'adresse est au format `0x...` (42 caractères)
- Testez l'API directement : `curl -X POST https://api.hyperliquid.xyz/info -d '{"type":"clearinghouseState","user":"0x..."}'`

### Le frontend ne communique pas avec le backend
- Vérifiez que le backend est bien sur le port 3001
- En dev : Le proxy Vite devrait router `/api` vers `localhost:3001`
- En prod (Docker) : Nginx route `/api` vers le container `backend:3001`

### Node.js version error
Le projet nécessite **Node.js 20+**. Téléchargez-le sur [nodejs.org](https://nodejs.org/)

---

## 🚀 Améliorations futures

- [ ] Auto-refresh configurable
- [ ] Graphiques d'évolution des prix
- [ ] Alertes de changements de solde
- [ ] Export CSV
- [ ] Support de plus de blockchains (Solana, Arbitrum, etc.)
- [ ] Mode multi-utilisateurs avec authentification
- [ ] Dark/Light theme toggle

---

## 📄 Licence

MIT License - Voir [LICENSE](LICENSE) pour plus de détails

---

## 🤝 Contribution

Les contributions sont bienvenues ! 

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

---

## 💬 Support

- 📧 Email : votre@email.com
- 🐛 Issues : [GitHub Issues](https://github.com/votre-repo/issues)
- 💬 Discord : [Lien Discord]

---

## ⭐ Remerciements

- [Hyperliquid](https://hyperliquid.xyz/) pour l'API publique
- [Alchemy](https://www.alchemy.com/) pour l'infrastructure Ethereum
- [Lucide](https://lucide.dev/) pour les icônes
- [Tailwind CSS](https://tailwindcss.com/) pour le framework CSS

---

**Fait avec ❤️ pour la communauté crypto**