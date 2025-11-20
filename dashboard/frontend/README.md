# Frontend - Hyperliquid Dashboard

Interface React moderne pour tracker vos wallets Hyperliquid et Ethereum.

## 🚀 Installation

### 1. Installer les dépendances

```bash
cd frontend
npm install
```

### 2. Lancer le serveur de développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

**⚠️ Important :** Le backend doit être lancé sur `http://localhost:3001` pour que le frontend fonctionne.

---

## 📁 Structure du projet

```
frontend/
├── src/
│   ├── components/
│   │   ├── WalletWidget.jsx      # Widget d'affichage d'un wallet
│   │   ├── AddWalletModal.jsx    # Modal d'ajout de wallet
│   │   ├── TokenSelector.jsx     # Sélecteur de tokens à afficher
│   │   └── TagFilter.jsx         # Filtrage par tags
│   ├── App.jsx                   # Composant principal
│   ├── main.jsx                  # Point d'entrée React
│   └── index.css                 # Styles globaux + Tailwind
├── index.html                    # Template HTML
├── package.json                  # Dépendances
├── vite.config.js                # Configuration Vite
├── tailwind.config.js            # Configuration Tailwind
└── postcss.config.js             # Configuration PostCSS
```

---

## ✨ Fonctionnalités

### 🎯 Gestion des wallets
- ✅ Ajouter un wallet (Hyperliquid ou Ethereum)
- ✅ Supprimer un wallet
- ✅ Nickname personnalisable
- ✅ Tags multiples pour organiser

### 💰 Affichage des balances
- ✅ Balances en temps réel (refresh manuel)
- ✅ Sélection des tokens à afficher
- ✅ Total USD optionnel
- ✅ Refresh individuel ou global

### 🏷️ Système de tags
- ✅ Créer des tags personnalisés
- ✅ Filtrage par un ou plusieurs tags
- ✅ Tags réutilisables entre wallets

### 🎨 Interface
- ✅ Dark mode avec effet glassmorphism
- ✅ Design moderne et fluide
- ✅ Responsive (mobile/tablet/desktop)
- ✅ Animations et transitions

---

## 🎨 Design

### Palette de couleurs
- **Background** : Gradient slate-900 → purple-900/10 → slate-900
- **Cards** : Glass effect (slate-800/50 + backdrop-blur)
- **Accents** : Gradient blue-500 → purple-600
- **Borders** : slate-700/50

### Composants stylisés
- **Wallets** : Cards glassmorphism avec hover effect
- **Buttons** : Gradient avec shadow glow
- **Tags** : Rounded pills avec gradient background
- **Modal** : Backdrop blur + glass card

---

## 🔧 Configuration

### Proxy API
Le frontend est configuré pour proxifier les requêtes `/api` vers `http://localhost:3001` (voir `vite.config.js`).

Si ton backend tourne sur un autre port, modifie le proxy :

```javascript
// vite.config.js
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:AUTRE_PORT',
        changeOrigin: true
      }
    }
  }
})
```

---

## 📦 Build pour production

```bash
npm run build
```

Les fichiers de production seront générés dans `dist/`.

Pour tester le build :
```bash
npm run preview
```

---

## 🐛 Troubleshooting

### Le frontend ne communique pas avec le backend
1. Vérifie que le backend tourne sur `http://localhost:3001`
2. Vérifie que CORS est activé dans le backend (déjà fait par défaut)
3. Regarde la console du navigateur pour les erreurs

### Les balances ne s'affichent pas
1. Clique sur le bouton "Refresh" du wallet
2. Vérifie que l'adresse est valide
3. Vérifie les logs du backend pour voir les erreurs API

### Erreur "Cannot find module"
```bash
npm install
```

### Port 5173 déjà utilisé
Vite choisira automatiquement un autre port (5174, 5175, etc.)

---

## 🚀 Prochaines améliorations possibles

- [ ] Auto-refresh configurable
- [ ] Graphiques d'évolution des balances
- [ ] Export CSV des données
- [ ] Notifications de changements importants
- [ ] Support de plus de blockchains
- [ ] Mode multi-utilisateurs
- [ ] Thème clair/sombre switchable

---

## 📝 Notes

- Les données sont stockées dans le backend (`wallets.json`)
- Le refresh est manuel pour économiser les quotas API
- L'interface est responsive et fonctionne sur mobile
- Les tokens disponibles sont détectés automatiquement