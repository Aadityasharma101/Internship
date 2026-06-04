// News.js - Handle news data fetching and display

document.addEventListener('DOMContentLoaded', function() {
    loadNews();
});

async function loadNews() {
    const newsList = document.getElementById('news-list');
    
    try {
        // Fetch news from your REST API endpoint
        const response = await fetch('/api/news/');  // Update this endpoint as needed
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        displayNews(data);
    } catch (error) {
        console.error('Error loading news:', error);
        newsList.innerHTML = '<p class="error">Failed to load news. Please try again later.</p>';
    }
}

function displayNews(data) {
    const newsList = document.getElementById('news-list');
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
        newsList.innerHTML = '<p>No news available at the moment.</p>';
        return;
    }

    // If data has results property (paginated response)
    const articles = Array.isArray(data) ? data : (data.results || []);
    
    newsList.innerHTML = articles.map(article => `
        <article class="news-item">
            <h3>${article.title || 'No Title'}</h3>
            <p>${article.description || ''}</p>
            <small>Date: ${formatDate(article.published_at || article.created_at)}</small>
        </article>
    `).join('');
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
