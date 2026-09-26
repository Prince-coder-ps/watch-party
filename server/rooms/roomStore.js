// ---------------------------------------------------------------------------
// FEATURE: Registry of currently-active (in-memory) rooms, keyed by roomId.
// Rooms are lazily loaded from MongoDB on first join and dropped from memory
// once empty - this keeps RAM usage proportional to *active* rooms only.
// ---------------------------------------------------------------------------
const Room = require('./Room');
const RoomModel = require('../models/RoomModel');

const activeRooms = new Map(); // roomId -> Room instance (only rooms with >=1 user)

// FUNCTION: get a live Room, loading it from Mongo if it isn't in memory yet
async function getOrLoadRoom(roomId) {
  if (activeRooms.has(roomId)) return activeRooms.get(roomId);

  const doc = await RoomModel.findOne({ roomId });
  if (!doc) return null;

  // Someone else may have loaded it while we were awaiting the DB call above
  if (activeRooms.has(roomId)) return activeRooms.get(roomId);

  const room = new Room({
    roomId: doc.roomId,
    hostUserId: doc.hostUserId,
    videoId: doc.videoId,
  });
  activeRooms.set(roomId, room);
  return room;
}

// FUNCTION: free memory once nobody is left in a room (data still safe in Mongo)
function dropRoomIfEmpty(roomId) {
  const room = activeRooms.get(roomId);
  if (room && room.isEmpty()) activeRooms.delete(roomId);
}

module.exports = { activeRooms, getOrLoadRoom, dropRoomIfEmpty };
