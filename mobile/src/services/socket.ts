import { io, Socket } from 'socket.io-client';
import { SERVER_CONFIG } from '../config';

let socket: Socket | null = null;

export const getSocket = (customUrl?: string): Socket => {
  if (!socket) {
    const url = customUrl || SERVER_CONFIG.SOCKET_URL;
    socket = io(url, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
  }
  return socket;
};

export const updateSocketUrl = (newUrl: string): Socket => {
  if (socket) {
    socket.disconnect();
  }
  socket = io(newUrl, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });
  return socket;
};
