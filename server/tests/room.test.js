// ---------------------------------------------------------------------------
// Unit tests for rooms/Room.js - the in-memory single source of truth for
// one live room. No sockets/DB involved, so every method is exercised
// directly against a fresh Room instance.
// ---------------------------------------------------------------------------
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Room = require('../rooms/Room');

function makeRoom(overrides = {}) {
  return new Room({ roomId: 'ABC123', hostUserId: 'host-1', videoId: 'dQw4w9WgXcQ', ...overrides });
}

// --- participants & roles -------------------------------------------------

test('the host gets role "host" the first time they join', () => {
  const room = makeRoom();
  const p = room.addParticipant('host-1', 'Prince', 'socket-1');
  assert.equal(p.role, 'host');
});

test('everyone else starts as a plain participant', () => {
  const room = makeRoom();
  const p = room.addParticipant('user-2', 'Riya', 'socket-2');
  assert.equal(p.role, 'participant');
});

test('a reconnecting user keeps whatever role they already had', () => {
  const room = makeRoom();
  room.addParticipant('user-2', 'Riya', 'socket-2');
  room.participants.get('user-2').role = 'moderator'; // promoted mid-session
  const rejoined = room.addParticipant('user-2', 'Riya', 'socket-2-new'); // new tab/reconnect
  assert.equal(rejoined.role, 'moderator');
});

test('getParticipantList never leaks the internal socketId', () => {
  const room = makeRoom();
  room.addParticipant('host-1', 'Prince', 'socket-1');
  const list = room.getParticipantList();
  assert.equal(list.length, 1);
  assert.deepEqual(Object.keys(list[0]).sort(), ['role', 'userId', 'username']);
});

test('isEmpty reflects participant count', () => {
  const room = makeRoom();
  assert.equal(room.isEmpty(), true);
  room.addParticipant('host-1', 'Prince', 'socket-1');
  assert.equal(room.isEmpty(), false);
  room.removeParticipant('host-1');
  assert.equal(room.isEmpty(), true);
});

// --- playback sync ----------------------------------------------------------

test('play/pause/seek set the position and state exactly as given', () => {
  const room = makeRoom();
  room.play(10);
  assert.equal(room.playState, 'playing');
  assert.equal(room.currentTime, 10);

  room.pause(25);
  assert.equal(room.playState, 'paused');
  assert.equal(room.currentTime, 25);

  room.seek(5);
  assert.equal(room.playState, 'paused'); // seek doesn't change play/pause state
  assert.equal(room.currentTime, 5);
});

test('an invalid time (negative/NaN) falls back to the current extrapolated time instead of corrupting state', () => {
  const room = makeRoom();
  room.pause(50);
  room.play(-1); // bad input
  assert.equal(room.currentTime, 50); // fell back, didn't become -1
  assert.equal(room.playState, 'playing');

  room.pause(NaN);
  assert.equal(room.currentTime, 50); // fell back again
});

test('getCurrentTime extrapolates forward while playing', () => {
  const room = makeRoom();
  room.play(10);
  room.updatedAt = Date.now() - 5000; // pretend "play" happened 5s ago
  const t = room.getCurrentTime();
  assert.ok(t >= 14.9 && t <= 15.5, `expected ~15s, got ${t}`);
});

test('getCurrentTime does NOT extrapolate while paused', () => {
  const room = makeRoom();
  room.pause(10);
  room.updatedAt = Date.now() - 5000;
  assert.equal(room.getCurrentTime(), 10);
});

test('changeVideo resets position to 0 and pauses', () => {
  const room = makeRoom();
  room.play(40);
  room.changeVideo('newVideoId1');
  assert.equal(room.videoId, 'newVideoId1');
  assert.equal(room.currentTime, 0);
  assert.equal(room.playState, 'paused');
});

test('getSyncState shape matches what clients expect', () => {
  const room = makeRoom();
  room.pause(12);
  assert.deepEqual(room.getSyncState(), {
    videoId: 'dQw4w9WgXcQ',
    playState: 'paused',
    currentTime: 12,
  });
});

// --- approval-request queue --------------------------------------------------

test('addRequest queues a request with a generated id', () => {
  const room = makeRoom();
  const req = room.addRequest({ userId: 'user-2', username: 'Riya', type: 'play', payload: { time: 0 } });
  assert.ok(req.id);
  assert.equal(room.getPendingRequests().length, 1);
});

test('removeRequest drops just that one request', () => {
  const room = makeRoom();
  const a = room.addRequest({ userId: 'user-2', username: 'Riya', type: 'play', payload: {} });
  room.addRequest({ userId: 'user-3', username: 'Sam', type: 'pause', payload: {} });
  room.removeRequest(a.id);
  assert.equal(room.getPendingRequests().length, 1);
  assert.equal(room.getPendingRequests()[0].username, 'Sam');
});

test('removeRequestsByUser clears all of one user\'s pending requests (e.g. on removal/leave)', () => {
  const room = makeRoom();
  room.addRequest({ userId: 'user-2', username: 'Riya', type: 'play', payload: {} });
  room.addRequest({ userId: 'user-2', username: 'Riya', type: 'seek', payload: {} });
  room.addRequest({ userId: 'user-3', username: 'Sam', type: 'pause', payload: {} });
  room.removeRequestsByUser('user-2');
  const remaining = room.getPendingRequests();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].userId, 'user-3');
});

// --- host transfer -----------------------------------------------------------

test('transferHost promotes the target and demotes the old host', () => {
  const room = makeRoom();
  room.addParticipant('host-1', 'Prince', 'socket-1');
  room.addParticipant('user-2', 'Riya', 'socket-2');

  const ok = room.transferHost('user-2');
  assert.equal(ok, true);
  assert.equal(room.hostUserId, 'user-2');
  assert.equal(room.participants.get('user-2').role, 'host');
  assert.equal(room.participants.get('host-1').role, 'participant');
});

test('transferHost fails cleanly if the target is not in the room', () => {
  const room = makeRoom();
  room.addParticipant('host-1', 'Prince', 'socket-1');
  const ok = room.transferHost('ghost-user');
  assert.equal(ok, false);
  assert.equal(room.hostUserId, 'host-1'); // unchanged
});

// --- chat --------------------------------------------------------------------

test('addChatMessage appends and getChatMessages returns them in order', () => {
  const room = makeRoom();
  room.addChatMessage({ userId: 'host-1', username: 'Prince', text: 'hey' });
  room.addChatMessage({ userId: 'user-2', username: 'Riya', text: 'hi!' });
  const messages = room.getChatMessages();
  assert.equal(messages.length, 2);
  assert.equal(messages[0].text, 'hey');
  assert.equal(messages[1].text, 'hi!');
});

test('chat history is capped at 50 messages, oldest dropped first', () => {
  const room = makeRoom();
  for (let i = 0; i < 55; i++) {
    room.addChatMessage({ userId: 'host-1', username: 'Prince', text: `msg-${i}` });
  }
  const messages = room.getChatMessages();
  assert.equal(messages.length, 50);
  assert.equal(messages[0].text, 'msg-5'); // first 5 trimmed off
  assert.equal(messages[49].text, 'msg-54');
});
