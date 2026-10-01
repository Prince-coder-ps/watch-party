# Architecture — SYNC// (YouTube Watch Party)

This document goes deeper than the README's quick overview: how a room
lives on the server, how playback stays in sync, how roles are enforced,
and where the trade-offs are.

---

## 1. High-level system

```
┌───────────────┐        WebSocket (Socket.IO)        ┌────────────────────┐
│   Browser A    │◄───────────────────────────────────►│                    │
│  (Host)        │                                      │                    │
└───────────────┘        REST (create/check room)       │   Node/Express     │
┌───────────────┐◄───────────────────────────────────► │   + Socket.IO      │
│   Browser B    │                                      │   server           │
│  (Moderator)   │◄───────────────────────────────────►│                    │
└───────────────┘                                      └─────────┬──────────┘
┌───────────────┐                                                │
│   Browser C    │◄───────────────────────────────────►│         │ persists durable
│  (Participant) │                                                │ room data only
└───────────────┘                                      ┌─────────▼──────────┐
                                                          │   MongoDB Atlas     │
                                                          │  (roomId, host,     │
                                                          │   last videoId)     │
                                                          └────────────────────┘
```

- Every browser talks to the **same** Node process over one persistent
  Socket.IO connection. There is no browser-to-browser (peer) traffic —
  the server is the only thing every client trusts.
- REST (`routes/rooms.js`, `routes/youtube.js`) is only used for the two
  things that don't need to be realtime: creating a room and searching
  YouTube by title. Everything that happens _inside_ a room (playback,
  roles, chat, requests) goes over the socket.

## 2. Two layers of room state

A room's data is deliberately split across two stores with different
lifetimes:

