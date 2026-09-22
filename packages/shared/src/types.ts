import { PLANE_IDS } from './constants.js';

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';
export type PlaneId = (typeof PLANE_IDS)[number];

export interface PlayerInput {
  left: boolean;
  right: boolean;
  fire: boolean;
}

export interface PlayerState {
  id: string;
  username: string;
  color: PlayerColor;
  planeId: PlaneId;
  isHost: boolean;
  x: number;
  y: number;
  rotation: number; // in radians
  vx?: number;
  vy?: number;
  speed?: number;
  isAlive: boolean;
  respawnTimer: number; // seconds remaining, 0 when alive
  score: number;
  ready: boolean;
}

export interface BulletState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  createdAt: number;
}

export interface LobbySummary {
  id: string;
  name: string;
  isPrivate: boolean;
  playerCount: number;
  maxPlayers: number;
}

export interface LobbyState {
  id: string;
  name: string;
  isPrivate: boolean;
  players: PlayerState[];
  availablePlanes: PlaneId[];
  isGameStarted: boolean;
  mapId?: number;
  settings: {
    resurrectTimeSec: number;
    killCap: number;
  };
}

export interface GameStateTick {
  tick: number;
  players: PlayerState[];
  bullets: BulletState[];
}

export interface HitEventPayload {
  victimId: string;
  attackerId: string;
  x: number;
  y: number;
}

export interface DestroyedEventPayload {
  victimId: string;
  killerId: string;
  x: number;
  y: number;
  scores: Record<string, number>;
}
