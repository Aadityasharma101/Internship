import requests
import json

API_BASE = 'https://news-portal-hvgs.onrender.com'

print("=== Testing individual article endpoint ===")
try:
    response = requests.get(f'{API_BASE}/api/articles/82/', timeout=10)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Full Article Details:")
        print(json.dumps(data, indent=2))
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Error: {e}")
