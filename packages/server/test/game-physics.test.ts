import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLANE_BASE_SPEED,
  PLANE_MAX_SPEED,
  PLANE_ACCELERATION,
  PLANE_TURN_DECELERATION,
  PLANE_SPEED,
  PLANE_ROTATION_SPEED,
  BULLET_SPEED,
  PLANE_COLLISION_RADIUS,
  BULLET_COLLISION_RADIUS
} from '@dogfight/shared';
import {
  normalizeAngle,
  wrapPosition,
  isOutOfBounds,
  updatePlaneKinematics,
  calculateBulletSpawn,
  checkCircleCollision,
  generateEdgeSpawn
} from '../src/game/GamePhysics.js';

console.log('🧪 Running GamePhysics Unit Tests...\n');

// 1. Angle Normalization
{
  assert.equal(normalizeAngle(0), 0);
  assert.equal(normalizeAngle(Math.PI), Math.PI);
  assert.ok(Math.abs(normalizeAngle(3 * Math.PI) - Math.PI) < 1e-6);
  assert.ok(Math.abs(normalizeAngle(-3 * Math.PI) - (-Math.PI)) < 1e-6);
  console.log('✓ normalizeAngle correctly constrains angles to [-PI, PI]');
}

// 2. Asteroids-style Screen Wrapping
{
  // Within bounds
  const normal = wrapPosition(500, 300);
  assert.equal(normal.x, 500);
  assert.equal(normal.y, 300);

  // Left wrap
  const leftWrap = wrapPosition(-5, 300);
  assert.equal(leftWrap.x, ARENA_WIDTH - 5);

  // Right wrap
  const rightWrap = wrapPosition(ARENA_WIDTH + 10, 300);
  assert.equal(rightWrap.x, 10);

  // Top wrap
  const topWrap = wrapPosition(500, -20);
  assert.equal(topWrap.y, ARENA_HEIGHT - 20);

  // Bottom wrap
  const bottomWrap = wrapPosition(500, ARENA_HEIGHT + 15);
  assert.equal(bottomWrap.y, 15);

  console.log('✓ wrapPosition correctly wraps toroidally across arena edges');
}

// 3. Out of Bounds Check (Bullets)
{
  assert.equal(isOutOfBounds(100, 100), false);
  assert.equal(isOutOfBounds(-1, 100), true);
  assert.equal(isOutOfBounds(ARENA_WIDTH + 1, 100), true);
  assert.equal(isOutOfBounds(100, -1), true);
  assert.equal(isOutOfBounds(100, ARENA_HEIGHT + 1), true);
  console.log('✓ isOutOfBounds correctly flags points outside arena');
}

// 4. Kinematics Update
{
  const dt = 1 / 30; // 1 frame
  // Moving straight east (rotation = 0) accelerates from base speed
  const straight = updatePlaneKinematics(100, 100, 0, false, false, dt);
  assert.equal(straight.rotation, 0);
  const expectedSpeed = Math.min(PLANE_MAX_SPEED, PLANE_BASE_SPEED + PLANE_ACCELERATION * dt);
  assert.ok(Math.abs(straight.speed - expectedSpeed) < 1e-4);
  assert.ok(Math.abs(straight.x - (100 + expectedSpeed * dt)) < 1e-4);
  assert.ok(Math.abs(straight.y - 100) < 1e-4);

  // Turning left (counter-clockwise, decreasing angle)
  const turningLeft = updatePlaneKinematics(100, 100, 0, true, false, dt);
  assert.ok(turningLeft.rotation < 0);
  assert.ok(Math.abs(turningLeft.rotation - (-PLANE_ROTATION_SPEED * dt)) < 1e-4);

  // Turning right (clockwise, increasing angle)
  const turningRight = updatePlaneKinematics(100, 100, 0, false, true, dt);
  assert.ok(turningRight.rotation > 0);
  assert.ok(Math.abs(turningRight.rotation - (PLANE_ROTATION_SPEED * dt)) < 1e-4);

  // Simultaneous left + right cancel each other out
  const canceled = updatePlaneKinematics(100, 100, 0, true, true, dt);
  assert.equal(canceled.rotation, 0);

  console.log('✓ updatePlaneKinematics accurately applies angular steering and forward velocity');
}

