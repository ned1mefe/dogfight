import crypto from 'node:crypto';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  MAX_PLAYERS_PER_LOBBY,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
  PLANE_IDS,
  DEFAULT_LOBBY_NAME,
  MAX_LOBBY_NAME_LENGTH,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  LobbyState,
  LobbySummary,
  PlayerColor,
  PlaneId,
  PlayerState
} from '@dogfight/shared';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters, no 0/O or 1/I

export function generateRoomId(): string {
  const bytes = crypto.randomBytes(6);
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += ROOM_CODE_CHARS[bytes[i] % ROOM_CODE_CHARS.length];
  }
  return id;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const derived = crypto.scryptSync(password, salt, 32);
  const originalBuffer = Buffer.from(originalHash, 'hex');
  if (derived.length !== originalBuffer.length) return false;
  return crypto.timingSafeEqual(derived, originalBuffer);
}

// Predefined spawn positions for up to 4 players
const DEFAULT_SPAWNS: Array<{ x: number; y: number; rotation: number }> = [
  { x: 300, y: 220, rotation: 0 },
  { x: ARENA_WIDTH - 300, y: ARENA_HEIGHT - 220, rotation: Math.PI },
  { x: 300, y: ARENA_HEIGHT - 220, rotation: -Math.PI / 4 },
  { x: ARENA_WIDTH - 300, y: 220, rotation: (3 * Math.PI) / 4 }
];

export class Lobby {
  public readonly id: string;
  public name: string;
  public readonly isPrivate: boolean;
  private readonly passwordHash: string | null = null;
  public isGameStarted = false;
  public hostSocketId: string | null = null;
  public mapId: number = 1;
  public settings: {
    resurrectTimeSec: number;
    killCap: number;
  };

  private players: Map<string, PlayerState> = new Map();
  private availableColors: PlayerColor[] = [...PLAYER_COLORS];
  private availablePlanes: PlaneId[] = [...PLANE_IDS];

  constructor(options: {
    id?: string;
    name?: string;
    isPrivate: boolean;
    password?: string;
    mapId?: number;
    resurrectTimeSec?: number;
    killCap?: number;
  }) {
    this.id = options.id || generateRoomId();
    this.name = this.sanitizeLobbyName(options.name);
    this.isPrivate = options.isPrivate;
    this.mapId = options.mapId && options.mapId >= 1 && options.mapId <= 8 ? options.mapId : 1;
    this.settings = {
      resurrectTimeSec: options.resurrectTimeSec ?? 5,
      killCap: options.killCap ?? 0
    };

    if (this.isPrivate) {
      if (!options.password || options.password.trim().length === 0) {
        throw new Error('A password is required for private lobbies');
      }
      this.passwordHash = hashPassword(options.password.trim());
    }
  }

  private sanitizeLobbyName(name?: string): string {
    if (!name || name.trim().length === 0) {
      return DEFAULT_LOBBY_NAME;
    }
    return name.trim().slice(0, MAX_LOBBY_NAME_LENGTH);
  }

  public sanitizeUsername(username: string): string {
    const trimmed = username.trim();
    if (trimmed.length < MIN_USERNAME_LENGTH || trimmed.length > MAX_USERNAME_LENGTH) {
      throw new Error(`Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`);
    }
    return trimmed;
  }

  public verifyAccess(password?: string): boolean {
    if (!this.isPrivate) {
      return true;
    }
    if (!password || !this.passwordHash) {
      return false;
    }
    return verifyPassword(password.trim(), this.passwordHash);
  }

  public addPlayer(socketId: string, rawUsername: string, password?: string): PlayerState {
    if (this.isGameStarted) {
      throw new Error('Game has already started in this lobby');
    }

    if (this.players.size >= MAX_PLAYERS_PER_LOBBY) {
      throw new Error('Lobby is full (maximum 4 players)');
    }

    if (this.players.has(socketId)) {
      throw new Error('Player is already in this lobby');
    }

    if (!this.verifyAccess(password)) {
      throw new Error('Invalid lobby password');
    }

    const username = this.sanitizeUsername(rawUsername);

    // Pick first available color
    const color = this.availableColors.shift();
    if (!color) {
      throw new Error('No available colors remaining in lobby');
    }

    // Pick first available plane model
    const planeId = this.availablePlanes.shift();
    if (!planeId) {
      throw new Error('No available planes remaining in lobby');
    }

    const isHost = this.players.size === 0;
    if (isHost) {
      this.hostSocketId = socketId;
    }

    const spawnIndex = this.players.size % DEFAULT_SPAWNS.length;
    const spawn = DEFAULT_SPAWNS[spawnIndex];

    const player: PlayerState = {
      id: socketId,
      username,
      color,
      planeId,
      isHost,
      x: spawn.x,
      y: spawn.y,
      rotation: spawn.rotation,
      isAlive: true,
      respawnTimer: 0,
      score: 0,
      ready: false
    };

    this.players.set(socketId, player);
    return player;
  }

