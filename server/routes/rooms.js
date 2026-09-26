// ---------------------------------------------------------------------------
// FEATURE: REST endpoints for creating a room and checking if one exists.
// Actual realtime interaction (join, play, chat, etc.) happens over sockets.
// ---------------------------------------------------------------------------
const express = require('express');
const crypto = require('crypto');
const RoomModel = require('../models/RoomModel');

const router = express.Router();

// Excludes 0/O and 1/I so codes are easy to read/share out loud
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomId() {
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += CHARS[crypto.randomInt(CHARS.length)];
  }
  return id;
}

// FUNCTION: POST /api/rooms - create a room, creator's userId becomes host
router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    let roomId;
    do {
      roomId = generateRoomId();
    } while (await RoomModel.exists({ roomId })); // avoid rare code collisions

    const room = await RoomModel.create({ roomId, hostUserId: userId });
    res.status(201).json({ roomId: room.roomId });
  } catch (err) {
    console.error('create room failed:', err.message);
    res.status(500).json({ error: 'Could not create room' });
  }
});

// FUNCTION: GET /api/rooms/:roomId - check whether a room code is valid
router.get('/:roomId', async (req, res) => {
  const room = await RoomModel.findOne({ roomId: req.params.roomId.toUpperCase() });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ roomId: room.roomId });
});

module.exports = router;
