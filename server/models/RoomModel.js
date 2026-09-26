// ---------------------------------------------------------------------------
// FEATURE: Persistent room storage (MongoDB / Mongoose schema).
// Only durable, long-lived room data is stored here. Fast-changing playback
// state (currentTime, playState) is NOT stored in DB - it lives in memory
// (see rooms/Room.js) since writing to DB every second would be wasteful.
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true }, // 6-char shareable code
    hostUserId: { type: String, required: true }, // current host's persistent userId
    videoId: { type: String, default: null }, // last video played, so it survives a restart
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
