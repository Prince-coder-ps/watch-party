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
- Popup notifications — welcome-on-join, "you've been made a moderator",
  and a "you were removed" dialog for the affected user
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
│   ├── utils/youtube.js         # parses any YouTube URL format into a video ID
│   └── tests/                   # unit tests (permissions, youtube parsing, Room model)
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

## Testing

Server-side unit tests cover the pure logic that's safe to test without a
running DB or socket connection: the RBAC rules (`permissions.js`), the
YouTube URL/ID parser (`utils/youtube.js`), and the in-memory `Room` model
(playback sync, roles, the approval queue, host transfer, chat).

```bash
cd server
npm test        # node's built-in test runner, no extra deps needed
```

## Architecture overview

- **Server is the single source of truth.** No client ever trusts another
  client directly — every playback action (play/pause/seek/change video)
  goes through the server, which validates the sender's role before
  applying and broadcasting the new state.
- **In-memory room state + MongoDB.** Fast-changing playback state lives
  in memory per room; only durable data (room code, host, last video) is
  persisted to MongoDB, so a room survives a server restart.
- **Role-based access control**, an **approval-request flow** for
  Participants, and the **late-joiner sync** trick (deriving playback
  position from elapsed time instead of polling) round out the core design.

Full write-up — including the socket event catalog, the extrapolation
formula, and known trade-offs at scale — is in **[ARCHITECTURE.md](./ARCHITECTURE.md)**.
