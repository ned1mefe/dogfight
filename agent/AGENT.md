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

A web-based, 2D pixel art multiplayer airplane combat game, named dogfight. The game supports 2-4 players per lobby. Players can create public or private (password-protected) lobbies and invite friends via direct URLs. The gameplay is simplified for seamless network performance and accessibility: players control left/right rotation and manual firing, emphasizing timing and skill. There will be different airplane models, choosable by the player before match begins. For now, the planes will be identical in size, shape and speed.

## 2. Technology Stack

**Frontend:**
- **Bundler:** Vite
- **Game Engine:** Phaser 3 (Canvas/WebGL rendering)
- **UI Layer:** HTML5, CSS3, Tailwind CSS (Overlaid on top of the Phaser Canvas)
- **Language:** TypeScript

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
| `toggle-ready` | `ready: boolean` — sent when a player marks themselves ready or unready |
| `input-update` | `{ left: boolean, right: boolean, fire: boolean }` — sent whenever a key is pressed or released |

**Server -> Client:**

| Event | Description |
|---|---|
| `lobby-state-update` | broadcasts current players, colors, ready status |
| `game-started` | signals the client to hide HTML UI and start Phaser scene |
| `game-tick` | payload: array of player positions, rotations, active bullets, scores |
| `player-hit` / `player-destroyed` | triggers client-side particle effects/explosions |

## 6. Core Mechanics & Phaser 3 Implementation

- **Rendering:** `pixelArt: true` must be set in the Phaser config to ensure crisp scaling of low-res sprites.
- **Controls:** Left Arrow / Right Arrow (Rotation) and Spacebar (Fire).
- **Combat Mechanics:** Players shoot manually (e.g., via Spacebar). The server validates fire inputs and applies a brief cooldown (e.g., 200ms) to prevent spamming. Bullets travel until they reach the screen edge, at which point they are destroyed (bullets do not wrap).
- **Movement:** Planes have a constant forward velocity. Left/right inputs adjust the angular velocity.
- **Screen Boundaries (Wrapping):** Asteroids-style screen wrapping for planes only. When a plane exits one side of the screen, it seamlessly enters from the opposite side.
- **Respawn Mechanics:** Upon death, players face a brief respawn delay (e.g., 5 seconds). When respawning, the plane spawns at a random screen edge, instantly entering the arena with forward movement to keep the pacing fast and prevent spawn-camping.

## 7. Development Phases (Agent Tasks)

1. **Phase 1: Setup & Scaffolding** — Init Monorepo, setup Vite, Express, and shared types.
2. **Phase 2: Lobby Backend** — Implement Socket.io rooms, password hashing (if necessary), and state management.
3. **Phase 3: Lobby UI** — Build Tailwind interfaces, URL hash parsing, and wiring events.
4. **Phase 4: Game Engine Physics** — Implement server-side physics (movement, boundaries, bullet generation).
5. **Phase 5: Client Rendering** — Phaser sprite mapping, interpolation of server ticks, and particle effects.
