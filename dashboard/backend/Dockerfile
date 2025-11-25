# Backend Dockerfile
FROM node:20-alpine

# Créer le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances (production uniquement)
RUN npm ci --omit=dev

# Copier le code source
COPY . .

# S'assurer que wallets.json existe
RUN [ ! -f wallets.json ] && echo '{"wallets":[],"availableTags":[]}' > wallets.json || true

# Exposer le port
EXPOSE 3001

# Variables d'environnement par défaut
ENV PORT=3001
ENV NODE_ENV=production

# Commande de démarrage
CMD ["node", "server.js"]
