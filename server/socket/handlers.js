// ---------------------------------------------------------------------------
// FEATURE: All Socket.IO event handlers - this is the realtime "brain" of
// the app. Every playback control, role change, chat message and approval
// request flows through here. The server is always the source of truth:
// clients never update each other directly, only through the server.
// ---------------------------------------------------------------------------
const { activeRooms, getOrLoadRoom, dropRoomIfEmpty } = require('../rooms/roomStore');
const RoomModel = require('../models/RoomModel');
const { canControlPlayback, canManageParticipants } = require('../permissions');
const { extractVideoId } = require('../utils/youtube');

// FUNCTION: handles a user leaving a room (explicit leave, disconnect, or tab close)
function leaveCurrentRoom(io, socket) {
  const { roomId, userId } = socket.data;
  if (!roomId) return;

  socket.leave(roomId);
  socket.data.roomId = null;

  const room = activeRooms.get(roomId);
  if (!room) return;

  const participant = room.participants.get(userId);
  // If the user already reconnected with a new socket, ignore this stale disconnect
  if (!participant || participant.socketId !== socket.id) return;

  room.removeParticipant(userId);
  room.removeRequestsByUser(userId); // drop any pending requests this user made

  io.to(roomId).emit('user_left', {
    userId,
    username: participant.username,
    participants: room.getParticipantList(),
  });
  io.to(roomId).emit('pending_requests', room.getPendingRequests());
  dropRoomIfEmpty(roomId);
}

// FUNCTION: shared logic for direct playback controls (play/pause/seek/change_video).
// Flow: find room -> check role -> mutate state -> broadcast to everyone.
function handleControl(io, socket, applyChange) {
  const room = activeRooms.get(socket.data.roomId);
  const participant = room?.participants.get(socket.data.userId);
  if (!participant || participant.socketId !== socket.id) return;

  if (!canControlPlayback(participant.role)) {
    return socket.emit('room_error', { message: "You don't have permission to control the video" });
  }

  const errorMessage = applyChange(room); // returning a string = validation failed
  if (errorMessage) return socket.emit('room_error', { message: errorMessage });

  io.to(room.roomId).emit('sync_state', room.getSyncState());
}

// FUNCTION: applies one approved request using the same room methods direct
// controls use, so behavior is identical either way (no duplicated logic).
function applyRequest(room, request) {
  switch (request.type) {
    case 'play':
      room.play(request.payload.time);
      return;
    case 'pause':
      room.pause(request.payload.time);
      return;
    case 'seek':
      room.seek(request.payload.time);
      return;
    case 'change_video':
      room.changeVideo(request.payload.videoId);
      RoomModel.updateOne({ roomId: room.roomId }, { videoId: request.payload.videoId }).catch((err) =>
        console.error('save videoId failed:', err.message)
      );
      return;
    default:
      return 'Unknown request type';
  }
}

// FUNCTION: shared guard for host-only actions (assign_role, remove_participant, transfer_host)
function getRoomIfHost(socket, room) {
  const caller = room?.participants.get(socket.data.userId);
  if (!caller || caller.socketId !== socket.id) return null;
  if (!canManageParticipants(caller.role)) {
    socket.emit('room_error', { message: "You don't have permission to manage participants" });
    return null;
  }
  return caller;
}

