const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const turf = require('@turf/turf');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// --- In-Memory Database ---
// Ideally, use a spatial database like PostGIS.
// For this demo, we use in-memory arrays and Turf.js for spatial calculations.
const db = {
    users: {}, // userId -> { id, name }
    areas: [], // [{ id, userId, name, geometry: Polygon (GeoJSON), createdAt }]
    messages: [] // [{ id, senderId, content, location: { lat, lng }, createdAt }]
};

// --- API Routes ---

// Create a new user (simple registration)
app.post('/api/users', (req, res) => {
    const { name } = req.body;
    const id = uuidv4();
    db.users[id] = { id, name: name || 'Anonymous' };
    res.json(db.users[id]);
});

// Create a new area subscription
// geometry must be a valid GeoJSON Polygon
app.post('/api/areas', (req, res) => {
    const { userId, name, geometry } = req.body;
    if (!userId || !geometry) return res.status(400).send("Missing data");
    
    const area = {
        id: uuidv4(),
        userId,
        name,
        geometry, // Expecting GeoJSON Polygon
        createdAt: new Date()
    };
    db.areas.push(area);
    console.log(`User ${userId} subscribed to area: ${name}`);
    res.json(area);
});

// Get user's areas
app.get('/api/areas/:userId', (req, res) => {
    const userAreas = db.areas.filter(a => a.userId === req.params.userId);
    res.json(userAreas);
});

// Send a message (Broadcast based on location)
app.post('/api/messages', (req, res) => {
    const { senderId, content, lat, lng } = req.body;
    
    if (lat === undefined || lng === undefined || !content) {
        return res.status(400).send("Missing data");
    }

    // GeoJSON point is [lng, lat]
    const messagePoint = turf.point([lng, lat]); 
    
    const message = {
        id: uuidv4(),
        senderId,
        content,
        location: { lat, lng },
        createdAt: new Date()
    };
    
    db.messages.push(message);

    // --- Spatial Query Logic ---
    // Find all areas that contain this point
    // This is the "Reverse Spatial Query" logic
    
    const notifiedUsers = new Set();
    
    db.areas.forEach(area => {
        try {
            // Check if message point is inside the user's defined area
            if (turf.booleanPointInPolygon(messagePoint, area.geometry)) {
                
                // Notify this user via Socket.IO
                // We send the message AND which area it triggered
                io.to(area.userId).emit('new_message', {
                    areaId: area.id,
                    message
                });
                
                notifiedUsers.add(area.userId);
            }
        } catch (e) {
            console.error("Spatial check error for area " + area.id, e.message);
        }
    });

    console.log(`Message broadcast to ${notifiedUsers.size} users.`);
    res.json({ success: true, recipients: notifiedUsers.size });
});

// Get messages for a specific area (History)
app.get('/api/areas/:areaId/messages', (req, res) => {
    const area = db.areas.find(a => a.id === req.params.areaId);
    if (!area) return res.status(404).send("Area not found");
    
    // Filter messages inside this area
    const areaPolygon = area.geometry;
    
    const relevantMessages = db.messages.filter(msg => {
        const pt = turf.point([msg.location.lng, msg.location.lat]);
        return turf.booleanPointInPolygon(pt, areaPolygon);
    });
    
    // Sort by time desc (newest first) then take latest 50
    // Or normally, clients want oldest first if building a chat log. 
    // Let's return sorted by time ASC for chat UI
    relevantMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    res.json(relevantMessages.slice(-50));
});


// --- Socket Connection ---
io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    
    // Client sends their userId to join a private room
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`Socket ${socket.id} joined user room ${userId}`);
    });

    socket.on('disconnect', () => {
        // console.log('User disconnected');
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
