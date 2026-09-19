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
import { GameManager } from './game/GameManager.js';
import { registerLobbyHandlers } from './socket/lobbyHandlers.js';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DogfightServerInstance {
  app: express.Express;
  server: http.Server;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  lobbyManager: LobbyManager;
  gameManager: GameManager;
}

export function createDogfightServer(): DogfightServerInstance {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const lobbyManager = new LobbyManager();
  const gameManager = new GameManager();

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      game: 'dogfight',
      arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
      tickRate: TICK_RATE,
      activeLobbies: lobbyManager.getActiveLobbiesCount(),
      activeGames: gameManager.getActiveGamesCount(),
      uptime: process.uptime()
    });
  });

  // Serve static client assets if client/dist exists (unified single-service deployment)
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/health') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    registerLobbyHandlers(io, socket, lobbyManager, gameManager);
  });

  return {
    app,
    server,
    io,
    lobbyManager,
    gameManager
  };
}
