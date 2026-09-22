import { Server } from 'socket.io';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  TICK_RATE,
  TICK_INTERVAL_MS,
  PLANE_BASE_SPEED,
  PLANE_SPEED,
  FIRE_COOLDOWN_MS,
  RESPAWN_DELAY_SEC,
  PLANE_COLLISION_RADIUS,
  BULLET_COLLISION_RADIUS,
  PLANE_RAMMING_DESTRUCTION,
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerState,
  BulletState,
  GameStateTick,
  PlayerInput
} from '@dogfight/shared';
import {
  updatePlaneKinematics,
  calculateBulletSpawn,
  checkCircleCollision,
  isOutOfBounds,
  generateEdgeSpawn
} from './GamePhysics.js';

export interface InternalPlayer extends PlayerState {
  input: PlayerInput;
  lastFiredTime: number;
  vx: number;
  vy: number;
  speed: number;
}

export class GameRoom {
  public readonly lobbyId: string;
  public readonly roomName: string;
  private readonly io: Server<ClientToServerEvents, ServerToClientEvents>;

  private players: Map<string, InternalPlayer> = new Map();
  private bullets: Map<string, BulletState> = new Map();

  private tickTimer: NodeJS.Timeout | null = null;
  private currentTick = 0;
  private lastTickTime = 0;
  public isRunning = false;
  private readonly settings: { resurrectTimeSec: number; killCap: number };
  private readonly onGameOver?: (winnerId: string) => void;

  constructor(
    lobbyId: string,
    initialPlayers: PlayerState[],
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    settings: { resurrectTimeSec: number; killCap: number },
    onGameOver?: (winnerId: string) => void
  ) {
    this.lobbyId = lobbyId;
    this.roomName = `lobby:${lobbyId.trim().toUpperCase()}`;
    this.io = io;
    this.settings = settings;
    this.onGameOver = onGameOver;

    for (const player of initialPlayers) {
      const speed = player.speed ?? PLANE_BASE_SPEED;
      const vx = player.vx ?? Math.cos(player.rotation) * speed;
      const vy = player.vy ?? Math.sin(player.rotation) * speed;
      this.players.set(player.id, {
        ...player,
        vx,
        vy,
        speed,
        input: { left: false, right: false, fire: false },
        lastFiredTime: 0
      });
    }
  }

