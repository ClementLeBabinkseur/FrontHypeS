import requests

# 1. Login pour obtenir le token (une seule fois)
response = requests.post('http://localhost:3001/api/auth/login', json={
    'username': 'admin',
    'password': 'Hyperliquid'
})
TOKEN = response.json()['token']
print(TOKEN)
# Sauvegarde le token pour les prochaines requêtes