function registerHandlers(io) {
  io.on('connection', (socket) => {
    console.log('connected:', socket.id);

    // FEATURE: join or rejoin a room. Returns full current state via ack
    // (participants, playback sync, pending requests, chat history) so a
    // late joiner is fully caught up immediately.
    socket.on('join_room', async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};

      try {
        const roomId = String(data?.roomId || '').trim().toUpperCase();
        const username = String(data?.username || '').trim().slice(0, 20);
        const userId = String(data?.userId || '').trim();

        if (!roomId || !username || !userId) {
          return reply({ ok: false, error: 'roomId, username and userId are required' });
        }

        // Leave any previous room first - otherwise an emptied room could get
        // dropped from the map while we're still adding to the stale Room object
        leaveCurrentRoom(io, socket);

        const room = await getOrLoadRoom(roomId);
        if (!room) return reply({ ok: false, error: 'Room not found' });

        const participant = room.addParticipant(userId, username, socket.id);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.userId = userId;

        // Tell everyone else (the joiner gets the full state back via the ack)
        socket.to(roomId).emit('user_joined', {
          username,
          userId,
          role: participant.role,
          participants: room.getParticipantList(),
        });

        reply({
          ok: true,
          participants: room.getParticipantList(),
          sync: room.getSyncState(),
          pendingRequests: room.getPendingRequests(),
          chatMessages: room.getChatMessages(),
        });
      } catch (err) {
        console.error('join_room failed:', err.message);
        reply({ ok: false, error: 'Something went wrong' });
      }
    });

    // FEATURE: direct playback controls - only host/moderator can call these successfully
    socket.on('play', (data) => handleControl(io, socket, (room) => room.play(data?.time)));
    socket.on('pause', (data) => handleControl(io, socket, (room) => room.pause(data?.time)));
    socket.on('seek', (data) => handleControl(io, socket, (room) => room.seek(data?.time)));

    socket.on('change_video', (data) => {
      handleControl(io, socket, (room) => {
        const videoId = extractVideoId(data?.videoId);
        if (!videoId) return 'That does not look like a valid YouTube link';

        room.changeVideo(videoId);
        // Save to DB too, so the video is remembered if the room gets reloaded later
        RoomModel.updateOne({ roomId: room.roomId }, { videoId }).catch((err) =>
          console.error('save videoId failed:', err.message)
        );
      });
    });

    // FEATURE: a plain participant asks for a change instead of applying it directly
    socket.on('request_change', (data) => {
      const room = activeRooms.get(socket.data.roomId);
      const participant = room?.participants.get(socket.data.userId);
      if (!participant || participant.socketId !== socket.id) return;

      // Host/Moderator don't need to request - they should use direct controls
      if (canControlPlayback(participant.role)) {
        return socket.emit('room_error', { message: 'You can control playback directly' });
      }

      const type = data?.type;
      if (!['play', 'pause', 'seek', 'change_video'].includes(type)) {
        return socket.emit('room_error', { message: 'Invalid request type' });
      }

      let payload = data?.payload || {};

      // Validate change_video up front, so the host only ever sees clean, playable requests
      if (type === 'change_video') {
        const videoId = extractVideoId(payload.videoId);
        if (!videoId) return socket.emit('room_error', { message: 'That does not look like a valid YouTube link' });
        payload = { videoId };
      }

      room.addRequest({ userId: participant.userId, username: participant.username, type, payload });
      io.to(room.roomId).emit('pending_requests', room.getPendingRequests());
    });

    // FEATURE: host/moderator approves or rejects a pending participant request
    socket.on('respond_to_request', (data) => {
      const room = activeRooms.get(socket.data.roomId);
      const caller = room?.participants.get(socket.data.userId);
      if (!caller || caller.socketId !== socket.id) return;

      if (!canControlPlayback(caller.role)) {
        return socket.emit('room_error', { message: "You don't have permission to approve requests" });
      }

      const requestId = data?.requestId;
      const approve = Boolean(data?.approve);
      const request = room.pendingRequests.find((r) => r.id === requestId);
      if (!request) return socket.emit('room_error', { message: 'This request no longer exists' });

      room.removeRequest(requestId);
      io.to(room.roomId).emit('pending_requests', room.getPendingRequests());

      const requester = room.participants.get(request.userId);

      if (!approve) {
        if (requester) io.to(requester.socketId).emit('request_rejected', { type: request.type });
        return;
      }

      const errorMessage = applyRequest(room, request);
      if (errorMessage) {
        if (requester) io.to(requester.socketId).emit('request_rejected', { type: request.type });
        return;
      }

      io.to(room.roomId).emit('sync_state', room.getSyncState());
      if (requester) io.to(requester.socketId).emit('request_approved', { type: request.type });
    });

    // FEATURE (RBAC): host promotes/demotes a participant's role
    socket.on('assign_role', (data) => {
      const room = activeRooms.get(socket.data.roomId);
      if (!getRoomIfHost(socket, room)) return;

      const targetUserId = String(data?.userId || '').trim();
      const role = data?.role;

      if (!['moderator', 'participant'].includes(role)) {
        return socket.emit('room_error', { message: 'Invalid role' });
      }

      const target = room.participants.get(targetUserId);
      if (!target) return socket.emit('room_error', { message: 'Participant not found' });
      if (targetUserId === room.hostUserId) {
        return socket.emit('room_error', { message: "You can't change the host's role" });
      }

      target.role = role;

      io.to(room.roomId).emit('role_assigned', {
        userId: target.userId,
        username: target.username,
        role,
        participants: room.getParticipantList(),
      });
    });

    // FEATURE (RBAC): host removes a participant from the room entirely
    socket.on('remove_participant', (data) => {
      const room = activeRooms.get(socket.data.roomId);
      if (!getRoomIfHost(socket, room)) return;

      const targetUserId = String(data?.userId || '').trim();
      if (targetUserId === socket.data.userId) {
        return socket.emit('room_error', { message: "You can't remove yourself" });
      }

      const target = room.participants.get(targetUserId);
      if (!target) return socket.emit('room_error', { message: 'Participant not found' });

      room.removeParticipant(targetUserId);
      room.removeRequestsByUser(targetUserId);

      // Also disconnect their actual socket from the room - just removing them
      // from the participant list on our side isn't enough
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.leave(room.roomId);
        targetSocket.data.roomId = null;
        targetSocket.emit('removed_from_room');
      }

      io.to(room.roomId).emit('participant_removed', {
        userId: targetUserId,
        participants: room.getParticipantList(),
      });
      io.to(room.roomId).emit('pending_requests', room.getPendingRequests());
      dropRoomIfEmpty(room.roomId);
    });

    // FEATURE (BONUS): host transfers their role to another participant/moderator
    socket.on('transfer_host', async (data) => {
      const room = activeRooms.get(socket.data.roomId);
      if (!getRoomIfHost(socket, room)) return;

      const targetUserId = String(data?.userId || '').trim();
      if (targetUserId === socket.data.userId) {
        return socket.emit('room_error', { message: 'You are already the host' });
      }

      const success = room.transferHost(targetUserId);
      if (!success) return socket.emit('room_error', { message: 'Participant not found' });

      // Persist the new host so a server restart / room reload keeps it correct
      RoomModel.updateOne({ roomId: room.roomId }, { hostUserId: targetUserId }).catch((err) =>
        console.error('save new host failed:', err.message)
      );

      io.to(room.roomId).emit('host_transferred', {
        newHostUserId: targetUserId,
        participants: room.getParticipantList(),
      });
    });

    // FEATURE (BONUS): room-wide text chat, open to every participant (no role check)
    socket.on('chat_message', (data) => {
      const room = activeRooms.get(socket.data.roomId);
      const participant = room?.participants.get(socket.data.userId);
      if (!participant || participant.socketId !== socket.id) return;

      const text = String(data?.text || '').trim().slice(0, 500); // hard cap message length
      if (!text) return;

      const message = room.addChatMessage({
        userId: participant.userId,
        username: participant.username,
        text,
      });

      io.to(room.roomId).emit('chat_message', message);
    });

    socket.on('leave_room', () => leaveCurrentRoom(io, socket));

    socket.on('disconnect', () => {
      console.log('disconnected:', socket.id);
      leaveCurrentRoom(io, socket);
    });
  });
}

module.exports = registerHandlers;
