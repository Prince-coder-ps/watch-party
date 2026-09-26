// ---------------------------------------------------------------------------
// Entry point: sets up Express (REST API), Socket.IO (realtime), and Mongo.
// ---------------------------------------------------------------------------
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL })); // only allow our own frontend
app.use(express.json());

// Simple health check endpoint - useful for confirming the server is reachable
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// REST routes for creating/checking rooms (see routes/rooms.js)
app.use('/api/rooms', require('./routes/rooms'));

// REST route for in-app YouTube search (see routes/youtube.js)
app.use('/api/youtube', require('./routes/youtube'));

// Socket.IO needs a raw http server to attach to (Express alone isn't enough)
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL },
});

// All realtime event handlers (join_room, play, pause, chat, etc.) live here
require('./socket/handlers')(io);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`server running on ${PORT}`));
  })
  .catch((err) => {
    console.error('Mongo connection failed:', err.message);
    process.exit(1);
  });
