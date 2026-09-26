// ---------------------------------------------------------------------------
// Single shared Socket.IO client instance, used across the whole app.
// ---------------------------------------------------------------------------
import { io } from 'socket.io-client';

// autoConnect is false - we connect manually once the user is ready to join
// a room (see pages/Room.jsx), instead of opening a socket on every page.
export const socket = io(import.meta.env.VITE_SERVER_URL, {
  autoConnect: false,
});