  /**
   * Starts the 30 Hz physics loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickTime = performance.now();

    this.tickTimer = setInterval(() => {
      const now = performance.now();
      let dt = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;

      // Clamp delta time to avoid huge simulation jumps during network/CPU lag spikes
      dt = Math.min(Math.max(dt, 0.001), 0.1);

      this.step(dt);
    }, TICK_INTERVAL_MS);
  }

  /**
   * Stops the physics simulation loop and releases resources.
   */
  public stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.isRunning = false;
    this.bullets.clear();
  }

  /**
   * Buffers input update from a player socket.
   */
  public handleInput(socketId: string, input: PlayerInput): void {
    const player = this.players.get(socketId);
    if (!player) return;

    player.input = {
      left: Boolean(input.left),
      right: Boolean(input.right),
      fire: Boolean(input.fire)
    };
  }

  /**
   * Removes a player from the game simulation (e.g. disconnected).
   */
  public removePlayer(socketId: string): void {
    this.players.delete(socketId);

    // Clean up any bullets owned by the departed player
    for (const [bulletId, bullet] of this.bullets.entries()) {
      if (bullet.ownerId === socketId) {
        this.bullets.delete(bulletId);
      }
    }

    if (this.players.size === 0) {
      this.stop();
    }
  }

  /**
   * Performs one physics and game state step.
   * Can also be called directly with a custom delta time for deterministic testing.
   */
  public step(dt: number): void {
    const now = Date.now();

    // 1. Process Respawns
    for (const player of this.players.values()) {
      if (!player.isAlive) {
        player.respawnTimer = Math.max(0, player.respawnTimer - dt);

        if (player.respawnTimer === 0) {
          const spawn = generateEdgeSpawn();
          player.x = spawn.x;
          player.y = spawn.y;
          player.rotation = spawn.rotation;
          player.speed = PLANE_BASE_SPEED;
          player.vx = Math.cos(spawn.rotation) * PLANE_BASE_SPEED;
          player.vy = Math.sin(spawn.rotation) * PLANE_BASE_SPEED;
          player.isAlive = true;
        }
      }
    }

    // 2. Plane Kinematics & Steering (alive players only)
    for (const player of this.players.values()) {
      if (player.isAlive) {
        const next = updatePlaneKinematics(
          player.x,
          player.y,
          player.rotation,
          player.input.left,
          player.input.right,
          dt,
          player.vx,
          player.vy
        );

        player.x = next.x;
        player.y = next.y;
        player.rotation = next.rotation;
        player.vx = next.vx;
        player.vy = next.vy;
        player.speed = next.speed;
      }
    }

    // 3. Firing & Weapon Cooldowns
    for (const player of this.players.values()) {
      if (player.isAlive && player.input.fire) {
        if (now - player.lastFiredTime >= FIRE_COOLDOWN_MS) {
          player.lastFiredTime = now;

          const spawn = calculateBulletSpawn(
            player.x,
            player.y,
            player.rotation,
            undefined,
            undefined,
            player.vx,
            player.vy
          );
          const bulletId = `b_${player.id.slice(0, 4)}_${now}_${Math.random().toString(36).slice(2, 6)}`;

          const bullet: BulletState = {
            id: bulletId,
            ownerId: player.id,
            x: spawn.x,
            y: spawn.y,
            vx: spawn.vx,
            vy: spawn.vy,
            createdAt: now
          };

          this.bullets.set(bullet.id, bullet);
        }
      }
    }

    // 4. Bullet Movement & Boundary Culling
    for (const [bulletId, bullet] of this.bullets.entries()) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      if (isOutOfBounds(bullet.x, bullet.y)) {
        this.bullets.delete(bulletId);
      }
    }

    // 5. Collision Detection: Bullets vs Enemy Planes
    for (const [bulletId, bullet] of this.bullets.entries()) {
      for (const victim of this.players.values()) {
        if (!victim.isAlive) continue;
        if (bullet.ownerId === victim.id) continue; // Ignore friendly fire

        const hit = checkCircleCollision(
          bullet.x,
          bullet.y,
          BULLET_COLLISION_RADIUS,
          victim.x,
          victim.y,
          PLANE_COLLISION_RADIUS
        );

        if (hit) {
          // Victim destroyed
          victim.isAlive = false;
          victim.respawnTimer = this.settings.resurrectTimeSec;

          // Award score to shooter
          const shooter = this.players.get(bullet.ownerId);
          if (shooter) {
            shooter.score += 1;
            
            if (this.settings.killCap > 0 && shooter.score >= this.settings.killCap) {
              if (this.onGameOver) this.onGameOver(shooter.id);
              return;
            }
          }

          // Consume bullet
          this.bullets.delete(bulletId);

          // Broadcast hit & destruction events
          this.io.to(this.roomName).emit('player-hit', {
            victimId: victim.id,
            attackerId: bullet.ownerId,
            x: victim.x,
            y: victim.y
          });

          this.io.to(this.roomName).emit('player-destroyed', {
            victimId: victim.id,
            killerId: bullet.ownerId,
            x: victim.x,
            y: victim.y,
            scores: this.getScores()
          });

          break; // Bullet hit someone, do not check against other players
        }
      }
    }

    // 6. Collision Detection: Plane vs Plane Mid-Air Collisions
    if (PLANE_RAMMING_DESTRUCTION) {
      const alivePlayers = Array.from(this.players.values()).filter((p) => p.isAlive);

      for (let i = 0; i < alivePlayers.length; i++) {
        for (let j = i + 1; j < alivePlayers.length; j++) {
          const p1 = alivePlayers[i];
          const p2 = alivePlayers[j];

          if (!p1.isAlive || !p2.isAlive) continue;

          const collides = checkCircleCollision(
            p1.x,
            p1.y,
            PLANE_COLLISION_RADIUS,
            p2.x,
            p2.y,
            PLANE_COLLISION_RADIUS
          );

          if (collides) {
            // Mutual mid-air destruction
            p1.isAlive = false;
            p1.respawnTimer = this.settings.resurrectTimeSec;

            p2.isAlive = false;
            p2.respawnTimer = this.settings.resurrectTimeSec;

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            // Broadcast destruction for both players
            this.io.to(this.roomName).emit('player-destroyed', {
              victimId: p1.id,
              killerId: p2.id,
              x: midX,
              y: midY,
              scores: this.getScores()
            });

            this.io.to(this.roomName).emit('player-destroyed', {
              victimId: p2.id,
              killerId: p1.id,
              x: midX,
              y: midY,
              scores: this.getScores()
            });
          }
        }
      }
    }

    // 7. Broadcast Game State Tick
    const tickState: GameStateTick = {
      tick: this.currentTick++,
      players: Array.from(this.players.values()).map((p) => this.toPlayerState(p)),
      bullets: Array.from(this.bullets.values())
    };

    this.io.to(this.roomName).emit('game-tick', tickState);
  }

  /**
   * Sanitizes internal player representation to public PlayerState.
   */
  public toPlayerState(player: InternalPlayer): PlayerState {
    return {
      id: player.id,
      username: player.username,
      color: player.color,
      planeId: player.planeId,
      isHost: player.isHost,
      x: player.x,
      y: player.y,
      rotation: player.rotation,
      vx: player.vx,
      vy: player.vy,
      speed: Math.round(player.speed),
      isAlive: player.isAlive,
      respawnTimer: Math.round(player.respawnTimer * 10) / 10,
      score: player.score,
      ready: player.ready
    };
  }

  public getScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const player of this.players.values()) {
      scores[player.id] = player.score;
    }
    return scores;
  }

  public getPlayer(socketId: string): InternalPlayer | undefined {
    return this.players.get(socketId);
  }

  public getBulletsCount(): number {
    return this.bullets.size;
  }

  public getPlayersCount(): number {
    return this.players.size;
  }

  public getCurrentTick(): number {
    return this.currentTick;
  }
}
