import './index.css';
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  ClientToServerEvents,
  ServerToClientEvents
} from '@dogfight/shared';

// Initialize Socket.io connection
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: true,
  transports: ['websocket', 'polling']
});

const statusEl = document.getElementById('connection-status');

socket.on('connect', () => {
  console.log(`[Client] Connected to server: ${socket.id}`);
  if (statusEl) {
    const idPrefix = socket.id ? socket.id.slice(0, 6) : 'online';
    statusEl.textContent = `Connected (Socket ID: ${idPrefix}...)`;
    statusEl.parentElement?.classList.remove('text-amber-400', 'text-red-400');
    statusEl.parentElement?.classList.add('text-emerald-400');
  }
});

socket.on('disconnect', () => {
  console.log('[Client] Disconnected from server');
  if (statusEl) {
    statusEl.textContent = 'Disconnected. Reconnecting...';
    statusEl.parentElement?.classList.remove('text-emerald-400');
    statusEl.parentElement?.classList.add('text-amber-400');
  }
});

socket.on('connect_error', (err) => {
  console.warn('[Client] Socket connection error:', err.message);
  if (statusEl) {
    statusEl.textContent = 'Server offline (dev mode)';
    statusEl.parentElement?.classList.remove('text-emerald-400');
    statusEl.parentElement?.classList.add('text-amber-400');
  }
});

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
