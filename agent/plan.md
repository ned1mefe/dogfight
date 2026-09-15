# DOGFIGHT — Master Development Plan & Task Tracker

This document tracks the phased implementation of **DOGFIGHT**, derived from the architectural blueprint in [AGENT.md](file:///Users/nedimefe/src/dogfight/agent/AGENT.md).

---

## Progress Overview

| Phase | Description | Status |
| :--- | :--- | :--- |
| **Phase 1** | Setup & Scaffolding | **COMPLETED** (`100%`) |
| **Phase 2** | Lobby Backend | **COMPLETED** (`100%`) |
| **Phase 3** | Lobby UI & Frontend Integration | **COMPLETED** (`100%`) |
| **Phase 4** | Server-Authoritative Game Engine & Physics | **COMPLETED** (`100%`) |
| **Phase 5** | Client Rendering & Phaser Presentation | **READY TO START** (`0%`) |

---

## Phase 1: Setup & Scaffolding
> **Goal:** Establish monorepo structure, shared TypeScript contracts, backend and frontend scaffolding, and containerization.
> **Status:** [x] **COMPLETED**

- [x] **1.1 Workspace Root Configuration**
  - [x] Initialize npm workspaces (`packages/*`) in root `package.json`.
  - [x] Configure base TypeScript compiler settings in `tsconfig.base.json`.
  - [x] Configure `.gitignore` for Node, Vite, Docker, and build artifacts.
- [x] **1.2 Shared Contract Package (`@dogfight/shared`)**
  - [x] Configure `@dogfight/shared` with dual ESM export definitions (`dist/index.js`, `dist/index.d.ts`).
  - [x] Implement core types in `src/types.ts` (`PlayerState`, `BulletState`, `LobbyState`, `GameStateTick`).
  - [x] Implement strongly-typed Socket.io event interfaces in `src/events.ts` (`ClientToServerEvents`, `ServerToClientEvents`).
  - [x] Define global constants in `src/constants.ts` (1280x720 arena, 30 Hz tick rate, speeds, cooldowns, 2-4 player constraints).
- [x] **1.3 Backend Server Bootstrap (`@dogfight/server`)**
  - [x] Setup Express application with CORS and JSON body parser.
  - [x] Setup Socket.io server integrated with HTTP listener and shared types.
  - [x] Implement health check endpoint `GET /health` exposing arena size and tick rate.
- [x] **1.4 Frontend Client Bootstrap (`@dogfight/client`)**
  - [x] Setup Vite + TypeScript + Phaser 3.
  - [x] Configure Tailwind CSS (v4) with `@tailwindcss/vite`.
  - [x] Setup Phaser 3 canvas with `pixelArt: true`, `Phaser.Scale.FIT`, centered in 1280x720.
  - [x] Mount HTML UI overlay layer with retro fonts (`Press Start 2P`, `Space Grotesk`).
  - [x] Establish live Socket.io connection with connection status indicator in UI.
- [x] **1.5 Containerization & Network Gateway**
  - [x] Multi-stage `Dockerfile` for backend server.
  - [x] Multi-stage `Dockerfile` for frontend client with Nginx.
  - [x] Setup `docker-compose.yml` linking client (:5173 -> :80) and server (:3000).
  - [x] Configure `nginx.conf` reverse proxy routing `/socket.io/` (with WebSocket upgrade headers) and `/health` to backend container.
- [x] **1.6 Verification**
  - [x] `npm run build` passes across all packages.
  - [x] Server health endpoint verified via `curl`.
  - [x] Docker compose builds and WebSocket handshakes verified through Nginx proxy.

---

## Phase 2: Lobby Backend
> **Goal:** Implement in-memory lobby management, room isolation, password security, unique plane model pool allocation, ready-state logic, and socket lifecycle handling.
> **Status:** [x] **COMPLETED**

- [x] **2.1 In-Memory Lobby Store Architecture**
  - [x] Create `LobbyManager` class in `packages/server/src/lobby/LobbyManager.ts`.
  - [x] Implement data structures for active lobbies: `Map<string, Lobby>` and player-to-lobby index `Map<string, string>`.
  - [x] Define lobby entity state (players list, color assignment pool, plane selection pool, privacy flag, hashed password, game status).
- [x] **2.2 Lobby Creation & Room Generation**
  - [x] Implement short unique room code generator (6-character uppercase alphanumeric without ambiguous chars).
  - [x] Handle `create-lobby` socket event with nickname validation (trim, length 2–16).
  - [x] Implement password hashing (`node:crypto.scryptSync` + random salt) and timing-safe comparison for private lobbies.
  - [x] Assign creator the first available color (`red`) and first available plane model (`plane-1`).
  - [x] Add socket to Socket.io room `lobby:${lobbyId}`.
- [x] **2.3 Player Join, Color & Unique Plane Allocation**
  - [x] Handle `join-lobby` socket event.
  - [x] Validate lobby existence, game-not-started status, and max player capacity (`MAX_PLAYERS_PER_LOBBY = 4`).
  - [x] Validate password for private lobbies (timing-safe comparison).
  - [x] Allocate next available color from pool (`['red', 'blue', 'green', 'yellow']`).
  - [x] Allocate an initial available plane model from the remaining pool (`['plane-1', ..., 'plane-11']`).
  - [x] Broadcast updated `lobby-state-update` (players, colors, assigned planes, remaining available planes) to room.
- [x] **2.4 Unique Plane Selection Handling**
  - [x] Handle `select-plane` socket event (`{ planeId: PlaneId }`).
  - [x] Validate requested `planeId`: exists in supported pool (`plane-1` .. `plane-11`), is currently unclaimed by other players in the lobby, and lobby game is not started.
  - [x] Reclaim previously selected plane model back to the lobby's available pool.
  - [x] Assign new plane model to the player and lock it from other players.
  - [x] Broadcast updated `lobby-state-update` with latest plane assignments and remaining pool.
- [x] **2.5 Ready Check & Auto-Start Trigger**
  - [x] Handle `toggle-ready` socket event (`ready: boolean`).
  - [x] Update player's ready state and broadcast `lobby-state-update`.
  - [x] Evaluate start condition: total players >= `MIN_PLAYERS_TO_START` (2) AND 100% of connected players are marked `ready === true`.
  - [x] When condition met: mark lobby `isGameStarted = true`, lock plane selections permanently for the match, emit `game-started` event to room.
- [x] **2.6 Disconnection & Cleanup Lifecycle**
  - [x] Handle player graceful exit (`leave-lobby`) and socket disconnect (`disconnecting` / `disconnect`).
  - [x] Reclaim departed player's color and plane model back into the available pools.
  - [x] If game has not started, remove player, update remaining clients with `lobby-state-update`.
  - [x] If all players leave, destroy lobby and clean up all allocated memory.
  - [x] Reassign host to next player if creator leaves.
- [x] **2.7 Public Lobby Listing & Broadcasting**
  - [x] Handle `get-lobbies` socket request.
  - [x] Return sanitized `LobbySummary[]` (id, name, isPrivate, playerCount, maxPlayers) excluding passwords.
  - [x] Automatically broadcast updated lobby list to players currently in the lobby browser.
- [x] **2.8 Verification & Integration Tests**
  - [x] Created automated socket integration test script simulating 2–5 players creating, joining, selecting planes (verifying collision rejection when selecting an already claimed plane), toggling ready, and verifying auto-start event.
  - [x] All 10 verification scenarios passed with exit code 0.

---

## Phase 3: Lobby UI & Frontend Integration
> **Goal:** Build the complete Tailwind CSS lobby interface overlaid on top of Phaser, URL hash routing, interactive plane selector, and event wiring.
> **Status:** [x] **COMPLETED**

- [x] **3.1 UI State Machine & Container Layout**
  - [x] Defined frontend view states: `MENU`, `BROWSER`, `CREATE_MODAL`, `JOIN_MODAL`, `ROOM`, `HOW_TO_PLAY`, `IN_GAME`.
  - [x] Implemented reactive UI rendering controller in `packages/client/src/ui/UIManager.ts` and toast notifications in `toast.ts`.
- [x] **3.2 URL Hash Routing & Direct Invite Flow**
  - [x] Implemented hash parsing (`#lobby=CODE`) on load and dynamic `hashchange` listener.
  - [x] Direct invite join modal prompting for call-sign (and password if private).
  - [x] "Copy Room Link" button in room view writing URL to clipboard with retro toast alert.
- [x] **3.3 Main Menu & Streamlined Create Lobby Modal**
  - [x] Main menu buttons: "CREATE ROOM", "BROWSE ROOMS", "HOW TO PLAY & CONTROLS", plus direct 6-char room code input.
  - [x] Create room modal: Call-sign, room name, and optional password field that automatically makes the room private if filled (no checkbox required).
- [x] **3.4 Comprehensive Room Browser & Join Screen**
  - [x] Browse ALL unstarted rooms (public & private).
  - [x] Clear indicator badges: `🔒 PRIVATE` in amber and `🌐 PUBLIC` in emerald.
  - [x] Clicking "JOIN BATTLE" opens Join Arena modal with call-sign input; password input is conditionally rendered only when the room is private (omitted entirely for public rooms).
- [x] **3.5 Active Lobby Room View & Unique Plane Selector**
  - [x] Display room code, privacy badge, copy invite link button, and departure button.
  - [x] 4 player slots showing call-sign, host crown, assigned player color, plane model preview, and ready status.
  - [x] Interactive 11-plane selection grid (`packages/client/assets/planes/plane-1.png` .. `plane-11.png`): live availability badges, collision lockout, smooth swapping.
  - [x] Big "READY / UNREADY" toggle button, dynamic ready count banner.
- [x] **3.6 Transition into Game**
  - [x] Wire `game-started` socket event with toast notification and smooth UI overlay fade-out (`opacity-0 pointer-events-none`).
- [x] **3.7 Verification**
  - [x] Multi-package TypeScript build verified.
  - [x] Automated 10-step server lobby test suite passing.
  - [x] Live Vite dev server running on `http://localhost:5173/` and Express/Socket.io backend on `http://localhost:3000/`.

---

## Phase 4: Server-Authoritative Game Engine & Physics
> **Goal:** Implement the 30 Hz server simulation: plane kinematics, screen wrapping, bullet generation, and collision detection math.
> **Status:** [x] **COMPLETED**

- [x] **4.1 Game Room Loop Architecture**
  - [x] Create `GameRoom` class running at 30 Hz tick interval (~33.3ms) via high-resolution timer.
  - [x] Track simulation state: tick number, active planes (including their fixed `planeId`), active bullets, respawn queues.
- [x] **4.2 Plane Kinematics, Momentum Swing & Dynamic Flight Speed**
  - [x] Buffer and apply client `input-update` ({ left, right, fire }).
  - [x] Dynamic speed scaling: linear acceleration up to `PLANE_MAX_SPEED` (280 px/s) during straight flight, bleeding back down to `PLANE_BASE_SPEED` (180 px/s) when turning.
  - [x] Momentum swing: velocity vector smoothly swings through turns with centrifugal inertia lag (`PLANE_MOMENTUM_ALIGNMENT = 1.8`).
  - [x] Angular steering: counter-clockwise (left) and clockwise (right) with `PLANE_ROTATION_SPEED = 3.2`.
- [x] **4.3 Asteroids-style Screen Wrapping**
  - [x] Screen boundary logic: when plane center exceeds `ARENA_WIDTH` or `ARENA_HEIGHT`, wrap seamlessly:
    - `if (x < 0) x = ARENA_WIDTH; else if (x > ARENA_WIDTH) x = 0;`
    - `if (y < 0) y = ARENA_HEIGHT; else if (y > ARENA_HEIGHT) y = 0;`
- [x] **4.4 Weapon & Bullet Simulation**
  - [x] Process `fire` input with 200ms rate-limit cooldown per player.
  - [x] Bullet spawn at plane nose heading:  
    `bx = x + cos(rotation) * offset`, `by = y + sin(rotation) * offset`.
  - [x] Bullet velocity: `PLANE_SPEED + BULLET_SPEED` in forward heading direction.
  - [x] Bullet despawn: bullets do NOT wrap; destroyed immediately when leaving arena bounds.
- [x] **4.5 Collision Detection Math**
  - [x] Lightweight 2D circle-circle collision detection:
    - Distance squared check between bullets and enemy planes: `distSq < (PLANE_RADIUS + BULLET_RADIUS)^2`.
    - Ignore self-damage (bullets cannot hit owner).
  - [x] Mid-air plane collision handling with `PLANE_RAMMING_DESTRUCTION = true` default.
- [x] **4.6 Health, Scoring & Respawn System**
  - [x] On bullet hit: mark victim `isAlive = false`, increment shooter `score += 1`.
  - [x] Broadcast `player-hit` and `player-destroyed` events with coordinates and updated scores.
  - [x] Queue 5-second respawn timer.
  - [x] Respawn logic: pick random arena edge, facing inwards, instantly re-entering with forward momentum.
  - [x] Preserves the player's unique `planeId` across all respawns.
- [x] **4.7 Game State Broadcast**
  - [x] On each tick (33ms), construct `GameStateTick` and broadcast `game-tick` to room sockets.
  - [x] Multi-room coordinator `GameManager` integrated with `lobbyHandlers.ts` and `server.ts`.
- [x] **4.8 Verification**
  - [x] Unit test suite `test/game-physics.test.ts` verifying kinematics, wrapping, collisions, and spawns.
  - [x] Full integration simulation test suite `test/game-simulation.test.ts` verifying end-to-end socket events, steering, bullets, damage, scoring, respawns, ramming, and room lifecycle.

---

## Phase 5: Client Rendering & Phaser Presentation
> **Goal:** Render multi-layer TileSprite parallax backgrounds, unique pixel-art planes, interpolated 60fps visuals, particle effects, audio/SFX scaffolding, and HUD.
> **Status:** [x] **COMPLETED**

- [x] **5.1 Asset Pipeline & Texture Loading**
  - [x] Moved assets to Vite standard `packages/client/public/assets/`.
  - [x] Load 11 plane sprites (`plane-1.png` through `plane-11.png`) in `BootScene`.
  - [x] Load multi-layer seamless/tileable cloud background packs (`Clouds 1` through `Clouds 8`).
  - [x] Bullet sprites and procedurally generated particle textures (sparks, smoke puffs, debris, muzzle flashes, shockwaves).
  - [x] Configure crisp nearest-neighbor texture filtering (`pixelArt: true` & `FilterMode.NEAREST`).
- [x] **5.2 Multi-Layer Parallax Backgrounds with `TileSprite`**
  - [x] In `ArenaScene`, created stacked series of `Phaser.GameObjects.TileSprite` instances for 4 cloud layers matching `1280x720` dimensions.
  - [x] In scene `update()`, scrolled each layer independently at distinct differential speeds (`0.015x` to `0.18x`) with subtle vertical breathing drift for seamless infinite loop depth illusion.
- [x] **5.3 Phaser Scene Setup & Entity Management**
  - [x] Clean transition from `BootScene` to `ArenaScene`.
  - [x] Maintained sprite pools for planes and bullets mapped to entity IDs.
  - [x] Instantiated each player's plane using selected plane texture (`plane-1` through `plane-11`), overhead name tag, and player color badge.
- [x] **5.4 Input Handling**
  - [x] Capture Keyboard arrows (Left, Right), A / D, and Spacebar (Fire).
  - [x] Send `input-update` delta events on key state transitions to minimize network bandwidth.
- [x] **5.5 Interpolation & Client Reconciliation**
  - [x] Interpolate plane positions (`lerp`) and rotations (`slerp` / angle wrap) between server ticks for silky 60fps movement.
  - [x] Toroidal boundary-wrapping unwrapping logic eliminating visual snapping or reverse sliding across screen borders.
- [x] **5.6 Visual & Particle Effects**
  - [x] Engine smoke particle emitter trailing behind flying plane tails.
  - [x] Muzzle flash and spark bursts on bullet firing and hit impacts.
  - [x] Explosive particle bursts, debris scatter, smoke clouds, and shockwaves on plane destruction.
  - [x] Camera screen shake on nearby hits and destructions.
- [x] **5.7 In-Game HUD & Audio Scaffolding**
  - [x] Real-time leaderboard overlay (player names, plane avatars, live scores, airborne/down status).
  - [x] Respawn countdown overlay with dynamic countdown timer.
  - [x] Match leave button returning to lobby browser.
  - [x] Audio scaffolding (`SoundConfig.ts` & `SoundManager.ts`) with mute toggle.
- [x] **5.8 Polish & Automated Verification**
  - [x] Monorepo build passes cleanly (`npm run build`).
  - [x] Server physics, lobby, and simulation test suites pass 100% (`npm test`).
  - [x] Static asset delivery verified over HTTP (`200 OK`).
