#!/bin/bash

echo "========================================"
echo "  Hyperliquid Dashboard - Docker Start"
echo "========================================"
echo ""

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "[ERREUR] Docker n'est pas installé"
    echo "Installation: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# Vérifier si Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "[ERREUR] Docker Compose n'est pas installé"
    echo "Installation: sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose"
    exit 1
fi

# Vérifier si Docker est démarré
if ! docker ps &> /dev/null; then
    echo "[ERREUR] Docker n'est pas démarré ou vous n'avez pas les permissions"
    echo "Solution: sudo systemctl start docker"
    echo "Ou ajoutez votre user au groupe docker: sudo usermod -aG docker \$USER"
    exit 1
fi

echo "[OK] Docker est prêt"
echo ""

# Vérifier si .env existe
if [ ! -f .env ]; then
    echo "[ATTENTION] Fichier .env non trouvé"
    echo "Création depuis .env.example..."
    cp .env.example .env
    echo ""
    echo "[ACTION REQUISE] Éditez le fichier .env et ajoutez votre clé Alchemy"
    echo "Commande: nano .env"
    exit 1
fi

echo "[INFO] Lancement de l'application..."
echo ""

# Build et démarrage
docker-compose up -d --build

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERREUR] Échec du démarrage"
    echo "Consultez les logs: docker-compose logs"
    exit 1
fi

echo ""
echo "========================================"
echo "  Application lancée avec succès!"
echo "========================================"
echo ""
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:3001/health"
echo ""
echo "Commandes utiles:"
echo "  - Voir les logs: docker-compose logs -f"
echo "  - Arrêter: docker-compose down"
echo "  - Redémarrer: docker-compose restart"
echo ""
echo "Affichage des logs (Ctrl+C pour quitter)..."
echo ""

sleep 2
docker-compose logs -f