const express = require('express');
const crypto = require('crypto');
const RoomModel = require('../models/RoomModel');

const router = express.Router();

// 0/O aur 1/I hata diye taaki code padhne mein confusion na ho
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomId() {
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += CHARS[crypto.randomInt(CHARS.length)];
  }
  return id;
}

// create room, creator ka userId hi host banega
router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    let roomId;
    do {
      roomId = generateRoomId();
    } while (await RoomModel.exists({ roomId }));

    const room = await RoomModel.create({ roomId, hostUserId: userId });
    res.status(201).json({ roomId: room.roomId });
  } catch (err) {
    console.error('create room failed:', err.message);
    res.status(500).json({ error: 'Could not create room' });
  }
});

// check karne ke liye ki room exist karta hai ya nahi
router.get('/:roomId', async (req, res) => {
  const room = await RoomModel.findOne({ roomId: req.params.roomId.toUpperCase() });
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json({ roomId: room.roomId });
});

module.exports = router;