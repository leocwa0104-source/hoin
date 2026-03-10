const express = require('express');
const cors = require('cors');
const turf = require('@turf/turf');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Configure CORS for Vercel
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Error handling middleware
app.use((err, req, res, _next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// --- In-Memory Database (WARNING: Will reset on Vercel cold starts) ---
// For a real Vercel app, you MUST use an external DB like MongoDB/Postgres/Redis
// Because Vercel functions are stateless and ephemeral.
// However, for this demo to work briefly during a session, we'll keep it.
// But beware data will vanish frequently.
global.db = global.db || {
    users: {},
    areas: [],
    messages: []
};
const db = global.db;

// --- API Routes ---

app.get('/api', (req, res) => {
    res.send("GeoChat API is running");
});

// Create a new user (simple registration)
app.post('/api/users', (req, res) => {
    try {
        console.log('Received login request:', req.body);
        if (!req.body || !req.body.name) {
            console.error('Missing name in request body');
            return res.status(400).json({ error: 'Name is required' });
        }
        const { name } = req.body;
        const id = uuidv4();
        db.users[id] = { id, name: name || 'Anonymous' };
        console.log('User created:', db.users[id]);
        res.json(db.users[id]);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Create a new area subscription
app.post('/api/areas', (req, res) => {
    const { userId, name, geometry } = req.body;
    if (!userId || !geometry) return res.status(400).send("Missing data");
    
    const area = {
        id: uuidv4(),
        userId,
        name,
        geometry, 
        createdAt: new Date()
    };
    db.areas.push(area);
    res.json(area);
});

// Get user's areas
app.get('/api/areas/:userId', (req, res) => {
    const userAreas = db.areas.filter(a => a.userId === req.params.userId);
    res.json(userAreas);
});

// Send a message
app.post('/api/messages', (req, res) => {
    const { senderId, content, lat, lng } = req.body;
    
    if (lat === undefined || lng === undefined || !content) {
        return res.status(400).send("Missing data");
    }

    const message = {
        id: uuidv4(),
        senderId,
        content,
        location: { lat, lng },
        createdAt: new Date()
    };
    
    db.messages.push(message);
    res.json({ success: true });
});

// Get messages for a specific area (Polling endpoint)
app.get('/api/areas/:areaId/messages', (req, res) => {
    const area = db.areas.find(a => a.id === req.params.areaId);
    if (!area) return res.status(404).send("Area not found");
    
    // Filter messages inside this area
    const areaPolygon = area.geometry;
    
    const relevantMessages = db.messages.filter(msg => {
        const pt = turf.point([msg.location.lng, msg.location.lat]);
        return turf.booleanPointInPolygon(pt, areaPolygon);
    });
    
    // Sort by time
    relevantMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    res.json(relevantMessages.slice(-50));
});

module.exports = app;
