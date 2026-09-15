import { PlayerColor } from './types.js';

export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 720;

export const TICK_RATE = 30;
export const TICK_INTERVAL_MS = Math.floor(1000 / TICK_RATE);

export const MAX_PLAYERS_PER_LOBBY = 4;
export const MIN_PLAYERS_TO_START = 2;

export const PLANE_BASE_SPEED = 150; // pixels per second (cruising speed)
export const PLANE_MAX_SPEED = 250; // pixels per second (maximum speed achieved via straight flight)
export const PLANE_ACCELERATION = 60; // px/s^2 linear flight acceleration rate
export const PLANE_TURN_DECELERATION = 80; // px/s^2 rate at which turning bleeds speed back down to base
export const PLANE_SPEED = PLANE_BASE_SPEED; // alias for backwards-compatibility
export const PLANE_ROTATION_SPEED = 3.2; // radians per second
export const PLANE_MOMENTUM_ALIGNMENT = 1.8; // rate (1/s) at which momentum vector realigns with heading (inertia / swing)
export const FIRE_COOLDOWN_MS = 330; // ms between shots
export const BULLET_SPEED = 520; // pixels per second
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

