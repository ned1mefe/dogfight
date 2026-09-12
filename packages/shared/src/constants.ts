import { PlayerColor } from './types.js';

export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 720;

export const TICK_RATE = 30;
export const TICK_INTERVAL_MS = Math.floor(1000 / TICK_RATE);

export const MAX_PLAYERS_PER_LOBBY = 4;
export const MIN_PLAYERS_TO_START = 2;

export const PLANE_SPEED = 180; // pixels per second
export const PLANE_ROTATION_SPEED = 3.2; // radians per second
export const FIRE_COOLDOWN_MS = 200; // ms between shots
export const BULLET_SPEED = 480; // pixels per second
export const RESPAWN_DELAY_SEC = 5; // seconds

export const PLAYER_COLORS: readonly PlayerColor[] = ['red', 'blue', 'green', 'yellow'] as const;

export const PLANE_COLLISION_RADIUS = 16;
export const BULLET_COLLISION_RADIUS = 4;
