const API_BASE = 'http://localhost:3000';

export const fishingAPI = {
  async catchFish(username, questionType = null) {
    const body = { username };
    if (questionType) {
      body.questionType = questionType;
    }
    
    const response = await fetch(`${API_BASE}/fish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to catch fish: ${response.statusText}`);
    }
    
    return response.json();
  },

  async catchBottle(username) {
    const response = await fetch(`${API_BASE}/bottles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to catch bottle: ${response.statusText}`);
    }
    
    return response.json();
  },

  async createBottle(fishId, username, message) {
    const response = await fetch(`${API_BASE}/bottle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fishId, username, message })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create bottle: ${response.statusText}`);
    }
    
    return response.json();
  },

  async respondToBottle(username, questionId, response) {
    const res = await fetch(`${API_BASE}/bottle-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, questionId, response })
    });
    
    if (!res.ok) {
      throw new Error(`Failed to respond to bottle: ${res.statusText}`);
    }
    
    return res.json();
  },

  async getUserBottles(username) {
    const response = await fetch(`${API_BASE}/user-bottles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get user bottles: ${response.statusText}`);
    }
    
    return response.json();
  }
};
