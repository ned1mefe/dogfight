import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLANE_BASE_SPEED,
  PLANE_MAX_SPEED,
  PLANE_ACCELERATION,
  PLANE_TURN_DECELERATION,
  PLANE_SPEED,
  PLANE_ROTATION_SPEED,
  PLANE_MOMENTUM_ALIGNMENT,
  BULLET_SPEED,
  PLANE_COLLISION_RADIUS
} from '@dogfight/shared';

/**
 * Normalizes an angle in radians to the range [-Math.PI, Math.PI].
 */
export function normalizeAngle(angle: number): number {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Asteroids-style screen wrapping for planes.
 * Seamlessly wraps coordinates across the toroidal arena boundaries.
 */
export function wrapPosition(
  x: number,
  y: number,
  width = ARENA_WIDTH,
  height = ARENA_HEIGHT
): { x: number; y: number } {
  let wx = x;
  let wy = y;

  if (wx < 0) {
    wx += width;
  } else if (wx >= width) {
    wx -= width;
  }

  if (wy < 0) {
    wy += height;
  } else if (wy >= height) {
    wy -= height;
  }

  return { x: wx, y: wy };
}

/**
 * Checks if a point has left arena boundaries (used for bullet culling).
 */
export function isOutOfBounds(
  x: number,
  y: number,
  width = ARENA_WIDTH,
  height = ARENA_HEIGHT
): boolean {
  return x < 0 || x > width || y < 0 || y > height;
}

/**
 * Updates a plane's rotation and forward position given steering inputs, delta time.
 * Accelerates linearly during straight movement up to PLANE_MAX_SPEED,
 * bleeds speed back down to PLANE_BASE_SPEED when steering/turning,
 * and preserves momentum when turning (causing the plane to swing outwards into turns).
 */
export function updatePlaneKinematics(
  x: number,
  y: number,
  rotation: number,
  left: boolean,
  right: boolean,
  dt: number,
  vx?: number,
  vy?: number
): { x: number; y: number; rotation: number; vx: number; vy: number; speed: number } {
  let nextRotation = rotation;
  const isRotating = (left && !right) || (right && !left);

  // Steering: left turns counter-clockwise (-angle), right turns clockwise (+angle)
  if (left && !right) {
    nextRotation -= PLANE_ROTATION_SPEED * dt;
  } else if (right && !left) {
    nextRotation += PLANE_ROTATION_SPEED * dt;
  }
  nextRotation = normalizeAngle(nextRotation);

  // Current velocity vector (fallback to initial heading velocity if uninitialized)
  const curVx = vx ?? Math.cos(rotation) * PLANE_BASE_SPEED;
  const curVy = vy ?? Math.sin(rotation) * PLANE_BASE_SPEED;
  const curSpeed = Math.hypot(curVx, curVy) || PLANE_BASE_SPEED;

  // Dynamic speed adjustment:
  // - Linear flight: accelerate linearly up to PLANE_MAX_SPEED
  // - Turning/Rotating: bleed excess speed back down to PLANE_BASE_SPEED
  let nextSpeed: number;
  if (isRotating) {
    nextSpeed = Math.max(PLANE_BASE_SPEED, curSpeed - PLANE_TURN_DECELERATION * dt);
  } else {
    nextSpeed = Math.min(
      PLANE_MAX_SPEED,
      Math.max(PLANE_BASE_SPEED, curSpeed) + PLANE_ACCELERATION * dt
    );
  }

  // Target forward velocity vector along the newly steered nose heading
  const targetVx = Math.cos(nextRotation) * nextSpeed;
  const targetVy = Math.sin(nextRotation) * nextSpeed;

  // Momentum swing: exponential decay aligning velocity vector with new heading
  // During turns, existing momentum carries the plane forward along its previous trajectory
  const alignmentFactor = 1 - Math.exp(-PLANE_MOMENTUM_ALIGNMENT * dt);
  let nextVx = curVx + (targetVx - curVx) * alignmentFactor;
  let nextVy = curVy + (targetVy - curVy) * alignmentFactor;

  // Enforce velocity vector magnitude to match updated scalar flight speed
  const speedMag = Math.hypot(nextVx, nextVy);
  if (speedMag > 0) {
    nextVx = (nextVx / speedMag) * nextSpeed;
    nextVy = (nextVy / speedMag) * nextSpeed;
  }

  const nextX = x + nextVx * dt;
  const nextY = y + nextVy * dt;

  const wrapped = wrapPosition(nextX, nextY);

  return {
    x: wrapped.x,
    y: wrapped.y,
    rotation: nextRotation,
    vx: nextVx,
    vy: nextVy,
    speed: nextSpeed
  };
}

/**
 * Calculates initial spawn position and velocity vector for a newly fired bullet.
 * The bullet emerges from the plane's nose heading with combined vehicle and projectile speed.
 */
export function calculateBulletSpawn(
  planeX: number,
  planeY: number,
  rotation: number,
  offset = PLANE_COLLISION_RADIUS + 4,
  bulletMuzzleSpeed = BULLET_SPEED,
  planeVx?: number,
  planeVy?: number
): { x: number; y: number; vx: number; vy: number } {
  const bx = planeX + Math.cos(rotation) * offset;
  const by = planeY + Math.sin(rotation) * offset;

  // Forward muzzle velocity along nose heading
  const muzzleVx = Math.cos(rotation) * bulletMuzzleSpeed;
  const muzzleVy = Math.sin(rotation) * bulletMuzzleSpeed;

  // Inherit aircraft forward carrier velocity
  const carrierVx = planeVx ?? Math.cos(rotation) * PLANE_BASE_SPEED;
  const carrierVy = planeVy ?? Math.sin(rotation) * PLANE_BASE_SPEED;

  return {
    x: bx,
    y: by,
    vx: muzzleVx + carrierVx,
    vy: muzzleVy + carrierVy
  };
}

/**
 * Lightweight 2D circle-circle collision check using distance squared.
 */
export function checkCircleCollision(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distSq = dx * dx + dy * dy;
  const radiusSum = r1 + r2;
  return distSq <= radiusSum * radiusSum;
}

export type ArenaEdge = 'top' | 'right' | 'bottom' | 'left';

/**
 * Generates an inward-facing spawn position at a random arena edge with forward momentum.
 */
export function generateEdgeSpawn(
  width = ARENA_WIDTH,
  height = ARENA_HEIGHT,
  forcedEdge?: ArenaEdge
): { x: number; y: number; rotation: number; edge: ArenaEdge } {
  const edges: ArenaEdge[] = ['top', 'right', 'bottom', 'left'];
  const edge = forcedEdge || edges[Math.floor(Math.random() * edges.length)];
  const angleVariance = (Math.random() - 0.5) * 0.5; // ~ +/- 14 degrees variance

  let x = 0;
  let y = 0;
  let rotation = 0;

  switch (edge) {
    case 'top':
      x = 120 + Math.random() * (width - 240);
      y = 12;
      rotation = Math.PI / 2 + angleVariance; // Facing downwards (+Y)
      break;

    case 'bottom':
      x = 120 + Math.random() * (width - 240);
      y = height - 12;
      rotation = -Math.PI / 2 + angleVariance; // Facing upwards (-Y)
      break;

    case 'left':
      x = 12;
      y = 100 + Math.random() * (height - 200);
      rotation = 0 + angleVariance; // Facing right (+X)
      break;

    case 'right':
      x = width - 12;
      y = 100 + Math.random() * (height - 200);
      rotation = Math.PI + angleVariance; // Facing left (-X)
      break;
  }

  return {
    x,
    y,
    rotation: normalizeAngle(rotation),
    edge
  };
}
