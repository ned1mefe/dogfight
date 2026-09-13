import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'node:net';
import assert from 'node:assert/strict';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GameStateTick,
  HitEventPayload,
  DestroyedEventPayload,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  PLANE_SPEED,
  RESPAWN_DELAY_SEC
} from '@dogfight/shared';
import { createDogfightServer } from '../src/server.js';

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(
  socket: TypedClientSocket,
  eventName: keyof ServerToClientEvents,
  timeoutMs = 4000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for event "${String(eventName)}" on socket ${socket.id}`));
    }, timeoutMs);

    socket.once(eventName as any, (data: any) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function createClient(port: number): Promise<TypedClientSocket> {
  return new Promise((resolve, reject) => {
    const socket: TypedClientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true
    });

    const timer = setTimeout(() => {
      reject(new Error('Timeout connecting socket client'));
    }, 4000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
  });
}

async function runGameEngineTests() {
  console.log('🚀 Starting DOGFIGHT Server Game Engine & Physics Verification Suite...\n');

  const { server, lobbyManager, gameManager } = createDogfightServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  const port = address.port;
  console.log(`✓ Test server running on http://localhost:${port}`);

  const activeClients: TypedClientSocket[] = [];

  try {
    // ------------------------------------------------------------------
    // Test 1: Lobby Setup, Auto-Start, and GameRoom Initialization
    // ------------------------------------------------------------------
    console.log('\n--- Test 1: Lobby Setup, Auto-Start & GameRoom Initialization ---');
    const client1 = await createClient(port);
    const client2 = await createClient(port);
    activeClients.push(client1, client2);

    // Host creates public lobby
    const lobbyCreatedPromise = waitForEvent(client1, 'lobby-state-update');
    client1.emit('create-lobby', { username: 'Maverick', isPrivate: false });
    const lobbyState1 = await lobbyCreatedPromise as any;
    const lobbyId = lobbyState1.id;
    console.log(`✓ Host Maverick created lobby [${lobbyId}]`);

    // Player 2 joins
    const client2JoinPromise = waitForEvent(client2, 'lobby-state-update');
    client2.emit('join-lobby', { lobbyId, username: 'Iceman' });
    await client2JoinPromise;
    console.log('✓ Player 2 Iceman joined lobby');

    // Both players toggle ready
    const startPromise1 = waitForEvent(client1, 'game-started');
    const startPromise2 = waitForEvent(client2, 'game-started');

    client1.emit('toggle-ready', { ready: true });
    client2.emit('toggle-ready', { ready: true });

    await Promise.all([startPromise1, startPromise2]);
    console.log('✓ Both players marked ready -> "game-started" received by all clients');

    // Verify GameRoom created in GameManager
    const gameRoom = gameManager.getGameRoom(lobbyId);
    assert.ok(gameRoom, 'GameRoom should exist in GameManager');
    assert.equal(gameRoom.isRunning, true, 'GameRoom simulation should be running');
    assert.equal(gameRoom.getPlayersCount(), 2, 'GameRoom should have 2 active players');
    console.log(`✓ 30 Hz GameRoom created and running for lobby [${lobbyId}]`);

    // ------------------------------------------------------------------
    // Test 2: Live Game State Broadcasts (game-tick)
    // ------------------------------------------------------------------
    console.log('\n--- Test 2: Live Game State Broadcasts (game-tick) ---');
    const firstTick = await waitForEvent<GameStateTick>(client1, 'game-tick');
    assert.ok(typeof firstTick.tick === 'number', 'Tick should have tick number');
    assert.equal(firstTick.players.length, 2, 'Tick should contain 2 players');
    assert.ok(Array.isArray(firstTick.bullets), 'Tick should contain bullets array');

    const p1 = firstTick.players.find((p) => p.id === client1.id);
    const p2 = firstTick.players.find((p) => p.id === client2.id);
    assert.ok(p1 && p2, 'Both players must be present in tick');
    assert.equal(p1.isAlive, true);
    assert.equal(p2.isAlive, true);
    assert.equal(p1.username, 'Maverick');
    assert.equal(p2.username, 'Iceman');
    console.log(`✓ Verified initial game-tick #${firstTick.tick} with 2 active players`);

    // ------------------------------------------------------------------
    // Test 3: Kinematics & Steering via input-update
    // ------------------------------------------------------------------
    console.log('\n--- Test 3: Kinematics & Steering via input-update ---');
    const initialRot = p1.rotation;

    // Send left turn input (counter-clockwise)
    client1.emit('input-update', { left: true, right: false, fire: false });

    // Wait 3 ticks (~100ms)
    await new Promise((resolve) => setTimeout(resolve, 120));

    let updatedTick = await waitForEvent<GameStateTick>(client1, 'game-tick');
    let updatedP1 = updatedTick.players.find((p) => p.id === client1.id)!;

    assert.ok(
      updatedP1.rotation < initialRot,
      `Rotation should decrease when turning left. initial: ${initialRot}, new: ${updatedP1.rotation}`
    );
    console.log(`✓ Maverick turned left: rotation adjusted from ${initialRot.toFixed(3)} to ${updatedP1.rotation.toFixed(3)}`);

    // Clear input
    client1.emit('input-update', { left: false, right: false, fire: false });

    // ------------------------------------------------------------------
    // Test 4: Weapon Firing, Rate-Limiting & Bullet Propagation
    // ------------------------------------------------------------------
    console.log('\n--- Test 4: Weapon Firing, Rate-Limiting & Bullet Propagation ---');
    client1.emit('input-update', { left: false, right: false, fire: true });

    // Wait for tick containing the bullet
    let bulletSeen = false;
    let bulletId = '';
    const startTime = Date.now();

    while (Date.now() - startTime < 2000 && !bulletSeen) {
      const tick = await waitForEvent<GameStateTick>(client1, 'game-tick');
      const bullet = tick.bullets.find((b) => b.ownerId === client1.id);
      if (bullet) {
        bulletSeen = true;
        bulletId = bullet.id;
        assert.ok(bullet.vx !== 0 || bullet.vy !== 0, 'Bullet must have velocity');
        console.log(`✓ Bullet spawned: ID ${bullet.id} at (${bullet.x.toFixed(1)}, ${bullet.y.toFixed(1)})`);
      }
    }
    assert.ok(bulletSeen, 'Bullet should be generated when fire input is active');

    // Clear fire input
    client1.emit('input-update', { left: false, right: false, fire: false });

    // ------------------------------------------------------------------
    // Test 5: Collision Detection, Damage, and Scoring
    // ------------------------------------------------------------------
    console.log('\n--- Test 5: Collision Detection, Damage, and Scoring ---');

    // Position Maverick right behind Iceman, facing directly east (rotation = 0)
    const intP1 = gameRoom.getPlayer(client1.id)!;
    const intP2 = gameRoom.getPlayer(client2.id)!;

    intP1.x = 200;
    intP1.y = 300;
    intP1.rotation = 0; // East
    intP1.input = { left: false, right: false, fire: false };
    intP1.lastFiredTime = 0;

    intP2.x = 250; // 50px directly in front of P1
    intP2.y = 300;
    intP2.rotation = 0;
    intP2.input = { left: false, right: false, fire: false };

    const hitPromise = waitForEvent<HitEventPayload>(client1, 'player-hit');
    const destroyedPromise = waitForEvent<DestroyedEventPayload>(client1, 'player-destroyed');

    // Fire!
    intP1.input.fire = true;
    // Step simulation directly to immediately simulate trajectory & hit
    gameRoom.step(1 / 30);
    intP1.input.fire = false;
    gameRoom.step(1 / 30);
    gameRoom.step(1 / 30);

    const hitEvent = await hitPromise;
    const destroyedEvent = await destroyedPromise;

    assert.equal(hitEvent.victimId, client2.id);
    assert.equal(hitEvent.attackerId, client1.id);
    assert.equal(destroyedEvent.victimId, client2.id);
    assert.equal(destroyedEvent.killerId, client1.id);
    assert.equal(destroyedEvent.scores[client1.id], 1, 'Maverick score should increment to 1');

    assert.equal(intP2.isAlive, false, 'Iceman should be destroyed');
    assert.ok(intP2.respawnTimer > 0, 'Iceman respawn timer should be active');
    console.log('✓ Hit & Destruction detected! Scores updated, Iceman is down');

    // ------------------------------------------------------------------
    // Test 6: Inward Edge Respawn System
    // ------------------------------------------------------------------
    console.log('\n--- Test 6: Inward Edge Respawn System ---');
    // Fast forward respawn timer to trigger respawn
    intP2.respawnTimer = 0.05;
    gameRoom.step(0.1);

    assert.equal(intP2.isAlive, true, 'Iceman should be revived');
    assert.equal(intP2.respawnTimer, 0, 'Respawn timer should be 0');
    assert.equal(intP2.planeId, 'plane-2', 'Unique planeId must be preserved across respawns');
    assert.equal(intP2.color, 'blue', 'Color must be preserved across respawns');

    // Verify Iceman is at one of the arena edges (accounting for forward motion during step dt)
    const isAtEdge =
      intP2.x <= 50 ||
      intP2.x >= ARENA_WIDTH - 50 ||
      intP2.y <= 50 ||
      intP2.y >= ARENA_HEIGHT - 50;
    assert.ok(isAtEdge, `Respawn position (${intP2.x}, ${intP2.y}) should be near arena edge`);
    console.log(`✓ Iceman respawned at arena edge (${intP2.x.toFixed(1)}, ${intP2.y.toFixed(1)}) retaining plane-2`);

    // ------------------------------------------------------------------
    // Test 7: Plane-to-Plane Ramming Mutual Destruction
    // ------------------------------------------------------------------
    console.log('\n--- Test 7: Plane-to-Plane Ramming Mutual Destruction ---');
    // Teleport both planes directly on top of each other
    intP1.x = 400;
    intP1.y = 400;
    intP1.isAlive = true;

    intP2.x = 405; // 5px distance, well within 2 * PLANE_COLLISION_RADIUS (32px)
    intP2.y = 400;
    intP2.isAlive = true;

    gameRoom.step(1 / 30);

    assert.equal(intP1.isAlive, false, 'Plane 1 should be destroyed by ramming');
    assert.equal(intP2.isAlive, false, 'Plane 2 should be destroyed by ramming');
    console.log('✓ Mid-air plane collision caused mutual destruction as configured');

    // ------------------------------------------------------------------
    // Test 8: Disconnect & Room Cleanup
    // ------------------------------------------------------------------
    console.log('\n--- Test 8: Disconnect & Room Cleanup ---');
    client1.disconnect();
    client2.disconnect();

    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(gameManager.getActiveGamesCount(), 0, 'All game rooms should be cleaned up');
    console.log('✓ All players disconnected -> GameRoom cleanly stopped and removed');

    console.log('\n🎉 ALL GAME ENGINE & PHYSICS VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    for (const client of activeClients) {
      if (client.connected) {
        client.disconnect();
      }
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runGameEngineTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Game Engine Verification Failed:', err);
    process.exit(1);
  });
