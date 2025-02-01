require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const OpenAI = require("openai");

// Initialize Express App
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Middleware
app.use(cors()); // Enable Cross-Origin Requests
app.use(express.json()); // Enable JSON Parsing

// Initialize OpenAI API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Socket.io: Handle Real-Time Chat
io.on("connection", (socket) => {
  console.log("New user connected");

  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on("message", async ({ room, text }) => {
    try {
      // Send message to OpenAI for rephrasing
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "Rephrase this text to be more polite and constructive." },
          { role: "user", content: text },
        ],
      });

      const rephrasedText = response.choices[0].message.content;

      // Broadcast rephrased message to all users in the room
      io.to(room).emit("message", { text: rephrasedText });
    } catch (error) {
      console.error("OpenAI API Error:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// Rephrase Route for Testing
app.post("/rephrase", async (req, res) => {
  console.log("Received /rephrase request:", req.body);
  
  if (!req.body.text) {
    return res.status(400).json({ error: "Missing 'text' field in request body" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "Rephrase this text to be more polite and constructive." },
        { role: "user", content: req.body.text },
      ],
    });

    res.json({ rephrased: response.choices[0].message.content });
  } catch (error) {
    console.error("OpenAI API Error:", error);
    res.status(500).json({ error: "Something went wrong with OpenAI" });
  }
});

// Start Server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
