import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'node:net';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  LobbyState,
  LobbySummary,
  ErrorPayload
} from '@dogfight/shared';
import { createDogfightServer } from '../src/server.js';

type TypedClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

function waitForEvent<T>(socket: TypedClientSocket, eventName: keyof ServerToClientEvents): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${String(eventName)}" on socket ${socket.id}`));
    }, 4000);

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

async function runLobbyTests() {
  console.log('🚀 Starting DOGFIGHT Lobby Backend Verification Suite...\n');

  // Boot server on random available OS port (port 0)
  const { server, lobbyManager } = createDogfightServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  const port = address.port;
  console.log(`✓ Test server running on http://localhost:${port}`);

  const activeClients: TypedClientSocket[] = [];

  try {
    // ----------------------------------------------------
    // Scenario 1: Host creates a private lobby
    // ----------------------------------------------------
    console.log('\n--- Test 1: Private Lobby Creation & Host Assignment ---');
    const hostSocket = await createClient(port);
    activeClients.push(hostSocket);

    const hostStatePromise = waitForEvent<LobbyState>(hostSocket, 'lobby-state-update');
    hostSocket.emit('create-lobby', {
      username: 'Maverick',
      lobbyName: 'Top Gun Match',
      isPrivate: true,
      password: 'ace123'
    });

    const state1 = await hostStatePromise;
    if (state1.id.length !== 6) throw new Error(`Expected 6-char room ID, got ${state1.id}`);
    if (state1.name !== 'Top Gun Match') throw new Error(`Expected lobby name 'Top Gun Match', got ${state1.name}`);
    if (!state1.isPrivate) throw new Error('Expected lobby to be private');
    if (state1.players.length !== 1) throw new Error('Expected exactly 1 player');

    const hostPlayer = state1.players[0];
    if (hostPlayer.username !== 'Maverick') throw new Error('Expected username Maverick');
    if (hostPlayer.color !== 'red') throw new Error(`Expected host color red, got ${hostPlayer.color}`);
    if (hostPlayer.planeId !== 'plane-1') throw new Error(`Expected host plane-1, got ${hostPlayer.planeId}`);
    if (!hostPlayer.isHost) throw new Error('Expected isHost === true');
    if (hostPlayer.ready) throw new Error('Expected host ready === false initially');
    if (state1.availablePlanes.includes('plane-1')) throw new Error('plane-1 should be removed from availablePlanes');
    if (state1.availablePlanes.length !== 10) throw new Error(`Expected 10 available planes, got ${state1.availablePlanes.length}`);

    const lobbyId = state1.id;
    console.log(`✓ Host created private lobby [${lobbyId}] with plane-1 and color red.`);

    // ----------------------------------------------------
    // Scenario 2: Password Authentication Guard
    // ----------------------------------------------------
    console.log('\n--- Test 2: Private Lobby Password Protection ---');
    const p2Socket = await createClient(port);
    activeClients.push(p2Socket);

    const errorPromise = waitForEvent<ErrorPayload>(p2Socket, 'error-message');
    p2Socket.emit('join-lobby', {
      lobbyId,
      username: 'Goose',
      password: 'wrongpassword'
    });

    const err2 = await errorPromise;
    if (!err2.message.toLowerCase().includes('password')) {
      throw new Error(`Expected password error, got: ${err2.message}`);
    }
    console.log(`✓ Incorrect password rejected with message: "${err2.message}"`);

    // ----------------------------------------------------
    // Scenario 3: Multiplayer Join & Unique Allocation
    // ----------------------------------------------------
    console.log('\n--- Test 3: Player Join & Unique Plane/Color Pool Allocation ---');
    const p2JoinPromise = waitForEvent<LobbyState>(p2Socket, 'lobby-state-update');
    const hostSeeJoinPromise = waitForEvent<LobbyState>(hostSocket, 'lobby-state-update');

    p2Socket.emit('join-lobby', {
      lobbyId,
      username: 'Goose',
      password: 'ace123'
    });

    const stateP2 = await p2JoinPromise;
    const stateHostSeeJoin = await hostSeeJoinPromise;

    if (stateP2.players.length !== 2 || stateHostSeeJoin.players.length !== 2) {
      throw new Error('Expected 2 players in lobby after join');
    }

    const goose = stateP2.players.find((p) => p.username === 'Goose')!;
    if (!goose) throw new Error('Goose not found in lobby players');
    if (goose.color !== 'blue') throw new Error(`Expected Goose color blue, got ${goose.color}`);
    if (goose.planeId !== 'plane-2') throw new Error(`Expected Goose plane-2, got ${goose.planeId}`);
    if (goose.isHost) throw new Error('Expected Goose isHost === false');
    if (stateP2.availablePlanes.includes('plane-2')) throw new Error('plane-2 should be removed from available pool');
    if (stateP2.availablePlanes.length !== 9) throw new Error(`Expected 9 available planes, got ${stateP2.availablePlanes.length}`);

    console.log('✓ Player 2 joined successfully with color blue and plane-2.');

    // ----------------------------------------------------
    // Scenario 4: Plane Selection Conflict Prevention
    // ----------------------------------------------------
    console.log('\n--- Test 4: Plane Selection Collision Prevention ---');
    const conflictPromise = waitForEvent<ErrorPayload>(p2Socket, 'error-message');
    p2Socket.emit('select-plane', { planeId: 'plane-1' }); // Host already has plane-1

    const errConflict = await conflictPromise;
    if (!errConflict.message.toLowerCase().includes('already claimed')) {
      throw new Error(`Expected already claimed error, got: ${errConflict.message}`);
    }
    console.log(`✓ Collision prevented: "${errConflict.message}"`);

    // ----------------------------------------------------
    // Scenario 5: Plane Selection Swap & Pool Recycling
    // ----------------------------------------------------
    console.log('\n--- Test 5: Plane Selection Swap & Pool Recycling ---');
    const swapPromiseHost = waitForEvent<LobbyState>(hostSocket, 'lobby-state-update');
    const swapPromiseP2 = waitForEvent<LobbyState>(p2Socket, 'lobby-state-update');

    p2Socket.emit('select-plane', { planeId: 'plane-6' });

    const stateSwap = await swapPromiseP2;
    await swapPromiseHost;

    const gooseUpdated = stateSwap.players.find((p) => p.username === 'Goose')!;
    if (gooseUpdated.planeId !== 'plane-6') {
      throw new Error(`Expected Goose to have plane-6, got ${gooseUpdated.planeId}`);
    }
    if (!stateSwap.availablePlanes.includes('plane-2')) {
      throw new Error('Old plane-2 should have been recycled back to availablePlanes');
    }
    if (stateSwap.availablePlanes.includes('plane-6')) {
      throw new Error('New plane-6 should no longer be in availablePlanes');
    }
    if (stateSwap.availablePlanes.length !== 9) {
      throw new Error(`Expected 9 available planes after swap, got ${stateSwap.availablePlanes.length}`);
    }
    console.log('✓ Goose swapped to plane-6; plane-2 recycled back to available pool.');

    // ----------------------------------------------------
    // Scenario 6: Lobby Capacity Enforcement (4 Players Max)
    // ----------------------------------------------------
    console.log('\n--- Test 6: Maximum Capacity Enforcement (4 Players) ---');
    const p3Socket = await createClient(port);
    const p4Socket = await createClient(port);
    const p5Socket = await createClient(port);
    activeClients.push(p3Socket, p4Socket, p5Socket);

    const p3JoinPromise = waitForEvent<LobbyState>(p3Socket, 'lobby-state-update');
    p3Socket.emit('join-lobby', { lobbyId, username: 'Iceman', password: 'ace123' });
    const state3 = await p3JoinPromise;
    const iceman = state3.players.find((p) => p.username === 'Iceman')!;
    if (iceman.color !== 'green') throw new Error(`Expected Iceman color green, got ${iceman.color}`);

    const p4JoinPromise = waitForEvent<LobbyState>(p4Socket, 'lobby-state-update');
    p4Socket.emit('join-lobby', { lobbyId, username: 'Viper', password: 'ace123' });
    const state4 = await p4JoinPromise;
    const viper = state4.players.find((p) => p.username === 'Viper')!;
    if (viper.color !== 'yellow') throw new Error(`Expected Viper color yellow, got ${viper.color}`);
    if (state4.players.length !== 4) throw new Error('Expected lobby to have exactly 4 players');

    // 5th player attempts to join
    const fullErrorPromise = waitForEvent<ErrorPayload>(p5Socket, 'error-message');
    p5Socket.emit('join-lobby', { lobbyId, username: 'Slider', password: 'ace123' });
    const errFull = await fullErrorPromise;
    if (!errFull.message.toLowerCase().includes('full')) {
      throw new Error(`Expected lobby full error, got: ${errFull.message}`);
    }
    console.log(`✓ 5th player rejected as expected: "${errFull.message}"`);

    // ----------------------------------------------------
    // Scenario 7: Ready Check & Auto-Start Trigger
    // ----------------------------------------------------
    console.log('\n--- Test 7: Ready Toggle & Match Auto-Start (100% Ready) ---');
    // Host marks ready
    const hostReadyPromise = waitForEvent<LobbyState>(hostSocket, 'lobby-state-update');
    hostSocket.emit('toggle-ready', { ready: true });
    const stateHostReady = await hostReadyPromise;
    if (!stateHostReady.players.find((p) => p.username === 'Maverick')!.ready) {
      throw new Error('Expected Maverick ready === true');
    }
    if (stateHostReady.isGameStarted) {
      throw new Error('Game should not start when only 1 player is ready');
    }

    // Players 2 and 3 mark ready
    const p2ReadyPromise = waitForEvent<LobbyState>(p2Socket, 'lobby-state-update');
    p2Socket.emit('toggle-ready', { ready: true });
    await p2ReadyPromise;

    const p3ReadyPromise = waitForEvent<LobbyState>(p3Socket, 'lobby-state-update');
    p3Socket.emit('toggle-ready', { ready: true });
    await p3ReadyPromise;

    // Player 4 marks ready -> Should trigger auto-start for all 4
    const startPromises = [
      waitForEvent<{ lobbyId: string }>(hostSocket, 'game-started'),
      waitForEvent<{ lobbyId: string }>(p2Socket, 'game-started'),
      waitForEvent<{ lobbyId: string }>(p3Socket, 'game-started'),
      waitForEvent<{ lobbyId: string }>(p4Socket, 'game-started')
    ];

    p4Socket.emit('toggle-ready', { ready: true });

    const results = await Promise.all(startPromises);
    for (const res of results) {
      if (res.lobbyId !== lobbyId) {
        throw new Error(`Expected started lobbyId ${lobbyId}, got ${res.lobbyId}`);
      }
    }
    console.log('✓ All 4 connected players marked ready; game-started event received by all!');

    // ----------------------------------------------------
    // Scenario 8: Locking In-Progress Match
    // ----------------------------------------------------
    console.log('\n--- Test 8: Lock Match During Gameplay ---');
    const lockPlanePromise = waitForEvent<ErrorPayload>(hostSocket, 'error-message');
    hostSocket.emit('select-plane', { planeId: 'plane-8' });
    const errLock = await lockPlanePromise;
    if (!errLock.message.toLowerCase().includes('locked')) {
      throw new Error(`Expected plane lock error, got: ${errLock.message}`);
    }

    const joinStartedPromise = waitForEvent<ErrorPayload>(p5Socket, 'error-message');
    p5Socket.emit('join-lobby', { lobbyId, username: 'LatePlayer', password: 'ace123' });
    const errStarted = await joinStartedPromise;
    if (!errStarted.message.toLowerCase().includes('already started')) {
      throw new Error(`Expected game already started error, got: ${errStarted.message}`);
    }
    console.log('✓ Match in progress correctly rejects plane changes and new joins.');

    // ----------------------------------------------------
    // Scenario 9: Graceful Disconnect & Memory Cleanup
    // ----------------------------------------------------
    console.log('\n--- Test 9: Player Disconnect & Empty Room Garbage Collection ---');
    p4Socket.disconnect();
    p3Socket.disconnect();
    p2Socket.disconnect();

    const leavePromise = waitForEvent<void>(hostSocket, 'lobby-left');
    hostSocket.emit('leave-lobby');
    await leavePromise;

    hostSocket.disconnect();
    p5Socket.disconnect();

    // Give server tick to run cleanup
    await new Promise((r) => setTimeout(r, 100));

    if (lobbyManager.getActiveLobbiesCount() !== 0) {
      throw new Error(`Expected 0 active lobbies after all left, got ${lobbyManager.getActiveLobbiesCount()}`);
    }
    console.log('✓ All players left; empty lobby successfully destroyed from memory.');

    // ----------------------------------------------------
    // Scenario 10: Public Lobby Listing
    // ----------------------------------------------------
    console.log('\n--- Test 10: Public Lobby Browser & Summary Sanitization ---');
    const pubHost = await createClient(port);
    activeClients.push(pubHost);

    const pubLobbyPromise = waitForEvent<LobbyState>(pubHost, 'lobby-state-update');
    pubHost.emit('create-lobby', {
      username: 'PublicAce',
      lobbyName: 'Public Dogfight Arena',
      isPrivate: false
    });
    const pubState = await pubLobbyPromise;

    const browserClient = await createClient(port);
    activeClients.push(browserClient);

    const listPromise = waitForEvent<LobbySummary[]>(browserClient, 'lobbies-list');
    browserClient.emit('get-lobbies');
    const lobbiesList = await listPromise;

    if (lobbiesList.length !== 1) {
      throw new Error(`Expected 1 public lobby, got ${lobbiesList.length}`);
    }
    const item = lobbiesList[0];
    if (item.id !== pubState.id) throw new Error('Expected matching lobby ID');
    if (item.isPrivate !== false) throw new Error('Expected isPrivate false');
    if ((item as any).password || (item as any).passwordHash) {
      throw new Error('Security flaw: password or hash leaked in lobby summary!');
    }
    console.log('✓ Public lobby browser returned sanitized summary list correctly.');

    pubHost.disconnect();
    browserClient.disconnect();

    console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! Phase 2 is fully verified.\n');
  } finally {
    // Cleanup clients
    for (const socket of activeClients) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runLobbyTests().catch((err) => {
  console.error('\n❌ Verification test failed with error:\n', err);
  process.exit(1);
});
