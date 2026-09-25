const crypto = require('crypto');

function cleanTime(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

class Room {
  constructor({ roomId, hostUserId, videoId }) {
    this.roomId = roomId;
    this.hostUserId = hostUserId;
    this.videoId = videoId;
    this.playState = 'paused';
    this.currentTime = 0;
    this.updatedAt = Date.now(); // when currentTime was last set
    this.participants = new Map(); // userId -> { userId, username, role, socketId }
    this.pendingRequests = []; // requests from participants waiting for host/mod approval
  }

  addParticipant(userId, username, socketId) {
    const existing = this.participants.get(userId);
    // Keep the previous role on reconnect
    const role = existing ? existing.role : userId === this.hostUserId ? 'host' : 'participant';

    const participant = { userId, username, role, socketId };
    this.participants.set(userId, participant);
    return participant;
  }

  removeParticipant(userId) {
    this.participants.delete(userId);
  }

  // We don't send socketId to clients, only what they actually need
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

  // If the video is playing, add the elapsed seconds since it was last updated
  getCurrentTime() {
    if (this.playState !== 'playing') return this.currentTime;
    return this.currentTime + (Date.now() - this.updatedAt) / 1000;
  }

  play(time) {
    this.currentTime = cleanTime(time, this.getCurrentTime());
    this.playState = 'playing';
    this.updatedAt = Date.now();
  }

  pause(time) {
    this.currentTime = cleanTime(time, this.getCurrentTime());
    this.playState = 'paused';
    this.updatedAt = Date.now();
  }

  // Seeking doesn't change the playing/paused state
  seek(time) {
    this.currentTime = cleanTime(time, this.getCurrentTime());
    this.updatedAt = Date.now();
  }

  changeVideo(videoId) {
    this.videoId = videoId;
    this.currentTime = 0;
    this.playState = 'paused';
    this.updatedAt = Date.now();
  }

  getSyncState() {
    return {
      videoId: this.videoId,
      playState: this.playState,
      currentTime: this.getCurrentTime(),
    };
  }

  // --- Approval queue ---

  addRequest({ userId, username, type, payload }) {
    const request = { id: crypto.randomUUID(), userId, username, type, payload, createdAt: Date.now() };
    this.pendingRequests.push(request);
    return request;
  }

  removeRequest(requestId) {
    this.pendingRequests = this.pendingRequests.filter((r) => r.id !== requestId);
  }

  // Called when a participant leaves the room, so their stale requests don't linger
  removeRequestsByUser(userId) {
    this.pendingRequests = this.pendingRequests.filter((r) => r.userId !== userId);
  }

  getPendingRequests() {
    return this.pendingRequests.map(({ id, userId, username, type, payload }) => ({
      id,
      userId,
      username,
      type,
      payload,
    }));
  }
}

module.exports = Room;