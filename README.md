# SYNC// — YouTube Watch Party

A real-time watch-party app: create a room, share the code, and everyone's
YouTube playback (play, pause, seek, video changes) stays perfectly in sync.
Built with role-based access control (Host / Moderator / Participant), an
approval-request flow for participants, host transfer, and room chat.

---

## Tech stack

| Layer      | Technology                                  |
|------------|----------------------------------------------|
| Frontend   | React + Vite, React Router, Tailwind CSS, lucide-react (icons) |
| Backend    | Node.js + Express                             |
| Realtime   | Socket.IO (WebSockets)                        |
| Database   | MongoDB (Mongoose)                            |
| Video      | YouTube IFrame Player API                     |

## Folder structure

```
SyncWave/
├── server/
│   ├── index.js              # app entry point (Express + Socket.IO + Mongo)
│   ├── permissions.js         # single source of truth for role permissions
│   ├── models/RoomModel.js    # Mongoose schema (durable room data)
│   ├── rooms/
│   │   ├── Room.js            # in-memory room state (playback, roles, chat, requests)
│   │   └── roomStore.js       # registry of currently-active rooms
│   ├── routes/rooms.js        # REST: create room / check room exists
│   ├── socket/handlers.js     # every realtime event (join, play, chat, RBAC...)
│   └── utils/youtube.js       # parses any YouTube URL format into a video ID
└── client/
    ├── index.html
    ├── tailwind.config.js
    └── src/
        ├── main.jsx / App.jsx
        ├── socket.js           # shared Socket.IO client instance
        ├── identity.js         # persistent per-browser userId
        ├── theme.js            # light/dark theme persistence
        ├── components/
        │   ├── Player.jsx      # YouTube player + sync logic
        │   └── ThemeToggle.jsx
        └── pages/
            ├── Home.jsx        # create / join room
            └── Room.jsx        # the watch party itself
```

## Setup & run locally

### 1. Backend

```bash
cd server
npm install
cp .env.example .env     # then edit .env with your own MongoDB URI
npm run dev               # starts on http://localhost:5000
```

> The in-app "search YouTube by title" bar needs a `YOUTUBE_API_KEY` in
> `server/.env`. Get a free one: Google Cloud Console → create/select a
> project → enable **YouTube Data API v3** → Credentials → Create API key.
> Without it, pasting a YouTube link still works fine - only the search
> box will show an error.

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env     # points at your backend URL
npm run dev               # starts on http://localhost:5173
```

Open two browser windows (use one Incognito window) at `http://localhost:5173`
to test with multiple users.

## Live deployment

_Add your deployed URL here after deploying, e.g._
`https://your-app.onrender.com`

Suggested platform: **Render** (supports WebSockets + Node backend +
static frontend in one place). Deploy `server/` as a Web Service and
`client/` as a Static Site (build command `npm run build`, publish
directory `dist`), and set `VITE_SERVER_URL` / `CLIENT_URL` / `MONGO_URI`
as environment variables on each service.

## Architecture overview

- **Server is the single source of truth.** No client ever trusts another
  client directly — every playback action (play/pause/seek/change video)
  goes through the server, which validates the sender's role before
  applying and broadcasting the new state.
- **In-memory room state + MongoDB.** Fast-changing playback state
  (`currentTime`, `playState`) lives in memory per room (`rooms/Room.js`)
  and is *not* written to the database every tick. Only durable data
  (room code, host, last video) is persisted to MongoDB, so a room
  survives a server restart.
- **Late-joiner sync.** A room's current position is derived on demand
  from `currentTime` + elapsed time since it was last updated — so a
  user joining mid-playback lands at the correct timestamp without any
  polling.
- **Role-based access control.** `permissions.js` is the single place
  that defines who can do what. Host-only actions (assign role, remove,
  transfer host) and control actions (play/pause/seek/change video,
  restricted to Host + Moderator) are both enforced server-side.
- **Approval-request flow.** A plain Participant's playback actions
  don't apply directly — they're queued as a `pending request` that a
  Host/Moderator can approve or reject. Approved requests reuse the
  exact same state-mutation methods as direct controls, so there's no
  duplicated logic between the two paths.
- **WebSockets (Socket.IO).** Rooms are Socket.IO rooms; every event
  (`play`, `pause`, `seek`, `change_video`, `assign_role`,
  `remove_participant`, `transfer_host`, `chat_message`, …) is scoped to
  the relevant room and broadcast only to that room's members.

## Known trade-offs

- Room state lives in a single Node process's memory — horizontally
  scaling to multiple server instances would need a shared store (e.g.
  Redis) for room state and Socket.IO's Redis adapter for cross-server
  broadcast.
- Chat history is capped at the last 50 messages per room and is not
  persisted to the database (kept simple for this assignment's scope).
