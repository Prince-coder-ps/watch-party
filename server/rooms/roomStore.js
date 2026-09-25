const Room = require('./Room');
const RoomModel = require('../models/RoomModel');

// abhi jo rooms live hain (kam se kam ek banda andar hai)
const activeRooms = new Map();

async function getOrLoadRoom(roomId) {
  if (activeRooms.has(roomId)) return activeRooms.get(roomId);

  const doc = await RoomModel.findOne({ roomId });
  if (!doc) return null;

  // await ke beech mein kisi aur ne bhi load kar liya ho sakta hai
  if (activeRooms.has(roomId)) return activeRooms.get(roomId);

  const room = new Room({
    roomId: doc.roomId,
    hostUserId: doc.hostUserId,
    videoId: doc.videoId,
  });
  activeRooms.set(roomId, room);
  return room;
}

function dropRoomIfEmpty(roomId) {
  const room = activeRooms.get(roomId);
  if (room && room.isEmpty()) activeRooms.delete(roomId);
}

module.exports = { activeRooms, getOrLoadRoom, dropRoomIfEmpty };