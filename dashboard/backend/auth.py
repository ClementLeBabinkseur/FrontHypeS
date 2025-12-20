import requests

# 1. Login pour obtenir le token (une seule fois)
response = requests.post('http://clement94.duckdns.org:8080/api/auth/login', json={
    'username': '',
    'password': ''
})
TOKEN = response.json()['token']
print(TOKEN)
# Sauvegarde le token pour les prochaines requêtes