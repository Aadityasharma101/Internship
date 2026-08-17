#!/usr/bin/env python
import os
import django
import requests
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# Test the remote API
API_BASE = 'https://news-portal-hvgs.onrender.com'

print("=== Testing /api/articles/feed/ ===")
try:
    response = requests.get(f'{API_BASE}/api/articles/feed/?ordering=-id', timeout=10)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response type: {type(data)}")
    if isinstance(data, dict):
        print(f"Keys: {data.keys()}")
        print(f"Count: {data.get('count', 'N/A')}")
        results = data.get('results', [])
        print(f"Results count: {len(results)}")
        if results:
            first = results[0]
            print(f"First article keys: {first.keys()}")
            print(f"First article (truncated):")
            print(json.dumps(first, indent=2)[:800])
    elif isinstance(data, list):
        print(f"List with {len(data)} items")
        if data:
            print(f"First item keys: {data[0].keys()}")
except Exception as e:
    print(f"Error: {e}")

print("\n=== Testing /api/articles/categories/ ===")
try:
    response = requests.get(f'{API_BASE}/api/articles/categories/', timeout=10)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response (truncated):")
    print(json.dumps(data, indent=2)[:800])
except Exception as e:
    print(f"Error: {e}")

print("\n=== Testing /api/articles/trending/ ===")
try:
    response = requests.get(f'{API_BASE}/api/articles/trending/', timeout=10)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response type: {type(data)}")
    if isinstance(data, list):
        print(f"List with {len(data)} items")
    elif isinstance(data, dict):
        print(f"Dict with keys: {data.keys()}")
    print(f"Response (truncated):")
    print(json.dumps(data, indent=2)[:800])
except Exception as e:
    print(f"Error: {e}")
