import { io, Socket } from 'socket.io-client';

const URL =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : typeof window !== 'undefined'
    ? window.location.origin
    : '');

export const socket: Socket = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});
