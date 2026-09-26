// ---------------------------------------------------------------------------
// FEATURE: In-memory representation of one live watch-party room.
// Holds current playback state, connected participants, pending approval
// requests, and recent chat messages. This is the "single source of truth"
// every client syncs against - clients never trust each other, only the server.
// ---------------------------------------------------------------------------
const crypto = require('crypto');

const MAX_CHAT_HISTORY = 50; // keep memory usage bounded per room

function cleanTime(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

class Room {
  constructor({ roomId, hostUserId, videoId }) {
    this.roomId = roomId;
    this.hostUserId = hostUserId;
    this.videoId = videoId;
    this.playState = 'paused'; // 'playing' | 'paused'
    this.currentTime = 0;
    this.updatedAt = Date.now(); // when currentTime was last set (for extrapolation)
    this.participants = new Map(); // userId -> { userId, username, role, socketId }
    this.pendingRequests = []; // participant requests awaiting host/mod approval
    this.chatMessages = []; // recent chat history, newest last
  }

  // FUNCTION: add/update a participant. Reconnects keep their previous role.
  addParticipant(userId, username, socketId) {
    const existing = this.participants.get(userId);
    const role = existing ? existing.role : userId === this.hostUserId ? 'host' : 'participant';
    const participant = { userId, username, role, socketId };
    this.participants.set(userId, participant);
    return participant;
  }

  removeParticipant(userId) {
    this.participants.delete(userId);
  }

  // FUNCTION: participant list sent to clients (socketId kept private/server-only)
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

  // FUNCTION: extrapolates current playback position without ticking every second.
  // If playing, add the real elapsed seconds since we last recorded the time.
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

  // Seeking doesn't change playing/paused state, just the position
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

  // FUNCTION: the payload broadcast to clients whenever playback state changes
  getSyncState() {
    return {
      videoId: this.videoId,
      playState: this.playState,
      currentTime: this.getCurrentTime(),
    };
  }

  // --- FEATURE: Approval queue (participants request, host/mod approves) ---

  addRequest({ userId, username, type, payload }) {
    const request = { id: crypto.randomUUID(), userId, username, type, payload, createdAt: Date.now() };
    this.pendingRequests.push(request);
    return request;
  }

  removeRequest(requestId) {
    this.pendingRequests = this.pendingRequests.filter((r) => r.id !== requestId);
  }

  // Called when a participant leaves/gets removed, so their requests don't linger forever
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

  // --- FEATURE (BONUS): Transfer host role to another participant ---
  // The old host is demoted to 'participant'; the target becomes 'host'.
  transferHost(newHostUserId) {
    const oldHost = this.participants.get(this.hostUserId);
    const newHost = this.participants.get(newHostUserId);
    if (!newHost) return false;

    if (oldHost) oldHost.role = 'participant';
    newHost.role = 'host';
    this.hostUserId = newHostUserId;
    return true;
  }

  // --- FEATURE (BONUS): Room-wide text chat ---
  addChatMessage({ userId, username, text }) {
    const message = { id: crypto.randomUUID(), userId, username, text, sentAt: Date.now() };
    this.chatMessages.push(message);
    if (this.chatMessages.length > MAX_CHAT_HISTORY) this.chatMessages.shift(); // trim oldest
    return message;
  }

  getChatMessages() {
    return this.chatMessages;
  }
}

module.exports = Room;
