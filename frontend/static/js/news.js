// News.js - Handle news data fetching and display

document.addEventListener('DOMContentLoaded', function() {
    const newsList = document.getElementById('news-list');
    if (!newsList) {
        return;
    }
    loadNews();
});

async function loadNews() {
    const newsList = document.getElementById('news-list');

    try {
        const response = await fetch('/api/articles/feed/?ordering=-id');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayNews(data);
    } catch (error) {
        console.error('Error loading news:', error);
        if (newsList) {
            newsList.innerHTML = '<p class="error">Failed to load news. Please try again later.</p>';
        }
    }
}

function displayNews(data) {
    const newsList = document.getElementById('news-list');
    if (!newsList) {
        return;
    }

    const articles = Array.isArray(data) ? data : (data.results || data || []);

    if (!articles.length) {
        newsList.innerHTML = '<p>No news available at the moment.</p>';
        return;
    }

    newsList.innerHTML = articles.map(article => `
        <article class="news-item">
            <h3>${article.title || 'No Title'}</h3>
            <p>Category: ${article.category_name || 'Uncategorized'}</p>
            <small>Posted: ${formatDate(article.published_at)}</small>
            <br>
            <a href="/news/${article.id}/" style="color:#2c3e50; text-decoration:underline;">Read More</a>
        </article>
    `).join('');
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date)) {
        return 'N/A';
    }
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
