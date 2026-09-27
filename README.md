# SYNC// — YouTube Watch Party

A real-time watch-party app: create a room, share the code, and everyone's
YouTube playback (play, pause, seek, video changes) stays perfectly in sync.
Built with role-based access control (Host / Moderator / Participant), an
approval-request flow for participants, host transfer, and room chat.

**Live app:** `https://watch-party-lorr-smoky.vercel.app`

---

## Tech stack

| Layer    | Technology                                                      |
| -------- | --------------------------------------------------------------- |
| Frontend | React + Vite, React Router, Tailwind CSS, lucide-react (icons)  |
| Backend  | Node.js + Express                                               |
| Realtime | Socket.IO (WebSockets)                                          |
| Database | MongoDB (Mongoose)                                              |
| Video    | YouTube IFrame Player API + YouTube Data API v3 (in-app search) |

## Features

**Core (assignment requirements)**

- Room-based sessions with shareable 6-character codes / invite links
- Real-time sync of play, pause, seek, and video changes across all participants
- Role-based access control — Host, Moderator, Participant — enforced server-side
- Host can assign/revoke Moderator, remove participants, and transfer host
- A Participant's actions queue as a request; Host/Moderator approves or rejects it

**Beyond the MVP**

- In-app YouTube search (search by title, pick from real results — no need to
  paste a link)
- Room chat
- Persistent rooms — room code, host, and last-played video survive a server
  restart (MongoDB)
- Light/dark theme toggle
- Responsive layout (mobile → tablet → desktop) with a custom SYNC// design system

## Folder structure

```
SyncWave/
├── server/
│   ├── index.js                # app entry point (Express + Socket.IO + Mongo)
│   ├── permissions.js           # single source of truth for role permissions
│   ├── models/RoomModel.js      # Mongoose schema (durable room data)
│   ├── rooms/
│   │   ├── Room.js              # in-memory room state (playback, roles, chat, requests)
│   │   └── roomStore.js         # registry of currently-active rooms
│   ├── routes/
│   │   ├── rooms.js             # REST: create room / check room exists
│   │   └── youtube.js           # REST: in-app YouTube search (wraps Data API v3)
│   ├── socket/handlers.js       # every realtime event (join, play, chat, RBAC...)
│   └── utils/youtube.js         # parses any YouTube URL format into a video ID
└── client/
    ├── index.html
    ├── tailwind.config.js
    ├── public/favicon.svg
    └── src/
        ├── main.jsx / App.jsx
        ├── socket.js             # shared Socket.IO client instance
        ├── identity.js           # persistent per-browser userId
        ├── theme.js              # light/dark theme persistence
        ├── icons.jsx             # shared icon set (lucide-react re-exports)
        ├── components/
        │   ├── Player.jsx        # YouTube player + sync logic
        │   ├── YouTubeSearch.jsx # search-by-title panel
        │   ├── ThemeToggle.jsx
        │   └── Footer.jsx
        └── pages/
            ├── Home.jsx          # create / join room
            └── Room.jsx          # the watch party itself
```

## Setup & run locally

### 1. Backend

```bash
cd server
npm install
cp .env.example .env     # then edit .env with your own values
npm run dev               # starts on http://localhost:5000
```

`server/.env` needs:

| Variable          | Purpose                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| `MONGO_URI`       | MongoDB Atlas (or local) connection string                                                                           |
| `YOUTUBE_API_KEY` | Enables the in-app search bar (Google Cloud Console → enable **YouTube Data API v3** → Credentials → Create API key) |
| `CLIENT_URL`      | Your frontend's origin, for CORS + Socket.IO (e.g. `http://localhost:5173` locally)                                  |

> Without `YOUTUBE_API_KEY`, pasting a YouTube link directly still works —
> only the search-by-title box will show an error.

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env     # points at your backend URL
npm run dev               # starts on http://localhost:5173
```

`client/.env` needs `VITE_SERVER_URL` (e.g. `http://localhost:5000` locally).

Open two browser windows (use one Incognito window) at `http://localhost:5173`
to test with multiple users.

## Deployment

Backend on **Render** (Web Service — supports WebSockets), frontend on
**Vercel** (Vite static build):

1. **MongoDB Atlas** → Network Access → allow `0.0.0.0/0` (Render's IPs aren't static)
2. **Render**: New → Web Service → root directory `server` → Build: `npm install`
   → Start: `npm start` → add env vars `MONGO_URI`, `YOUTUBE_API_KEY`, `CLIENT_URL`
3. **Vercel**: New Project → root directory `client` → add env var
   `VITE_SERVER_URL` = your Render URL → deploy
4. Go back to Render and set `CLIENT_URL` to your actual Vercel URL, then
   redeploy the backend (needed for CORS + Socket.IO to accept the frontend's origin)
5. Test with two browser tabs on the live URL, then paste it at the top of this README

## Architecture overview

- **Server is the single source of truth.** No client ever trusts another
  client directly — every playback action (play/pause/seek/change video)
  goes through the server, which validates the sender's role before
  applying and broadcasting the new state.
- **In-memory room state + MongoDB.** Fast-changing playback state
  (`currentTime`, `playState`) lives in memory per room (`rooms/Room.js`)
  and is _not_ written to the database every tick. Only durable data
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
- CORS is locked to a single exact `CLIENT_URL` — Vercel preview-deployment
  URLs (as opposed to the production domain) won't pass CORS unless added too.
