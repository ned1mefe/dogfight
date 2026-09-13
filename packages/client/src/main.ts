import './index.css';
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  ClientToServerEvents,
  ServerToClientEvents
} from '@dogfight/shared';

import { UIManager } from './ui/UIManager.js';
import { toast } from './ui/toast.js';
import { parseLobbyHash } from './ui/router.js';

// Initialize Socket.io connection
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  transports: ['websocket', 'polling']
});

// Initialize UI Manager
export const uiManager = new UIManager('ui-overlay');
uiManager.setSocket(socket);

// Socket Lifecycle & Event Wiring
socket.on('connect', () => {
  console.log(`[Client] Connected to server: ${socket.id}`);
  uiManager.setSocketStatus(true, socket.id ?? null);

  // Request open public lobbies
  socket.emit('get-lobbies');

  // Check URL hash for direct room invite on connection
  const targetCode = parseLobbyHash();
  if (targetCode && !uiManager.state.currentLobby) {
    uiManager.promptJoinLobby(targetCode);
  }
});

socket.on('disconnect', () => {
  console.log('[Client] Disconnected from server');
  uiManager.setSocketStatus(false, null);
});

socket.on('connect_error', (err) => {
  console.warn('[Client] Socket connection error:', err.message);
  uiManager.setSocketStatus(false, null);
});

// Real-time Lobby Events
socket.on('lobby-state-update', (state) => {
  console.log('[Client] Received lobby state update:', state);
  uiManager.setLobbyState(state);
});

socket.on('lobbies-list', (lobbies) => {
  uiManager.setPublicLobbies(lobbies);
});

socket.on('lobby-left', () => {
  uiManager.clearLobby();
  toast.show('Departed from combat room', 'info');
});

socket.on('error-message', (err) => {
  toast.show(err.message, 'error');
});

socket.on('game-started', (payload) => {
  toast.show('All pilots ready! Scrambling fighter wing...', 'success', 3500);
  uiManager.setView('IN_GAME');
});

// Listen for direct URL hash changes while app is open
window.addEventListener('hashchange', () => {
  const targetCode = parseLobbyHash();
  if (targetCode && !uiManager.state.currentLobby) {
    uiManager.promptJoinLobby(targetCode);
  }
});

// Initial UI Render
uiManager.render();

// Setup Initial Phaser Scene
class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    // Draw subtle grid / starfield placeholder for the arena
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x1e293b, 0.4);

    const gridSize = 40;
    for (let x = 0; x <= ARENA_WIDTH; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, ARENA_HEIGHT);
    }
    for (let y = 0; y <= ARENA_HEIGHT; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(ARENA_WIDTH, y);
    }
    graphics.strokePath();

    // Arena border
    graphics.lineStyle(2, 0x3b82f6, 0.6);
    graphics.strokeRect(1, 1, ARENA_WIDTH - 2, ARENA_HEIGHT - 2);

    // Decorative center crosshair
    graphics.lineStyle(1, 0x3b82f6, 0.3);
    graphics.strokeCircle(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 60);
    graphics.strokeCircle(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 120);

    this.add.text(ARENA_WIDTH / 2, ARENA_HEIGHT - 30, 'ARENA DIMENSIONS: 1280 x 720', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#64748b'
    }).setOrigin(0.5);
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  pixelArt: true,
  backgroundColor: '#020617',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene]
};

export const game = new Phaser.Game(config);
