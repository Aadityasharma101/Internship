// frontend/static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Check if we are on a page that actually displays comments
    const commentContainer = document.getElementById('api-data-container');
    
    if (commentContainer) {
        // 2. Fetch comments from your hosted API backend
        fetchComments();
    }
});

// Function to fetch data from your Render hosted API
function fetchComments() {
    // Replace with your actual backend URL endpoint for comments
    const API_URL = 'https://news-portal-hvgs.onrender.com/api/comments/'; 

    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // data should be the list of comments from your Django admin DB
            renderComments(data); 
        })
        .catch(error => {
            console.error('Error fetching comments:', error);
            const container = document.getElementById('api-data-container');
            if (container) {
                container.innerHTML = '<p class="error">Failed to load comments.</p>';
            }
        });
}

// Function to build and inject the HTML cards dynamically
function renderComments(apiCommentsArray) {
    const container = document.getElementById('api-data-container');
    container.innerHTML = ''; // Clear loading message

    if (apiCommentsArray.length === 0) {
        container.innerHTML = '<p class="no-comments">No comments yet.</p>';
        return;
    }

    apiCommentsArray.forEach(comment => {
        // Determine if it is a reply based on the 'parent' field from your schema
        const replyClass = comment.parent ? 'reply-card' : '';
        
        // Grab the first letter of the user's username for the avatar fallback
        const firstLetter = comment.user && comment.user.username 
            ? comment.user.username.charAt(0).toUpperCase() 
            : '?';
            
        const username = comment.user ? comment.user.username : 'Anonymous';

        const commentHtml = `
            <div class="comment-card ${replyClass}">
                <div class="comment-avatar-wrapper">
                    <div class="comment-avatar-placeholder">${firstLetter}</div>
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-username">${username}</span>
                        <span class="comment-timestamp">${formatTimestamp(comment.created_at)}</span>
                    </div>
                    <div class="comment-body">
                        <p>${comment.content}</p>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', commentHtml);
    });
}

// Helper function to turn API timestamps (like 2026-06-12T13:25:19Z) into readable dates
function formatTimestamp(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}