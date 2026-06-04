// Main JavaScript for News Portal Frontend
// This file can include global utilities and initialization

document.addEventListener('DOMContentLoaded', function() {
    console.log('News Portal Frontend initialized');
    // Initialize any global functionality here
});

// Utility function to fetch data from REST API
async function fetchFromAPI(endpoint) {
    try {
        const response = await fetch(`/api/${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching from API:', error);
        return null;
    }
}

// Utility function to handle API errors
function handleAPIError(error) {
    console.error('API Error:', error);
    // Display user-friendly error message
}
