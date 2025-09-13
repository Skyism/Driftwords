const API_BASE = 'http://localhost:3000';

export const fishingAPI = {
    async createBottle(fish_id, username, message) {
        const response = await fetch(`${API_BASE}/respond-fish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fish_id, username, message })
        });
        return response.json();
    },
    
    async respondToBottle(username, question_id, response) {
        const fetchResponse = await fetch(`${API_BASE}/respond-bottle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, question_id, response })
        });
        return fetchResponse.json();
    }
};
