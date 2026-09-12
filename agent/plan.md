# DOGFIGHT — Master Development Plan & Task Tracker

This document tracks the phased implementation of **DOGFIGHT**, derived from the architectural blueprint in [AGENT.md](file:///Users/nedimefe/src/dogfight/agent/AGENT.md).

---

## Progress Overview

| Phase | Description | Status |
| :--- | :--- | :--- |
| **Phase 1** | Setup & Scaffolding | **COMPLETED** (`100%`) |
| **Phase 2** | Lobby Backend | **READY TO START** (`0%`) |
| **Phase 3** | Lobby UI & Frontend Integration | **PENDING** (`0%`) |
| **Phase 4** | Server-Authoritative Game Engine & Physics | **PENDING** (`0%`) |
| **Phase 5** | Client Rendering & Phaser Presentation | **PENDING** (`0%`) |

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
> **Goal:** Implement in-memory lobby management, room isolation, password security, ready-state logic, and socket lifecycle handling.
> **Status:** [ ] **PENDING (Next Step)**

- [ ] **2.1 In-Memory Lobby Store Architecture**
  - [ ] Create `LobbyManager` class in `packages/server/src/lobby/LobbyManager.ts`.
  - [ ] Implement data structures for active lobbies: `Map<string, Lobby>` and player-to-lobby index `Map<string, string>`.
  - [ ] Define lobby entity state (players list, color assignment pool, privacy flag, hashed password, game status).
- [ ] **2.2 Lobby Creation & Room Generation**
  - [ ] Implement short unique room code generator (e.g. 6-character alphanumeric like `LOBY12`).
  - [ ] Handle `create-lobby` socket event with nickname validation (trim, length 2–16, profanity/empty guard).
  - [ ] Implement optional password hashing (using Node crypto `scrypt` or `bcrypt`) for private lobbies.
  - [ ] Assign creator the first available color (`red`) and add socket to Socket.io room `lobby:${lobbyId}`.
- [ ] **2.3 Player Join & Color Allocation**
  - [ ] Handle `join-lobby` socket event.
  - [ ] Validate lobby existence, game-not-started status, and max player capacity (`MAX_PLAYERS_PER_LOBBY = 4`).
  - [ ] Validate password for private lobbies (timing-safe comparison).
  - [ ] Allocate next available color from pool (`['red', 'blue', 'green', 'yellow']`).
  - [ ] Broadcast updated `lobby-state-update` to all clients in the room.
- [ ] **2.4 Ready Check & Auto-Start Trigger**
  - [ ] Handle `toggle-ready` socket event (`ready: boolean`).
  - [ ] Update player's ready state and broadcast `lobby-state-update`.
  - [ ] Evaluate start condition: total players >= `MIN_PLAYERS_TO_START` (2) AND 100% of connected players are marked `ready === true`.
  - [ ] When condition met: mark lobby `isGameStarted = true`, emit `game-started` event to room, and initialize game loop instance.
- [ ] **2.5 Disconnection & Cleanup Lifecycle**
  - [ ] Handle player graceful exit (`leave-lobby`) and socket disconnect (`disconnecting` / `disconnect`).
  - [ ] Reclaim departed player's color back into the pool.
  - [ ] If game has not started, remove player, update remaining clients with `lobby-state-update`.
  - [ ] If all players leave, destroy lobby and clean up all allocated timers/memory.
  - [ ] Handle in-game disconnects (mark plane dead/removed).
- [ ] **2.6 Public Lobby Listing & Broadcasting**
  - [ ] Handle `get-lobbies` socket request.
  - [ ] Return sanitized `LobbySummary[]` (id, name, isPrivate, playerCount, maxPlayers) excluding passwords.
  - [ ] Automatically broadcast updated lobby list to players currently in the lobby browser.
- [ ] **2.7 Verification & Integration Tests**
  - [ ] Create automated socket integration test script simulating 2–4 players creating, joining, toggling ready, and verifying auto-start event.

---

## Phase 3: Lobby UI & Frontend Integration
> **Goal:** Build the complete Tailwind CSS lobby interface overlaid on top of Phaser, URL hash routing, and event wiring.
> **Status:** [ ] **PENDING**

- [ ] **3.1 UI State Machine & Container Layout**
  - [ ] Define frontend view states: `MENU`, `BROWSER`, `CREATE_MODAL`, `JOIN_MODAL`, `ROOM`, `IN_GAME`.
  - [ ] Implement reactive UI rendering or lightweight component controller in `packages/client/src/ui/`.
- [ ] **3.2 URL Hash Routing & Direct Invite Flow**
  - [ ] Parse `window.location.hash` on page load (e.g. `/#lobby=ABC123`).
  - [ ] If hash present: prompt for nickname (and password modal if lobby is private) and immediately attempt `join-lobby`.
  - [ ] Provide a "Copy Invite Link" button in the active lobby that writes `https://.../#lobby=ID` to clipboard with toast notification.
- [ ] **3.3 Main Menu & Create Lobby Modal**
  - [ ] Main menu buttons: "Quick Play / Browse Lobbies", "Create Lobby", "How to Play".
  - [ ] Create Lobby modal: Nickname input, Public/Private toggle, Password input (conditional), Submit and Cancel buttons.
- [ ] **3.4 Lobby Browser Screen**
  - [ ] Tabular or card view of public lobbies with name, player count badge (`2/4`), and "Join" button.
  - [ ] Auto-refresh on lobby list broadcast + manual "Refresh" button.
- [ ] **3.5 Active Lobby Room View**
  - [ ] Display lobby ID, privacy badge, and shareable link.
  - [ ] Player slots (up to 4) displaying:
    - Assigned color plane icon/badge (`red`, `blue`, `green`, `yellow`).
    - Player nickname (with `(You)` badge).
    - Ready status badge (`READY` in green, `NOT READY` in amber).
  - [ ] Action buttons: Big "READY / UNREADY" toggle button, "Leave Lobby" button.
  - [ ] Status banner: e.g. *"Waiting for all players to ready up (2/2 ready)..."*
- [ ] **3.6 Transition into Game**
  - [ ] Listen for `game-started` socket event.
  - [ ] Smoothly fade out HTML UI overlay (`opacity-0 pointer-events-none`) and enable Phaser canvas input.
- [ ] **3.7 Verification**
  - [ ] Test multi-window lobby joining, ready toggle synchronization, and direct hash URL joins.

---

## Phase 4: Server-Authoritative Game Engine & Physics
> **Goal:** Implement the 30 Hz server simulation: plane kinematics, screen wrapping, bullet generation, and collision detection math.
> **Status:** [ ] **PENDING**

- [ ] **4.1 Game Room Loop Architecture**
  - [ ] Create `GameRoom` class running at 30 Hz tick interval (~33.3ms) via high-resolution timer.
  - [ ] Track simulation state: tick number, active planes, active bullets, respawn queues.
- [ ] **4.2 Plane Kinematics & Input Processing**
  - [ ] Buffer and apply client `input-update` ({ left, right, fire }).
  - [ ] Apply constant forward velocity:  
    `vx = cos(rotation) * PLANE_SPEED`, `vy = sin(rotation) * PLANE_SPEED`.
  - [ ] Apply angular rotation based on left/right input:  
    `rotation += angularVelocity * delta`.
- [ ] **4.3 Asteroids-style Screen Wrapping**
  - [ ] Screen boundary logic: when plane center exceeds `ARENA_WIDTH` or `ARENA_HEIGHT`, wrap seamlessly:
    - `if (x < 0) x = ARENA_WIDTH; else if (x > ARENA_WIDTH) x = 0;`
    - `if (y < 0) y = ARENA_HEIGHT; else if (y > ARENA_HEIGHT) y = 0;`
- [ ] **4.4 Weapon & Bullet Simulation**
  - [ ] Process `fire` input with 200ms rate-limit cooldown per player.
  - [ ] Bullet spawn at plane nose heading:  
    `bx = x + cos(rotation) * offset`, `by = y + sin(rotation) * offset`.
  - [ ] Bullet velocity: `PLANE_SPEED + BULLET_SPEED` in forward heading direction.
  - [ ] Bullet despawn: bullets do NOT wrap; destroyed immediately when leaving arena bounds.
- [ ] **4.5 Collision Detection Math**
  - [ ] Lightweight 2D circle-circle collision detection:
    - Distance squared check between bullets and enemy planes: `distSq < (PLANE_RADIUS + BULLET_RADIUS)^2`.
    - Ignore self-damage (bullets cannot hit owner).
  - [ ] Optional plane-to-plane mid-air collision handling.
- [ ] **4.6 Health, Scoring & Respawn System**
  - [ ] On bullet hit: mark victim `isAlive = false`, increment shooter `score += 1`.
  - [ ] Broadcast `player-hit` and `player-destroyed` events with coordinates and updated scores.
  - [ ] Queue 5-second respawn timer.
  - [ ] Respawn logic: pick random arena edge, facing inwards, instantly re-entering with forward momentum.
- [ ] **4.7 Game State Broadcast**
  - [ ] On each tick (33ms), construct `GameStateTick` and broadcast `game-tick` to room sockets.
- [ ] **4.8 Verification**
  - [ ] Headless simulation verification validating boundary wrapping, collision calculations, and scoring.

---

## Phase 5: Client Rendering & Phaser Presentation
> **Goal:** Render pixel-art planes, interpolate server ticks for smooth 60fps visuals, add particle effects, audio/SFX, and HUD.
> **Status:** [ ] **PENDING**

- [ ] **5.1 Pixel-Art Asset Creation & Pipeline**
  - [ ] Generate/create low-res pixel-art plane sprites for all 4 colors (`red`, `blue`, `green`, `yellow`).
  - [ ] Pixel bullet sprites, muzzle flashes, and explosion frames/particles.
  - [ ] Load textures with nearest-neighbor crisp filtering (`pixelArt: true`).
- [ ] **5.2 Phaser Scene Setup & Entity Management**
  - [ ] Transition from `BootScene` into `ArenaScene`.
  - [ ] Maintain sprite pools for planes and bullets mapped to entity IDs.
- [ ] **5.3 Input Handling**
  - [ ] Capture Keyboard arrows (Left, Right) and Spacebar (Fire).
  - [ ] Send `input-update` delta events on key state transitions to minimize bandwidth.
- [ ] **5.4 Interpolation & Client Reconciliation**
  - [ ] Interpolate plane positions (`lerp`) and rotations (`slerp` / angle delta) between server ticks for silky 60fps movement.
  - [ ] Handle seamless screen-wrapping interpolation without visual snapping across the screen.
- [ ] **5.5 Visual & Particle Effects**
  - [ ] Engine smoke/trail particle emitter behind flying planes.
  - [ ] Muzzle flash on bullet firing.
  - [ ] Explosions with particle burst on plane destruction.
  - [ ] Camera screen shake on nearby hits.
- [ ] **5.6 In-Game HUD**
  - [ ] Real-time leaderboard overlay in corner (player names, colors, kills/scores).
  - [ ] Respawn countdown overlay ("Respawning in 3... 2... 1...").
  - [ ] Match leave button / return to lobby.
- [ ] **5.7 Final Polish & Verification**
  - [ ] Full end-to-end multi-client playtesting in Docker.
  - [ ] Latency and responsiveness checks under simulated network jitter.
