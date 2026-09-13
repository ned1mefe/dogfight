import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  TICK_RATE
} from '@dogfight/shared';
import { LobbyManager } from './lobby/LobbyManager.js';
import { registerLobbyHandlers } from './socket/lobbyHandlers.js';

export interface DogfightServerInstance {
  app: express.Express;
  server: http.Server;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  lobbyManager: LobbyManager;
}

export function createDogfightServer(): DogfightServerInstance {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const lobbyManager = new LobbyManager();

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      game: 'dogfight',
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
      tickRate: TICK_RATE,
      activeLobbies: lobbyManager.getActiveLobbiesCount(),
      uptime: process.uptime()
    });
  });

  const server = http.createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    registerLobbyHandlers(io, socket, lobbyManager);
  });

  return {
    app,
    server,
    io,
    lobbyManager
  };
}
