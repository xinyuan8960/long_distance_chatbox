require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const OpenAI = require('openai');

// Initialize services
const app = express();
const server = http.createServer(app);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Socket.io configuration
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

// In-memory room storage
const validRooms = new Map();

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Room authentication
  socket.on('joinRoom', ({ room, password }, callback) => {
    if (!room || !password) {
      return callback({ success: false, message: 'Room and password required' });
    }

    if (!validRooms.has(room)) {
      validRooms.set(room, password);
    }

    if (validRooms.get(room) === password) {
      socket.join(room);
      callback({ success: true });
      console.log(`User joined room: ${room}`);
    } else {
      callback({ success: false, message: 'Invalid password' });
      socket.disconnect();
    }
  });

  // Message handling
  socket.on('message', async ({ room, text, toneLevel = 3 }) => {
    try {
      const prompt = buildPrompt(text, toneLevel);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2 + (toneLevel-1)*0.15
      });

      const rephrased = response.choices[0].message.content;
      io.to(room).emit('message', { 
        original: text,
        rephrased,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Message processing failed:', error);
      io.to(room).emit('message', { original: text, rephrased: text });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

function buildPrompt(text, toneLevel) {
  const tactics = [
    "Use comforting language like 'I understand...'",
    "Maintain neutrality with 'we' statements",
    "Express needs clearly but respectfully"
  ];
  
  return `As a relationship expert, rephrase this message using:
Strategy: ${tactics[toneLevel - 1 || 0]}
Original: ${text}
Rephrased:`;
}

// Server startup
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});