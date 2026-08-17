import requests
import json

API_BASE = 'https://news-portal-hvgs.onrender.com'

print("=== Testing /api/articles/feed/ ===")
try:
    response = requests.get(f'{API_BASE}/api/articles/feed/?ordering=-id', timeout=10)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response keys: {data.keys() if isinstance(data, dict) else 'N/A'}")
    if isinstance(data, dict) and 'results' in data:
        print(f"Feed articles count: {len(data['results'])}")
except Exception as e:
    print(f"Error: {e}")

print("\n=== Testing /api/articles/trending/ ===")
try:
    response = requests.get(f'{API_BASE}/api/articles/trending/', timeout=10)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response type: {type(data)}")
    if isinstance(data, list):
        print(f"Trending articles count: {len(data)}")
    elif isinstance(data, dict):
        print(f"Response keys: {data.keys()}")
except Exception as e:
    print(f"Error: {e}")

print("\n=== Testing /api/articles/categories/ ===")
try:
    response = requests.get(f'{API_BASE}/api/articles/categories/', timeout=10)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response keys: {data.keys() if isinstance(data, dict) else 'N/A'}")
    if isinstance(data, dict) and 'results' in data:
        print(f"Categories count: {len(data['results'])}")
except Exception as e:
    print(f"Error: {e}")
