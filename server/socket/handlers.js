const { activeRooms, getOrLoadRoom, dropRoomIfEmpty } = require('../rooms/roomStore');

function leaveCurrentRoom(io, socket) {
  const { roomId, userId } = socket.data;
  if (!roomId) return;

  socket.leave(roomId);
  socket.data.roomId = null;

  const room = activeRooms.get(roomId);
  if (!room) return;

  const participant = room.participants.get(userId);
  // agar user naye socket se dobara aa chuka hai to purane socket ka disconnect ignore karo
  if (!participant || participant.socketId !== socket.id) return;

  room.removeParticipant(userId);
  io.to(roomId).emit('user_left', {
    userId,
    username: participant.username,
    participants: room.getParticipantList(),
  });
  dropRoomIfEmpty(roomId);
}

function registerHandlers(io) {
  io.on('connection', (socket) => {
    console.log('connected:', socket.id);

    socket.on('join_room', async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};

      try {
        const roomId = String(data?.roomId || '').trim().toUpperCase();
        const username = String(data?.username || '').trim().slice(0, 20);
        const userId = String(data?.userId || '').trim();

        if (!roomId || !username || !userId) {
          return reply({ ok: false, error: 'roomId, username and userId are required' });
        }

        // pehle purane room se nikalo, warna empty hua room map se hat sakta hai
        // aur hum purani (stale) Room object mein add kar dete
        leaveCurrentRoom(io, socket);

        const room = await getOrLoadRoom(roomId);
        if (!room) return reply({ ok: false, error: 'Room not found' });

        const participant = room.addParticipant(userId, username, socket.id);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.userId = userId;

        // baaki sabko batao (joiner ko ack se poora state mil jayega)
        socket.to(roomId).emit('user_joined', {
          username,
          userId,
          role: participant.role,
          participants: room.getParticipantList(),
        });

        reply({ ok: true, participants: room.getParticipantList(), videoId: room.videoId });
      } catch (err) {
        console.error('join_room failed:', err.message);
        reply({ ok: false, error: 'Something went wrong' });
      }
    });

    socket.on('leave_room', () => leaveCurrentRoom(io, socket));

    socket.on('disconnect', () => {
      console.log('disconnected:', socket.id);
      leaveCurrentRoom(io, socket);
    });
  });
}

module.exports = registerHandlers;