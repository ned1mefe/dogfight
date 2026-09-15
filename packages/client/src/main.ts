import './index.css';
import Phaser from 'phaser';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT
} from '@dogfight/shared';

import { socket } from './socket.js';
import { UIManager } from './ui/UIManager.js';
import { toast } from './ui/toast.js';
import { parseLobbyHash } from './ui/router.js';
import { BootScene } from './game/scenes/BootScene.js';
import { ArenaScene } from './game/scenes/ArenaScene.js';
import { InGameHUD } from './game/hud/InGameHUD.js';

// Re-export socket for backwards compatibility
export { socket };

// Initialize UI Manager
export const uiManager = new UIManager('ui-overlay');
uiManager.setSocket(socket);

// Setup Phaser Game Config
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
  scene: [BootScene, ArenaScene]
};

export const game = new Phaser.Game(config);

function getArenaScene(): ArenaScene | null {
  return (game.scene.getScene('ArenaScene') as ArenaScene) || null;
}

// Initialize In-Game HUD
export const inGameHUD = new InGameHUD('app', {
  onLeaveMatch: () => {
    socket.emit('leave-lobby');
    const arena = getArenaScene();
    if (arena) {
      arena.setMatchActive(false);
    }
    inGameHUD.hide();
    uiManager.clearLobby();
    uiManager.setView('BROWSER');
  }
});

// Socket Lifecycle & Event Wiring
socket.on('connect', () => {
  console.log(`[Client] Connected to server: ${socket.id}`);
  uiManager.setSocketStatus(true, socket.id ?? null);
  inGameHUD.setLocalPlayerId(socket.id ?? null);

  const arena = getArenaScene();
  if (arena) {
    arena.setSocketId(socket.id ?? null);
  }

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
  inGameHUD.setLocalPlayerId(null);
  const arena = getArenaScene();
  if (arena) {
    arena.setMatchActive(false);
  }
  inGameHUD.hide();
});

socket.on('connect_error', (err) => {
  console.warn('[Client] Socket connection error:', err.message);
  uiManager.setSocketStatus(false, null);
});

// Real-time Lobby Events
socket.on('lobby-state-update', (state) => {
  console.log('[Client] Received lobby state update:', state);
  uiManager.setLobbyState(state);
  const arena = getArenaScene();
  if (arena && state.mapId && arena.getCurrentPackNumber() !== state.mapId) {
    arena.createParallaxBackground(state.mapId);
  }
});

socket.on('lobbies-list', (lobbies) => {
  uiManager.setPublicLobbies(lobbies);
});

socket.on('lobby-left', () => {
  const arena = getArenaScene();
  if (arena) {
    arena.setMatchActive(false);
  }
  inGameHUD.hide();
  uiManager.clearLobby();
  toast.show('Departed from combat room', 'info');
});

socket.on('error-message', (err) => {
  toast.show(err.message, 'error');
});

// Real-time Gameplay Events
socket.on('game-started', (payload) => {
  toast.show('All pilots ready! Scrambling fighter wing...', 'success', 3500);
  uiManager.setView('IN_GAME');
  inGameHUD.show();

  const arena = getArenaScene();
  if (arena) {
    arena.setSocketId(socket.id ?? null);
    arena.setMatchActive(true);

    const mapId = payload.mapId || uiManager.state.currentLobby?.mapId || 1;
    arena.createParallaxBackground(mapId);
  }
});

// Expose helper for live UI preview of selected maps
(window as any).__arenaSceneHelper = {
  getArenaScene
};

socket.on('game-tick', (payload) => {
  const arena = getArenaScene();
  if (arena) {
    arena.handleGameTick(payload);
  }
  inGameHUD.updateState(payload.players);
});

socket.on('player-hit', (payload) => {
  const arena = getArenaScene();
  if (arena) {
    arena.handlePlayerHit(payload);
  }
});

socket.on('player-destroyed', (payload) => {
  const arena = getArenaScene();
  if (arena) {
    arena.handlePlayerDestroyed(payload);
  }
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
