# Agentic Development Blueprint: Pixel Art Airplane Combat Game, DOGFIGHT

## 0. Agent Operating Principles
 
These rules govern how the agent must work throughout every phase of this project, independent of the specific task at hand.
 
- **Ask if unclear.** If a requirement, spec detail, or design choice is ambiguous or missing, stop and ask a clarifying question rather than assuming.
- **Always plan before acting.** Do not write code or make changes until a plan has been laid out.
- **Create a step-by-step plan first.** Before starting any phase or task, break it down into explicit, ordered steps and present that plan.
- **Always wait for explicit approval before starting the next step.** After completing a step, stop and wait for confirmation before proceeding — do not chain multiple steps together without checking in.
- **Report progress clearly.** After each approved step, summarize what was done and what changed.
- **Flag risks and trade-offs.** If a step involves a decision with meaningful trade-offs (performance, security, complexity), surface it before proceeding rather than deciding silently.

## 1. Project Overview

A web-based, 2D pixel art multiplayer airplane combat game, named dogfight. The game supports 2-4 players per lobby. Players can create public or private (password-protected) lobbies and invite friends via direct URLs. The gameplay is simplified for seamless network performance and accessibility: players control left/right rotation and manual firing, emphasizing timing and skill.

**Key Visual & Selection Features:**
- **Unique Plane Selection:** There are 11 distinct pixel art airplane models located in `packages/client/assets/planes/` (`plane-1.png` through `plane-11.png`). In the lobby, each player selects their plane from what is left (not chosen by others). All players in a match have a unique plane model, and their choice remains fixed throughout the entire game (including across respawns). All planes remain identical in physics, size, and speed.
- **Multi-Layer Parallax Backgrounds:** The arena backgrounds consist of multi-layered, seamless/tileable textures located in `packages/client/assets/backgrounds/` (e.g. `Clouds 1` through `Clouds 8`). In Phaser 3, each layer is rendered using a `TileSprite`. The layers move independently from each other in an infinite loop at varying speeds to create a continuous depth illusion.

## 2. Technology Stack

**Frontend:**
- **Bundler:** Vite
- **Game Engine:** Phaser 3 (Canvas/WebGL rendering)
- **UI Layer:** HTML5, CSS3, Tailwind CSS (Overlaid on top of the Phaser Canvas)
- **Language:** TypeScript
- **Assets:** `packages/client/assets/` (11 plane models + multi-layer cloud background packs)

**Backend:**
- **Runtime:** Node.js
- **Framework:** Express.js (serving static files and handling basic routing)
- **WebSocket:** Socket.io (Real-time bidirectional communication)
- **Language:** TypeScript

**Containerization (Optional but Recommended):** Docker (For easy deployment of the monorepo)

## 3. Architecture & Directory Structure

The project will utilize a Monorepo approach to share TypeScript interfaces (e.g., Socket event payloads, Game State) between the client and server.

```text
/
├── packages/
│   ├── shared/          # Shared TS interfaces (PlayerState, LobbyState, Constants)
│   ├── client/          # Vite + Phaser + Tailwind project
│   │   └── assets/      # Game assets (planes 1-11, multi-layer cloud backgrounds)
│   └── server/          # Node.js + Socket.io project
├── docker-compose.yml
└── package.json         # Workspace configuration (npm/yarn/pnpm)
```

## 4. Lobby System & UI Flow

The UI is handled via the HTML DOM (Tailwind) rather than Phaser UI components for easier styling and responsiveness. The Phaser canvas remains hidden or paused in the background until the game starts.

### 4.1. Routing & URL Handling

**Hash Routing:** Used for direct invites.

- Example: `https://dogfight.com/#lobby=LOBY123`
- Upon loading, the client parses the hash. If a lobby ID is present, it prompts the user for a username (and password if required) and attempts to join directly.

### 4.2. Lobby States

- **Max Players:** 4
- **Minimum to Start:** 2
- **Readiness & Start Condition:** Players toggle their "Ready" status. The match starts automatically as soon as all connected players (minimum 2) are ready.
- **Colors:** Assigned automatically by the server upon joining (e.g., Red, Blue, Green, Yellow).
- **Plane Selection:** Players choose their plane model (`plane-1` through `plane-11`) from the available pool. Any plane selected by another player is disabled/claimed. Each player is guaranteed a unique plane that stays fixed throughout the match.

