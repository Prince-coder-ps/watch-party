const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    hostUserId: { type: String, required: true },
    videoId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);