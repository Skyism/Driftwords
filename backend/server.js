import express from 'express';
import cors from 'cors';
import { fish_for_fish, fish_for_bottles } from './fishing.js';
import { respond_fish, respond_bottle } from './respond_fish.js';
import { fetch_user_bottles } from './fetch_user_bottles.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.post('/fish', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    
    const fish = await fish_for_fish(username);
    
    if (!fish) {
      return res.status(404).json({ error: 'No fish available' });
    }
    
    res.json(fish);
  } catch (error) {
    console.error('Fish endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/bottles', async (req, res) => {
  try {
    console.log('Bottles endpoint called with:', req.body);
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    
    console.log('Calling fish_for_bottles with username:', username);
    const bottle = await fish_for_bottles(username);
    console.log('fish_for_bottles returned:', bottle);
    
    if (!bottle) {
      return res.status(404).json({ error: 'No bottles available' });
    }
    
    res.json(bottle);
  } catch (error) {
    console.error('Bottles endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/bottle', async (req, res) => {
  try {
    const { fishId, username, message } = req.body;
    
    if (!fishId || !username || !message) {
      return res.status(400).json({ error: 'fishId, username, and message required' });
    }
    
    const result = await respond_fish(fishId, username, message);
    
    if (result === null) {
      return res.status(500).json({ error: 'Failed to create bottle' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Bottle endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/bottle-response', async (req, res) => {
  try {
    const { username, questionId, response } = req.body;
    
    if (!username || !questionId || !response) {
      return res.status(400).json({ error: 'username, questionId, and response required' });
    }
    
    const result = await respond_bottle(username, questionId, response);
    
    if (result === null) {
      return res.status(500).json({ error: 'Failed to add response' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Bottle response endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/user-bottles', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }
    
    const bottles = await fetch_user_bottles(username);
    
    if (!bottles) {
      return res.status(500).json({ error: 'Failed to fetch bottles' });
    }
    
    res.json(bottles);
  } catch (error) {
    console.error('User bottles endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