| Data                                                                          | Where it lives                                                                     | Why                                                                                                                                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `roomId`, `hostUserId`, `videoId`                                             | MongoDB (`models/RoomModel.js`)                                                    | Durable — a room survives a server restart or redeploy                                                                                                             |
| `playState`, `currentTime`, `participants`, `pendingRequests`, `chatMessages` | In memory only (`rooms/Room.js`, held in `rooms/roomStore.js`'s `activeRooms` map) | Changes many times a second (every seek/play/pause); writing this to Mongo on every tick would be wasteful and add latency to something that needs to feel instant |

`getOrLoadRoom(roomId)` in `roomStore.js` is the bridge between the two:
the first time anyone joins a room after a server restart, it's loaded
from Mongo into an in-memory `Room` instance. `dropRoomIfEmpty` frees
that memory again once the last participant leaves — so RAM usage is
proportional to _currently active_ rooms, not to every room ever created.

## 3. Staying in sync: the extrapolation trick

Rather than broadcasting `currentTime` on a timer (which would mean
constant socket traffic and everyone's video drifting slightly out of
step between ticks), `Room.getCurrentTime()` computes the _true_ current
position on demand:

```js
getCurrentTime() {
  if (this.playState !== 'playing') return this.currentTime;
  return this.currentTime + (Date.now() - this.updatedAt) / 1000;
}
```

`currentTime` + `updatedAt` are only updated on an actual event (play,
pause, seek, a late-joiner's initial sync). Between events, every client
computes where the video _should_ be right now by adding elapsed wall-clock
time — so a user who joins 40 seconds into playback lands at the correct
timestamp immediately, with zero polling and no "catch-up" flicker.

## 4. Role-based access control (RBAC)

Three roles: **Host → Moderator → Participant**. The rules live in exactly
one place, `server/permissions.js`:

```js
canControlPlayback(role); // host or moderator → can play/pause/seek/change video directly
canManageParticipants(role); // host only         → can assign roles / remove / transfer host
```

Every socket handler that needs a permission check imports from here —
nothing hardcodes a role name inline. The client (`Room.jsx`) also checks
these same rules to enable/disable buttons, but that's a UX convenience
only; **the server re-validates every single action** using the socket's
own `socket.data.userId`, never trusting anything the client claims about
its own role.

## 5. The approval-request flow

A plain **Participant** can't control playback directly, but their
attempted action doesn't just get silently blocked — it's queued as a
`pendingRequest` (`Room.addRequest`) and shown to the Host/Moderator, who
can approve or reject it (`respond_to_request` → `applyRequest` in
`socket/handlers.js`).

The important design choice here: **approving a request reuses the exact
same `room.play()/pause()/seek()/changeVideo()` methods a direct control
action would call.** There's no second, parallel code path for
"apply-after-approval" — which means the two flows can never silently
drift apart in behavior.

## 6. Socket event catalog

| Client → Server                                         | Purpose                            | Who can send it               |
| ------------------------------------------------------- | ---------------------------------- | ----------------------------- |
| `join_room`                                             | Join/rejoin a room                 | anyone with a valid room code |
| `play` / `pause` / `seek` / `change_video`              | Direct playback control            | Host, Moderator               |
| `request_change` _(participant's attempt at the above)_ | Queues an approval request         | Participant                   |
| `respond_to_request`                                    | Approve/reject a pending request   | Host, Moderator               |
| `assign_role`                                           | Promote/demote a participant       | Host                          |
| `remove_participant`                                    | Kick someone out of the room       | Host                          |
| `transfer_host`                                         | Hand the host role to someone else | Host                          |
| `chat_message`                                          | Send a chat message                | anyone in the room            |

| Server → Client                                     | Purpose                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `sync_state`                                        | Broadcast playback state (`videoId`, `playState`, `currentTime`)                         |
| `user_joined` / `user_left` / `participant_removed` | Participant list changed                                                                 |
| `role_assigned`                                     | Someone's role changed (broadcast to the room; the affected client also shows a popup)   |
| `host_transferred`                                  | Host role moved to someone else                                                          |
| `pending_requests`                                  | Current approval queue (host/mod view)                                                   |
| `request_approved` / `request_rejected`             | Told to the requester only                                                               |
| `removed_from_room`                                 | Sent only to the socket being kicked — triggers the "you were removed" popup client-side |
| `chat_message`                                      | A new chat message                                                                       |
| `room_error`                                        | A rejected action, with a human-readable reason                                          |

All events are scoped to `io.to(room.roomId)` — a Socket.IO room — so
users in room `ABC123` never see traffic from room `XYZ789`.

## 7. Client-side notes

- `client/src/socket.js` holds one shared Socket.IO client instance for
  the whole app.
- `client/src/identity.js` generates and persists a `userId` per browser
  (not per tab) via `sessionStorage`, so a refresh mid-session reconnects
  as the _same_ participant with the _same_ role, instead of joining as a
  brand-new user.
- `Room.jsx` never mutates shared state itself — every value it renders
  (`participants`, `sync`, `pendingRequests`, `chatMessages`) comes from a
  server-pushed event. Button clicks only `socket.emit(...)`; the actual
  state change always comes back from the server.
- Popups (join welcome, "you're now a moderator", "you were removed") are
  purely reactive to server events too — the server decides what happened
  and to whom, the client just displays it.

## 8. Known trade-offs / what would change at scale

- **Single Node process.** Room state lives in one process's memory.
  Scaling horizontally would need a shared store (e.g. Redis) for room
  state plus Socket.IO's Redis adapter, so an event from a client on
  server instance A reaches a client connected to instance B.
- **Chat isn't persisted.** Capped at the last 50 messages per room, kept
  in memory only — out of scope for this assignment, but would move to
  MongoDB (its own collection, indexed by `roomId` + timestamp) if chat
  history needed to survive a restart.
- **CORS is locked to one exact `CLIENT_URL`.** Fine for a single
  production frontend; a preview-deployment URL (e.g. a Vercel PR preview)
  won't pass CORS unless it's added too.
- **No rate limiting on socket events yet.** A malicious/buggy client
  could spam `chat_message` or `seek`; not handled here since it's outside
  the assignment's scope, but would be a straightforward addition
  (e.g. a small per-socket token bucket in `socket/handlers.js`).
