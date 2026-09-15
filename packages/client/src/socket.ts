import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@dogfight/shared';

// Initialize strongly-typed Socket.io connection
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  transports: ['websocket', 'polling']
});
