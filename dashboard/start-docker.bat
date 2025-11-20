@echo off
echo ========================================
echo   Hyperliquid Dashboard - Docker Start
echo ========================================
echo.

REM Vérifier si Docker est installé
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Docker n'est pas installe ou n'est pas dans le PATH
    echo Telechargez Docker Desktop: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

REM Vérifier si Docker est démarré
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Docker n'est pas demarre
    echo Lancez Docker Desktop et reessayez
    pause
    exit /b 1
)

echo [OK] Docker est pret
echo.

REM Vérifier si .env existe
if not exist .env (
    echo [ATTENTION] Fichier .env non trouve
    echo Creation d'un fichier .env depuis .env.example...
    copy .env.example .env
    echo.
    echo [ACTION REQUISE] Editez le fichier .env et ajoutez votre cle Alchemy
    notepad .env
    echo.
    pause
)

echo [INFO] Lancement de l'application...
echo.

REM Build et démarrage
docker-compose up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERREUR] Echec du demarrage
    echo Consultez les logs: docker-compose logs
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Application lancee avec succes!
echo ========================================
echo.
echo Frontend: http://localhost
echo Backend API: http://localhost:3001/health
echo.
echo Commandes utiles:
echo   - Voir les logs: docker-compose logs -f
echo   - Arreter: docker-compose down
echo   - Redemarrer: docker-compose restart
echo.
echo Appuyez sur une touche pour voir les logs...
pause >nul

docker-compose logs -f