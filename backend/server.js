require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { STRATEGIES, TONE_LEVELS, PROMPT_TEMPLATE } = require('./config/prompt.config');


// Enhanced CORS configuration
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['POST', 'GET'],
  credentials: true
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const activeRooms = new Map();

// ========================
// PRACTICE AREA 1: PROMPT TEMPLATES (moved to prompts.config)
// ========================
const getPrompt = (strategyKey, text, toneLevel) => {
  const strategy = STRATEGIES[strategyKey] || STRATEGIES.therapist;
  
  return PROMPT_TEMPLATE
    .replace('{base}', strategy.base)
    .replace('{principles}', strategy.principles)
    .replace('{processing}', strategy.processing)
    .replace('{examples}', strategy.examples)
    .replace('{ethics}', strategy.ethics)
    .replace('{format}', strategy.format)
    .replace('{text}', text)
    .replace('{tone}', TONE_LEVELS[toneLevel - 1]);
};

// ========================

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('joinRoom', ({ room, password }, callback) => {
    if (!room || !password) return callback({ success: false, message: 'Credentials required' });

    if (activeRooms.has(room)) {
      const existing = activeRooms.get(room);
      if (existing.password !== password) return callback({ success: false, message: 'Invalid password' });
      if (existing.users >= 2) return callback({ success: false, message: 'Room full' });
      activeRooms.set(room, { ...existing, users: existing.users + 1 });
    } else {
      activeRooms.set(room, { password, users: 1 });
    }

    currentRoom = room;
    socket.join(room);
    callback({ success: true });
  });

  socket.on('message', ({ room, text }) => {
    const trimmed = text?.trim();
    if (!trimmed) return;

    socket.broadcast.to(room).emit('message', {
      text: trimmed,
      sender: 'partner',
      timestamp: Date.now()
    });

    socket.emit('message', {
      text: trimmed,
      sender: 'user',
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData.users <= 1) {
        activeRooms.delete(currentRoom);
      } else {
        activeRooms.set(currentRoom, { ...roomData, users: roomData.users - 1 });
      }
    }
  });
});

app.post('/preview', async (req, res) => {
  try {
    const { text, toneLevel = 3 } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    // ========================
    // PRACTICE AREA 2: PROMPT EXPERIMENTATION
    // ========================
    const STRATEGY = process.env.PROMPT_STRATEGY || 'basic'; // Change via .env
    const prompt = getPrompt(STRATEGY, text, toneLevel);
    
    console.log('Using prompt strategy:', STRATEGY);
    console.log('Generated prompt:', prompt);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.2 + (toneLevel * 0.1) // Dynamic temperature
    });

    const result = response.choices[0].message.content;
    // ========================

    res.json({ preview: result });
  } catch (error) {
    console.error('Preview Error:', error);
    res.status(500).json({ 
      error: 'Preview service error',
      details: error.message 
    });
  }
});

server.listen(5001, () => {
  console.log('Server running on http://localhost:5001');
  console.log('Available prompt strategies:', Object.keys(STRATEGIES));
});