## 5. Network Protocol (Server-Authoritative)

To prevent cheating and ensure synchronization, the server is the single source of truth.

### 5.1. Game Loop & Tick Rate

- **Server Tick Rate:** ~30 updates per second (33ms interval).
- The server calculates plane positions, rotations, bullet trajectories, and collision detection.
- **Client Reconciliation (Optional for smoothness):** Clients interpolate between server states to render smooth movement despite network jitter.

### 5.2. Socket.io Event Map

**Client -> Server:**

| Event | Payload |
|---|---|
| `create-lobby` | `username`, `isPrivate`, `password` |
| `join-lobby` | `lobbyId`, `username`, `password` |
| `get-lobbies` | requests list of public lobbies |
| `select-plane` | `{ planeId: string }` — requests to select a specific plane model from remaining pool |
| `toggle-ready` | `ready: boolean` — sent when a player marks themselves ready or unready |
| `input-update` | `{ left: boolean, right: boolean, fire: boolean }` — sent whenever a key is pressed or released |

**Server -> Client:**

| Event | Description |
|---|---|
| `lobby-state-update` | broadcasts current players, colors, selected plane models, available planes pool, ready status |
| `game-started` | signals the client to hide HTML UI and start Phaser scene |
| `game-tick` | payload: array of player positions, rotations, plane models, active bullets, scores |
| `player-hit` / `player-destroyed` | triggers client-side particle effects/explosions |

## 6. Core Mechanics & Phaser 3 Implementation

- **Rendering:** `pixelArt: true` must be set in the Phaser config to ensure crisp scaling of low-res sprites.
- **Multi-Layer Parallax Backgrounds (`TileSprite`):**
  - Background layers are composed of seamless, tileable textures from `packages/client/assets/backgrounds/` (e.g. `Clouds 1` to `Clouds 8`).
  - Each individual layer is instantiated as a `Phaser.GameObjects.TileSprite` sized to cover the arena viewport.
  - In the scene update loop, the `tilePositionX` (and optionally `tilePositionY`) of each `TileSprite` layer is incremented at different speeds to create an infinite, continuous parallax scroll with depth illusion.
- **Player Plane Sprites:**
  - Loaded from `packages/client/assets/planes/` (`plane-1.png` through `plane-11.png`).
  - Rendered per player based on their verified, unique lobby selection, persisting across all respawns.
- **Controls:** Left Arrow / Right Arrow (Rotation) and Spacebar (Fire).
- **Combat Mechanics:** Players shoot manually (e.g., via Spacebar). The server validates fire inputs and applies a brief cooldown (e.g., 200ms) to prevent spamming. Bullets travel until they reach the screen edge, at which point they are destroyed (bullets do not wrap).
- **Movement:** Planes have a constant forward velocity. Left/right inputs adjust the angular velocity.
- **Screen Boundaries (Wrapping):** Asteroids-style screen wrapping for planes only. When a plane exits one side of the screen, it seamlessly enters from the opposite side.
- **Respawn Mechanics:** Upon death, players face a brief respawn delay (e.g., 5 seconds). When respawning, the plane spawns at a random screen edge, instantly entering the arena with forward movement to keep the pacing fast and prevent spawn-camping. The player retains their selected unique plane model.

## 7. Development Phases (Agent Tasks)

1. **Phase 1: Setup & Scaffolding** — Init Monorepo, setup Vite, Express, shared types, and containerization.
2. **Phase 2: Lobby Backend** — Implement Socket.io rooms, unique plane selection validation/pool management, password hashing (if necessary), and state management.
3. **Phase 3: Lobby UI** — Build Tailwind interfaces, URL hash parsing, interactive plane selection carousel/grid (reflecting taken vs available planes), and socket wiring.
4. **Phase 4: Game Engine Physics** — Implement server-side physics (movement, boundaries, bullet generation, collisions, respawns).
5. **Phase 5: Client Rendering** — Asset loading (`planes/`, `backgrounds/`), multi-layer `TileSprite` parallax background loop, unique plane sprite mapping, server tick interpolation, and particle effects.
