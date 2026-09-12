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

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    game: 'dogfight',
    arena: { width: ARENA_WIDTH, height: ARENA_HEIGHT },
    tickRate: TICK_RATE,
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
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] DOGFIGHT backend listening on http://localhost:${PORT}`);
  console.log(`[Server] Health check available at http://localhost:${PORT}/health`);
});
