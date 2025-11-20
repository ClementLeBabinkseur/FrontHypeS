# 🐳 Docker Deployment Guide

Guide complet pour déployer Hyperliquid Dashboard avec Docker sur Windows et Linux.

---

## 📋 Prérequis

### Sur Windows
1. **Docker Desktop** : https://www.docker.com/products/docker-desktop/
2. **WSL 2** activé (Docker Desktop l'active automatiquement)

### Sur Linux
```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Ajouter votre user au groupe docker
sudo usermod -aG docker $USER
# Déconnectez-vous et reconnectez-vous
```

---

## 🚀 Déploiement rapide

### 1. Cloner/Copier le projet

```bash
# Sur Linux
cd /opt  # ou n'importe quel dossier
git clone <votre-repo>
cd hyperliquid-dashboard

# Sur Windows
cd C:\Projects
git clone <votre-repo>
cd hyperliquid-dashboard
```

### 2. Configuration

Créer le fichier `.env` à la racine du projet :

```bash
# Linux
cp .env.example .env
nano .env

# Windows PowerShell
Copy-Item .env.example .env
notepad .env
```

Remplir avec votre clé Alchemy :
```env
ALCHEMY_API_KEY=votre_cle_ici
```

### 3. Lancer l'application

```bash
# Build et démarrage
docker-compose up -d --build

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart
```

### 4. Accéder à l'application

Ouvrez votre navigateur : **http://localhost** ou **http://votre-ip-serveur**

---

## 📁 Structure du projet

```
hyperliquid-dashboard/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── server.js
│   ├── package.json
│   ├── .env               # Créé par vous (clé API)
│   └── wallets.json       # Créé automatiquement
│
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx.conf
│   ├── src/
│   └── package.json
│
├── docker-compose.yml
├── .env                   # Variables pour Docker Compose
└── DOCKER-README.md       # Ce fichier
```

---

## 🔧 Commandes Docker utiles

### Gestion des containers

```bash
# Voir les containers en cours
docker-compose ps

# Logs en temps réel
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f backend
docker-compose logs -f frontend

# Redémarrer un service
docker-compose restart backend

# Arrêter tous les services
docker-compose stop

# Supprimer les containers
docker-compose down

# Supprimer containers + volumes
docker-compose down -v
```

### Build et mise à jour

```bash
# Rebuild après changement de code
docker-compose up -d --build

# Rebuild un service spécifique
docker-compose build backend
docker-compose up -d backend

# Pull les dernières images
docker-compose pull
```

### Debugging

```bash
# Accéder au shell d'un container
docker-compose exec backend sh
docker-compose exec frontend sh

# Voir les ressources utilisées
docker stats

# Inspecter un container
docker inspect hyperliquid-backend
```

---

## 🌐 Configuration réseau

### Ports utilisés
- **Frontend** : `80` (HTTP)
- **Backend** : `3001` (API)

### Changer les ports

Modifiez `docker-compose.yml` :

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # Accès sur port 8080 au lieu de 80
  
  backend:
    ports:
      - "3002:3001"  # Accès sur port 3002 au lieu de 3001
```

**⚠️ Note :** Si vous changez le port backend, mettez à jour `nginx.conf` dans le frontend :
```nginx
location /api {
    proxy_pass http://backend:3001;  # Gardez 3001 ici (port interne)
}
```

---

## 💾 Persistence des données

Les données des wallets sont persistées dans `backend/wallets.json` grâce au volume Docker :

```yaml
volumes:
  - ./backend/wallets.json:/app/wallets.json
```

**Backup :**
```bash
# Copier wallets.json
cp backend/wallets.json backend/wallets.json.backup

# Restaurer
cp backend/wallets.json.backup backend/wallets.json
docker-compose restart backend
```

---

## 🔒 Sécurité en production

### 1. HTTPS avec Nginx (recommandé)

Utilisez un reverse proxy comme Nginx + Certbot pour HTTPS :

```nginx
# /etc/nginx/sites-available/hyperliquid
server {
    listen 80;
    server_name votre-domaine.com;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Puis ajoutez HTTPS avec Certbot :
```bash
sudo certbot --nginx -d votre-domaine.com
```

### 2. Firewall

```bash
# Linux - UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Variables d'environnement

Ne committez JAMAIS le fichier `.env` dans Git !

---

## 📊 Monitoring

### Health checks

Les services ont des health checks intégrés :

```bash
# Vérifier l'état
docker-compose ps

# Backend health
curl http://localhost:3001/health

# Frontend health
curl http://localhost/
```

### Logs

```bash
# Voir les derniers logs
docker-compose logs --tail=100

# Suivre les logs en temps réel
docker-compose logs -f

# Logs avec timestamps
docker-compose logs -f -t
```

---

## 🐛 Troubleshooting

### Les containers ne démarrent pas

```bash
# Voir les logs d'erreur
docker-compose logs

# Vérifier que les ports ne sont pas déjà utilisés
# Windows
netstat -ano | findstr :80
netstat -ano | findstr :3001

# Linux
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :3001
```

### Le frontend ne communique pas avec le backend

1. Vérifier que les deux containers sont sur le même réseau :
```bash
docker network inspect hyperliquid-dashboard_hyperliquid-network
```

2. Tester depuis le container frontend :
```bash
docker-compose exec frontend wget -O- http://backend:3001/health
```

### Erreur "Cannot find module"

Rebuild les images :
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Espace disque

```bash
# Nettoyer les images inutilisées
docker system prune -a

# Voir l'espace utilisé
docker system df
```

---

## 🚀 Déploiement sur serveur distant

### Via SSH

```bash
# Sur votre machine locale
scp -r hyperliquid-dashboard user@server:/opt/

# Connectez-vous au serveur
ssh user@server

# Sur le serveur
cd /opt/hyperliquid-dashboard
docker-compose up -d --build
```

### Avec CI/CD (GitHub Actions exemple)

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/hyperliquid-dashboard
            git pull
            docker-compose up -d --build
```

---

## 📝 Mise à jour de l'application

```bash
# 1. Sauvegarder les données
cp backend/wallets.json backup-$(date +%Y%m%d).json

# 2. Pull les derniers changements
git pull

# 3. Rebuild et redémarrer
docker-compose up -d --build

# 4. Vérifier les logs
docker-compose logs -f
```

---

## 🎯 Performance

### Optimisations recommandées

**1. Limiter les ressources :**

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

**2. Enable logging rotation :**

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## ✅ Checklist de déploiement

- [ ] Docker et Docker Compose installés
- [ ] Fichier `.env` configuré avec la clé Alchemy
- [ ] Ports 80 et 3001 disponibles
- [ ] Firewall configuré (si nécessaire)
- [ ] `docker-compose up -d --build` exécuté
- [ ] Application accessible sur http://localhost
- [ ] Backend health check OK : http://localhost:3001/health
- [ ] Wallets ajoutés et balances récupérées
- [ ] Logs vérifiés : `docker-compose logs`

---

🎉 **Votre Hyperliquid Dashboard est maintenant en ligne !**