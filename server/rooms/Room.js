class Room {
  constructor({ roomId, hostUserId, videoId }) {
    this.roomId = roomId;
    this.hostUserId = hostUserId;
    this.videoId = videoId;
    this.playState = 'paused';
    this.currentTime = 0;
    this.participants = new Map(); // userId -> { userId, username, role, socketId }
  }

  addParticipant(userId, username, socketId) {
    const existing = this.participants.get(userId);
    // reconnect pe purana role hi rakhna hai
    const role = existing ? existing.role : userId === this.hostUserId ? 'host' : 'participant';

    const participant = { userId, username, role, socketId };
    this.participants.set(userId, participant);
    return participant;
  }

  removeParticipant(userId) {
    this.participants.delete(userId);
  }

  // socketId client ko nahi bhejte, sirf kaam ki cheezein
  getParticipantList() {
    return [...this.participants.values()].map(({ userId, username, role }) => ({
      userId,
      username,
      role,
    }));
  }

  isEmpty() {
    return this.participants.size === 0;
  }
}

module.exports = Room;