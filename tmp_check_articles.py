import requests
urls = [
    'https://news-portal-hvgs.onrender.com/articles/feed/?ordering=-id',
    'https://news-portal-hvgs.onrender.com/api/articles/feed/?ordering=-id',
    'https://news-portal-hvgs.onrender.com/articles/trending/',
    'https://news-portal-hvgs.onrender.com/api/articles/trending/',
    'https://news-portal-hvgs.onrender.com/articles/',
]
for url in urls:
    try:
        r = requests.get(url, timeout=20)
        print('URL', url)
        print('STATUS', r.status_code)
        print(r.text[:1500])
        print('---')
    except Exception as e:
        print('ERR', url, e)
        print('---')
