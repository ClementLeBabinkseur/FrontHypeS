# Frontend Dockerfile - Multi-stage build

# Stage 1: Build (Debian, compatible Rollup)
FROM node:20-slim AS builder

WORKDIR /app

# Copier package files
COPY package*.json ./

# Installer toutes les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Build l'application
RUN npm run build

# Stage 2: Production avec Nginx (Alpine très léger)
FROM nginx:alpine

# Copier le build depuis le stage précédent
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier la configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
