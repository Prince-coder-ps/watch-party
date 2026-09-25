import { io } from 'socket.io-client';

// One userId per browser. Stays the same across reconnects/refreshes.
export const socket = io(import.meta.env.VITE_SERVER_URL, {
  autoConnect: false,
});