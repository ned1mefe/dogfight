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

export const PLANE_IDS = [
  'plane-1',
  'plane-2',
  'plane-3',
  'plane-4',
  'plane-5',
  'plane-6',
  'plane-7',
  'plane-8',
  'plane-9',
  'plane-10',
  'plane-11'
] as const;

export const ROOM_ID_LENGTH = 6;
export const MIN_USERNAME_LENGTH = 2;
export const MAX_USERNAME_LENGTH = 16;
export const MAX_LOBBY_NAME_LENGTH = 32;
export const DEFAULT_LOBBY_NAME = 'Dogfight Arena';

export const PLANE_COLLISION_RADIUS = 16;
export const BULLET_COLLISION_RADIUS = 4;
export const PLANE_RAMMING_DESTRUCTION = true; // Mutual destruction on plane-to-plane collision