// 4b. Dynamic Acceleration and Deceleration Mechanics
{
  const dt = 1 / 30;
  let state = { x: 100, y: 100, rotation: 0, vx: PLANE_BASE_SPEED, vy: 0, speed: PLANE_BASE_SPEED };

  // 1. Sustained linear flight should increase speed up to PLANE_MAX_SPEED
  for (let i = 0; i < 90; i++) {
    state = updatePlaneKinematics(state.x, state.y, state.rotation, false, false, dt, state.vx, state.vy);
  }
  assert.equal(state.speed, PLANE_MAX_SPEED, 'Speed should reach PLANE_MAX_SPEED after sustained straight flight');
  assert.ok(state.speed <= PLANE_MAX_SPEED, 'Speed should never exceed PLANE_MAX_SPEED');

  // 2. Turning/Rotating should bleed speed back down to PLANE_BASE_SPEED
  for (let i = 0; i < 60; i++) {
    state = updatePlaneKinematics(state.x, state.y, state.rotation, true, false, dt, state.vx, state.vy);
  }
  assert.equal(state.speed, PLANE_BASE_SPEED, 'Speed should bleed back down to PLANE_BASE_SPEED when turning');
  assert.ok(state.speed >= PLANE_BASE_SPEED, 'Speed should never drop below PLANE_BASE_SPEED');

  console.log('✓ linear acceleration and turn deceleration correctly scale and clamp player speed');
}

// 4c. Momentum & Directional Swing
{
  const dt = 1 / 30;
  // Plane flying eastward with full momentum (rotation = 0, vx = PLANE_BASE_SPEED, vy = 0)
  const step = updatePlaneKinematics(100, 100, 0, true, false, dt, PLANE_BASE_SPEED, 0);

  assert.ok(step.rotation < 0, 'Nose rotated counter-clockwise');

  // Momentum swing: velocity vector lags behind instantaneous nose heading
  const instantaneousVx = Math.cos(step.rotation) * step.speed;
  const instantaneousVy = Math.sin(step.rotation) * step.speed;

  assert.ok(
    step.vx > instantaneousVx,
    `vx (${step.vx}) should maintain forward momentum relative to heading (${instantaneousVx})`
  );
  assert.ok(
    step.vy > instantaneousVy,
    `vy (${step.vy}) should lag behind lateral turn angle (${instantaneousVy})`
  );

  console.log('✓ updatePlaneKinematics smoothly swings with momentum when changing direction');
}

// 5. Bullet Spawning
{
  const planeX = 200;
  const planeY = 300;
  const rotation = 0; // East
  const bullet = calculateBulletSpawn(planeX, planeY, rotation);

  const expectedOffset = PLANE_COLLISION_RADIUS + 4;
  const expectedSpeed = PLANE_SPEED + BULLET_SPEED;

  assert.equal(bullet.x, planeX + expectedOffset);
  assert.equal(bullet.y, planeY);
  assert.equal(bullet.vx, expectedSpeed);
  assert.equal(bullet.vy, 0);

  console.log('✓ calculateBulletSpawn positions bullet forward from nose with composite velocity');
}

// 6. Circle Collision Math
{
  const rPlane = PLANE_COLLISION_RADIUS;
  const rBullet = BULLET_COLLISION_RADIUS;

  // Exact center hit
  assert.equal(checkCircleCollision(100, 100, rPlane, 100, 100, rBullet), true);

  // Just touching edge (dist = rPlane + rBullet = 20)
  assert.equal(checkCircleCollision(100, 100, rPlane, 120, 100, rBullet), true);

  // Just outside (dist = 21)
  assert.equal(checkCircleCollision(100, 100, rPlane, 121, 100, rBullet), false);

  console.log('✓ checkCircleCollision detects circle-circle intersection accurately');
}

// 7. Edge Spawns
{
  for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
    const spawn = generateEdgeSpawn(ARENA_WIDTH, ARENA_HEIGHT, edge);
    assert.ok(spawn.x >= 0 && spawn.x <= ARENA_WIDTH);
    assert.ok(spawn.y >= 0 && spawn.y <= ARENA_HEIGHT);

    if (edge === 'top') {
      // Facing roughly downwards (positive Y -> rotation ~ PI/2)
      assert.ok(Math.abs(spawn.rotation - Math.PI / 2) < 0.6);
    } else if (edge === 'bottom') {
      // Facing roughly upwards (negative Y -> rotation ~ -PI/2)
      assert.ok(Math.abs(spawn.rotation - (-Math.PI / 2)) < 0.6);
    } else if (edge === 'left') {
      // Facing roughly right (rotation ~ 0)
      assert.ok(Math.abs(spawn.rotation) < 0.6);
    } else if (edge === 'right') {
      // Facing roughly left (rotation ~ PI or -PI)
      assert.ok(Math.abs(Math.abs(spawn.rotation) - Math.PI) < 0.6);
    }
  }

  console.log('✓ generateEdgeSpawn reliably creates inward-facing spawn states at all arena edges');
}

console.log('\n🎉 All GamePhysics unit tests passed successfully!\n');
