import Phaser from 'phaser';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  GameStateTick,
  HitEventPayload,
  DestroyedEventPayload,
  PlayerState,
  BulletState,
  PlayerInput,
  PlayerColor,
  PLANE_BASE_SPEED,
  PLANE_MAX_SPEED,
  PLANE_SIZE,
  PLANE_SIZE_SCALE
} from '@dogfight/shared';
import { soundManager } from '../audio/SoundManager.js';
import { socket } from '../../socket.js';

interface PlaneRenderEntity {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  nameText: Phaser.GameObjects.Text;
  emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  currentX: number;
  currentY: number;
  currentRotation: number;
  targetX: number;
  targetY: number;
  targetRotation: number;
  isAlive: boolean;
  planeId: string;
  speed: number;
}

interface BulletRenderEntity {
  sprite: Phaser.GameObjects.Sprite;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
}

export class ArenaScene extends Phaser.Scene {
  // Parallax background layers
  private bgLayers: Phaser.GameObjects.TileSprite[] = [];
  private bgSpeeds: number[] = [];
  private currentPackNumber: number | null = null;

  // Entities
  private planes: Map<string, PlaneRenderEntity> = new Map();
  private bullets: Map<string, BulletRenderEntity> = new Map();

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  private lastInput: PlayerInput = { left: false, right: false, fire: false };
  private onInputCallback: ((input: PlayerInput) => void) | null = null;

  // Active match info
  private isMatchActive: boolean = false;
  private localSocketId: string | null = null;

  constructor() {
    super('ArenaScene');
  }

  public setSocketId(id: string | null): void {
    this.localSocketId = id;
  }

  public setOnInputCallback(cb: (input: PlayerInput) => void): void {
    this.onInputCallback = cb;
  }

  public getCurrentPackNumber(): number | null {
    return this.currentPackNumber;
  }

  public setMatchActive(active: boolean): void {
    this.isMatchActive = active;
    if (this.input?.keyboard) {
      this.input.keyboard.enabled = active;
    }
    if (!active) {
      this.clearEntities();
    }
  }

