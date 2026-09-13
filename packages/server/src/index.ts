import { createDogfightServer } from './server.js';

const PORT = process.env.PORT || 3000;

export const { app, server, io, lobbyManager } = createDogfightServer();

server.listen(PORT, () => {
  console.log(`[Server] DOGFIGHT backend listening on http://localhost:${PORT}`);
  console.log(`[Server] Health check available at http://localhost:${PORT}/health`);
});