  public removePlayer(socketId: string): { removed: boolean; newHostSocketId: string | null } {
    const player = this.players.get(socketId);
    if (!player) {
      return { removed: false, newHostSocketId: this.hostSocketId };
    }

    // Reclaim color back to available pool
    if (!this.availableColors.includes(player.color)) {
      this.availableColors.push(player.color);
    }

    // Reclaim plane model if game hasn't started
    if (!this.isGameStarted && !this.availablePlanes.includes(player.planeId)) {
      this.availablePlanes.push(player.planeId);
      // Keep available planes in original index order
      this.availablePlanes.sort((a, b) => {
        const numA = parseInt(a.replace('plane-', ''), 10);
        const numB = parseInt(b.replace('plane-', ''), 10);
        return numA - numB;
      });
    }

    this.players.delete(socketId);

    // Reassign host if needed
    let newHost: string | null = null;
    if (this.hostSocketId === socketId) {
      if (this.players.size > 0) {
        const firstRemaining = this.players.values().next().value as PlayerState;
        firstRemaining.isHost = true;
        this.hostSocketId = firstRemaining.id;
        newHost = firstRemaining.id;
      } else {
        this.hostSocketId = null;
      }
    } else {
      newHost = this.hostSocketId;
    }

    return { removed: true, newHostSocketId: newHost };
  }

  public selectPlane(socketId: string, targetPlaneId: PlaneId): PlayerState {
    if (this.isGameStarted) {
      throw new Error('Plane selection is locked because the game has started');
    }

    const player = this.players.get(socketId);
    if (!player) {
      throw new Error('Player not found in this lobby');
    }

    if (player.planeId === targetPlaneId) {
      return player; // Already selected this plane
    }

    if (!PLANE_IDS.includes(targetPlaneId)) {
      throw new Error(`Invalid plane model: ${targetPlaneId}`);
    }

    const targetIndex = this.availablePlanes.indexOf(targetPlaneId);
    if (targetIndex === -1) {
      throw new Error(`Plane ${targetPlaneId} is already claimed by another player`);
    }

    // Return current plane to pool
    this.availablePlanes.push(player.planeId);

    // Claim new plane from pool
    this.availablePlanes.splice(targetIndex, 1);

    // Sort available planes
    this.availablePlanes.sort((a, b) => {
      const numA = parseInt(a.replace('plane-', ''), 10);
      const numB = parseInt(b.replace('plane-', ''), 10);
      return numA - numB;
    });

    player.planeId = targetPlaneId;
    return player;
  }

  public toggleReady(socketId: string, ready: boolean): { player: PlayerState; canStart: boolean } {
    if (this.isGameStarted) {
      throw new Error('Game has already started');
    }

    const player = this.players.get(socketId);
    if (!player) {
      throw new Error('Player not found in this lobby');
    }

    player.ready = ready;
    return {
      player,
      canStart: this.canStartGame()
    };
  }

  public canStartGame(): boolean {
    if (this.isGameStarted) return false;
    if (this.players.size < MIN_PLAYERS_TO_START) return false;
    return Array.from(this.players.values()).every((p) => p.ready);
  }

  public startGame(): void {
    if (!this.canStartGame()) {
      throw new Error(`Cannot start game: requires at least ${MIN_PLAYERS_TO_START} players and all must be ready`);
    }
    this.isGameStarted = true;
  }

  public endGame(): void {
    this.isGameStarted = false;
    for (const player of this.players.values()) {
      player.ready = false;
      player.score = 0;
      player.isAlive = true;
      player.respawnTimer = 0;
      player.immunityTimer = 0;
    }
  }

  public getPlayer(socketId: string): PlayerState | undefined {
    return this.players.get(socketId);
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public toState(): LobbyState {
    return {
      id: this.id,
      name: this.name,
      isPrivate: this.isPrivate,
      players: Array.from(this.players.values()),
      availablePlanes: [...this.availablePlanes],
      isGameStarted: this.isGameStarted,
      mapId: this.mapId,
      settings: this.settings
    };
  }

  public toSummary(): LobbySummary {
    return {
      id: this.id,
      name: this.name,
      isPrivate: this.isPrivate,
      playerCount: this.players.size,
      maxPlayers: MAX_PLAYERS_PER_LOBBY
    };
  }
}