  create(): void {
    // 1. Setup Multi-Layer Parallax Background with TileSprite
    this.createParallaxBackground(1);

    // 2. Setup Keyboard Inputs without swallowing HTML input typing
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false);
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false);
      // Clear captures so browser receives all regular keystrokes in HTML input fields
      this.input.keyboard.clearCaptures();
      this.input.keyboard.enabled = this.isMatchActive;
    }
  }

  /**
   * Build dynamic-layer stacked TileSprites for infinite parallax scrolling.
   */
  public createParallaxBackground(packNumber: number = 1): void {
    // Avoid rebuilding and resetting background position if already displaying this pack
    if (this.currentPackNumber === packNumber && this.bgLayers.length > 0) {
      return;
    }
    this.currentPackNumber = packNumber;

    // Clean up any existing layers
    for (const layer of this.bgLayers) {
      layer.destroy();
    }
    this.bgLayers = [];
    this.bgSpeeds = [];

    // Scale factors: textures are 576 x 324; arena is 1280 x 720
    const scaleX = ARENA_WIDTH / 576;
    const scaleY = ARENA_HEIGHT / 324;

    // Detect all available layers dynamically for this cloud pack
    let layerCount = 0;
    while (this.textures.exists(`bg-clouds-${packNumber}-${layerCount + 1}`)) {
      layerCount++;
    }

    if (layerCount === 0) {
      layerCount = 4;
    }

    for (let i = 1; i <= layerCount; i++) {
      const textureKey = `bg-clouds-${packNumber}-${i}`;
      if (this.textures.exists(textureKey)) {
        const tileSprite = this.add
          .tileSprite(0, 0, ARENA_WIDTH, ARENA_HEIGHT, textureKey)
          .setOrigin(0, 0)
          .setDepth(-20 + i);

        tileSprite.setTileScale(scaleX, scaleY);
        this.bgLayers.push(tileSprite);

        // Deepest backdrop layer (i = 1): exactly 0.0 speed (completely stationary)
        // Upper cloud layers (i > 1): gentle drift up to 0.010
        const progress = layerCount > 1 ? (i - 1) / (layerCount - 1) : 0;
        const speed = progress * 0.010;
        this.bgSpeeds.push(speed);
      }
    }
  }

  update(time: number, delta: number): void {
    // 1. Scroll Parallax Background layers
    for (let i = 0; i < this.bgLayers.length; i++) {
      const layer = this.bgLayers[i];
      const speed = this.bgSpeeds[i] ?? 0;
      if (speed > 0) {
        layer.tilePositionX += speed * delta;
      }
    }

    // 2. Process Player Controls & Emit Delta Inputs
    this.handlePlayerInput();

    // 3. Smooth Interpolation for Planes (with Toroidal boundary wrapping)
    this.interpolatePlanes(delta);

    // 4. Smooth Interpolation for Bullets
    this.interpolateBullets(delta);
  }

  private handlePlayerInput(): void {
    if (!this.isMatchActive || !this.cursors) return;

    // Do not process controls if user is currently typing in an HTML text field
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }

    const left = Boolean(this.cursors.left?.isDown || this.keyA?.isDown);
    const right = Boolean(this.cursors.right?.isDown || this.keyD?.isDown);
    const fire = Boolean(this.cursors.space?.isDown || this.keySpace?.isDown);

    // Check if input state transitioned
    const changed =
      left !== this.lastInput.left ||
      right !== this.lastInput.right ||
      fire !== this.lastInput.fire;

    if (changed) {
      this.lastInput = { left, right, fire };
      socket.emit('input-update', this.lastInput);
      if (this.onInputCallback) {
        this.onInputCallback(this.lastInput);
      }
      if (fire) {
        soundManager.playShoot();
      }
    }
  }

  private interpolatePlanes(delta: number): void {
    // Lerp rate tuned for smooth 60fps presentation from 30Hz server ticks
    const posLerp = Math.min(1, (delta / 1000) * 22);
    const rotLerp = Math.min(1, (delta / 1000) * 24);

    for (const [_, plane] of this.planes) {
      if (!plane.isAlive) continue;

      // Unwrapping toroidal delta for X
      let dx = plane.targetX - plane.currentX;
      if (dx > ARENA_WIDTH / 2) {
        plane.currentX += ARENA_WIDTH;
      } else if (dx < -ARENA_WIDTH / 2) {
        plane.currentX -= ARENA_WIDTH;
      }
      plane.currentX = Phaser.Math.Linear(plane.currentX, plane.targetX, posLerp);
      if (plane.currentX < 0) plane.currentX += ARENA_WIDTH;
      else if (plane.currentX >= ARENA_WIDTH) plane.currentX -= ARENA_WIDTH;

      // Unwrapping toroidal delta for Y
      let dy = plane.targetY - plane.currentY;
      if (dy > ARENA_HEIGHT / 2) {
        plane.currentY += ARENA_HEIGHT;
      } else if (dy < -ARENA_HEIGHT / 2) {
        plane.currentY -= ARENA_HEIGHT;
      }
      plane.currentY = Phaser.Math.Linear(plane.currentY, plane.targetY, posLerp);
      if (plane.currentY < 0) plane.currentY += ARENA_HEIGHT;
      else if (plane.currentY >= ARENA_HEIGHT) plane.currentY -= ARENA_HEIGHT;

      // Unwrapping shortest angle difference for Rotation
      const dRot = Phaser.Math.Angle.Wrap(plane.targetRotation - plane.currentRotation);
      plane.currentRotation += dRot * rotLerp;

      // Apply coordinates to display container
      plane.container.setPosition(plane.currentX, plane.currentY);
      // Plane art default faces UP; heading 0 faces RIGHT; offset by +PI/2
      plane.sprite.setRotation(plane.currentRotation + Math.PI / 2);

      // Tail contrail smoke position
      const tailDistance = 16 * PLANE_SIZE_SCALE;
      const tailX = plane.currentX - Math.cos(plane.currentRotation) * tailDistance;
      const tailY = plane.currentY - Math.sin(plane.currentRotation) * tailDistance;
      plane.emitter.setPosition(tailX, tailY);

      // Scale contrail density dynamically with flight speed
      const speedFactor = Math.max(
        0,
        Math.min(
          1,
          ((plane.speed ?? PLANE_BASE_SPEED) - PLANE_BASE_SPEED) /
            (PLANE_MAX_SPEED - PLANE_BASE_SPEED)
        )
      );
      plane.emitter.frequency = Math.round(Phaser.Math.Linear(35, 14, speedFactor));
    }
  }

  private interpolateBullets(delta: number): void {
    const lerpRate = Math.min(1, (delta / 1000) * 28);

    for (const [_, bullet] of this.bullets) {
      bullet.currentX = Phaser.Math.Linear(bullet.currentX, bullet.targetX, lerpRate);
      bullet.currentY = Phaser.Math.Linear(bullet.currentY, bullet.targetY, lerpRate);
      bullet.sprite.setPosition(bullet.currentX, bullet.currentY);
    }
  }

  /**
   * Handle server GameStateTick update (30 Hz).
   */
  public handleGameTick(tick: GameStateTick): void {
    // 1. Synchronize Players
    const currentTickPlayerIds = new Set<string>();

    for (const pState of tick.players) {
      currentTickPlayerIds.add(pState.id);
      let entity = this.planes.get(pState.id);

      if (!entity) {
        entity = this.createPlaneEntity(pState);
        this.planes.set(pState.id, entity);
      }

      // Check if texture changed
      if (entity.planeId !== pState.planeId) {
        entity.sprite.setTexture(pState.planeId);
        entity.planeId = pState.planeId;
      }

      // Update target transform & flight speed
      entity.targetX = pState.x;
      entity.targetY = pState.y;
      entity.targetRotation = pState.rotation;
      entity.speed = pState.speed ?? PLANE_BASE_SPEED;

      // If entity just spawned or respawned, snap directly to avoid dragging across screen
      if (!entity.isAlive && pState.isAlive) {
        entity.currentX = pState.x;
        entity.currentY = pState.y;
        entity.currentRotation = pState.rotation;
        entity.container.setPosition(pState.x, pState.y);
      }

      entity.isAlive = pState.isAlive;
      entity.container.setVisible(pState.isAlive);

      if (pState.isAlive) {
        entity.emitter.start();
      } else {
        entity.emitter.stop();
      }
    }

    // Clean up planes no longer in room
    for (const [id, entity] of this.planes) {
      if (!currentTickPlayerIds.has(id)) {
        entity.container.destroy();
        entity.emitter.destroy();
        this.planes.delete(id);
      }
    }

    // 2. Synchronize Bullets
    const currentTickBulletIds = new Set<string>();

    for (const bState of tick.bullets) {
      currentTickBulletIds.add(bState.id);
      let bEntity = this.bullets.get(bState.id);

      if (!bEntity) {
        bEntity = this.createBulletEntity(bState);
        this.bullets.set(bState.id, bEntity);
      }

      bEntity.targetX = bState.x;
      bEntity.targetY = bState.y;
    }

    // Despawn disappeared bullets
    for (const [bId, bEntity] of this.bullets) {
      if (!currentTickBulletIds.has(bId)) {
        bEntity.sprite.destroy();
        this.bullets.delete(bId);
      }
    }
  }

  private createPlaneEntity(pState: PlayerState): PlaneRenderEntity {
    const container = this.add.container(pState.x, pState.y);
    container.setDepth(10);

    // Plane Sprite
    const sprite = this.add.sprite(0, 0, pState.planeId);
    // Display size matching PLANE_SIZE
    sprite.setDisplaySize(PLANE_SIZE, PLANE_SIZE);
    sprite.setOrigin(0.5, 0.5);
    container.add(sprite);

    // Color theme helper
    const colorHex = this.getColorHex(pState.color);

    // Player Nickname Badge
    const isMe = pState.id === this.localSocketId;
    const nameText = this.add.text(
      0,
      -26 * PLANE_SIZE_SCALE,
      pState.username + (isMe ? ' (You)' : ''),
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: isMe ? '#60a5fa' : colorHex,
        stroke: '#020617',
        strokeThickness: 3
      }
    );
    nameText.setOrigin(0.5, 0.5);
    container.add(nameText);

    // Engine smoke particle emitter
    const emitter = this.add.particles(0, 0, 'particle-smoke', {
      lifespan: 380,
      speed: { min: 8, max: 24 },
      scale: { start: 0.5 * PLANE_SIZE_SCALE, end: 1.3 * PLANE_SIZE_SCALE },
      alpha: { start: 0.55, end: 0 },
      frequency: 35,
      blendMode: Phaser.BlendModes.NORMAL
    });
    emitter.setDepth(5);

    return {
      container,
      sprite,
      nameText,
      emitter,
      currentX: pState.x,
      currentY: pState.y,
      currentRotation: pState.rotation,
      targetX: pState.x,
      targetY: pState.y,
      targetRotation: pState.rotation,
      isAlive: pState.isAlive,
      planeId: pState.planeId,
      speed: pState.speed ?? PLANE_BASE_SPEED
    };
  }

  private createBulletEntity(bState: BulletState): BulletRenderEntity {
    const sprite = this.add.sprite(bState.x, bState.y, 'bullet-2');
    sprite.setDisplaySize(14, 12);
    sprite.setOrigin(0.5, 0.5);
    sprite.setDepth(8);

    // Orient bullet along velocity vector
    const angle = Math.atan2(bState.vy, bState.vx);
    sprite.setRotation(angle + Math.PI / 2);

    return {
      sprite,
      currentX: bState.x,
      currentY: bState.y,
      targetX: bState.x,
      targetY: bState.y
    };
  }

  /**
   * Visual VFX on bullet impact.
   */
  public handlePlayerHit(hit: HitEventPayload): void {
    soundManager.playHit();

    // Spark burst at hit point
    const sparkEmitter = this.add.particles(hit.x, hit.y, 'particle-spark', {
      lifespan: 250,
      speed: { min: 40, max: 120 },
      scale: { start: 1.2, end: 0 },
      quantity: 8,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    });
    sparkEmitter.explode(8);
    this.time.delayedCall(300, () => sparkEmitter.destroy());

    // Flash victim plane sprite
    const victim = this.planes.get(hit.victimId);
    if (victim) {
      victim.sprite.setTint(0xffffff);
      this.time.delayedCall(80, () => {
        if (victim.sprite.active) {
          victim.sprite.clearTint();
        }
      });
    }

    // Camera shake if local player is involved
    if (hit.victimId === this.localSocketId || hit.attackerId === this.localSocketId) {
      this.cameras.main.shake(120, 0.006);
    }
  }

  /**
   * Visual VFX on plane destruction.
   */
  public handlePlayerDestroyed(payload: DestroyedEventPayload): void {
    soundManager.playExplosion();

    const { x, y } = payload;

    // 1. Shockwave expanding ring
    const shockwave = this.add.sprite(x, y, 'particle-shockwave');
    shockwave.setScale(0.2);
    shockwave.setAlpha(1);
    shockwave.setDepth(20);

    this.tweens.add({
      targets: shockwave,
      scale: 2.2,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => shockwave.destroy()
    });

    // 2. Debris fragment burst
    const debrisEmitter = this.add.particles(x, y, 'particle-debris', {
      lifespan: 600,
      speed: { min: 80, max: 220 },
      scale: { start: 1.5, end: 0.2 },
      rotate: { start: 0, end: 360 },
      quantity: 18,
      emitting: false
    });
    debrisEmitter.setDepth(21);
    debrisEmitter.explode(18);
    this.time.delayedCall(700, () => debrisEmitter.destroy());

    // 3. Sparks & Fire
    const fireEmitter = this.add.particles(x, y, 'particle-spark', {
      lifespan: 450,
      speed: { min: 60, max: 180 },
      scale: { start: 1.8, end: 0 },
      quantity: 24,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    });
    fireEmitter.setDepth(22);
    fireEmitter.explode(24);
    this.time.delayedCall(500, () => fireEmitter.destroy());

    // 4. Large smoke puffs
    const smokeEmitter = this.add.particles(x, y, 'particle-smoke', {
      lifespan: 750,
      speed: { min: 20, max: 60 },
      scale: { start: 1, end: 2.5 },
      alpha: { start: 0.8, end: 0 },
      quantity: 10,
      emitting: false
    });
    smokeEmitter.setDepth(19);
    smokeEmitter.explode(10);
    this.time.delayedCall(800, () => smokeEmitter.destroy());

    // 5. Screen shake
    this.cameras.main.shake(280, 0.016);
  }

  private getColorHex(color: PlayerColor): string {
    switch (color) {
      case 'red':
        return '#f87171';
      case 'blue':
        return '#60a5fa';
      case 'green':
        return '#4ade80';
      case 'yellow':
        return '#facc15';
      default:
        return '#f8fafc';
    }
  }

  public clearEntities(): void {
    for (const [_, entity] of this.planes) {
      entity.container.destroy();
      entity.emitter.destroy();
    }
    this.planes.clear();

    for (const [_, bEntity] of this.bullets) {
      bEntity.sprite.destroy();
    }
    this.bullets.clear();
  }
}
