import { io } from 'socket.io-client';

// autoConnect false: room join karte waqt manually connect karenge
export const socket = io(import.meta.env.VITE_SERVER_URL, {
  autoConnect: false,
});