require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

io.on("connection", (socket) => {
  socket.on("message", async ({ room, text }) => {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: "Rephrase politely." }, { role: "user", content: text }],
    });
    io.to(room).emit("message", response.choices[0].message.content);
  });

  socket.on("joinRoom", (room) => {
    socket.join(room);
  });
});

server.listen(5001, () => console.log("Server running on port 5001"));
