# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Dogfight: a multiplayer 2D pixel plane combat game (2–4 players per lobby). npm workspaces monorepo: `packages/shared`, `packages/server` (Express + Socket.io, authoritative), `packages/client` (Phaser 3 + Vite + Tailwind v4). No database; all state is in memory.

## Commands

Run from the repo root:

- `npm install` — install all workspaces
- `npm run dev` — builds `shared`, then runs server (`tsx watch`, :3000) and Vite client (:5173) concurrently
- `npm run build` — build all workspaces (client build runs `tsc && vite build`)
- `npm run build:shared` — **must be re-run after editing `packages/shared/src`**; server and client consume `@dogfight/shared` from its built `dist/`, not from source
- `npm test` — runs server tests (physics, lobby, game simulation) with `tsx` and `node:test`
- `npm run test:lobby` / `npm run test:game` — individual suites; `npm run test:physics --workspace=@dogfight/server` for physics. To run one file: `npx tsx packages/server/test/<file>.test.ts`
- `npm start` — run built server (`packages/server/dist/index.js`)

There is no linter configured. The root `Dockerfile` (used by `railway.json`) builds a single full-stack service; `docker-compose.yml` runs separate client (Nginx, :5173) and server containers.

## Architecture

**Shared contract (`packages/shared`)**: `types.ts` (state shapes), `events.ts` (typed `ClientToServerEvents` / `ServerToClientEvents` for Socket.io), `constants.ts` (arena 1280x720, 30 Hz tick, speeds, cooldowns, respawn/immunity timers, plane IDs). Gameplay tuning lives here, so changes affect both server simulation and client rendering.

**Server (`packages/server/src`)**:
- `socket/lobbyHandlers.ts` registers all socket events per connection and wires lobby → game transitions.
- `lobby/` (`LobbyManager`, `Lobby`): in-memory lobbies, unique plane/color allocation, ready-state, passwords, room settings; a match starts when all players (min 2) are ready.
- `game/GameManager.ts` maps lobby/socket → `GameRoom` and routes inputs. `GameRoom.ts` runs the 30 Hz server loop (movement, firing cooldown, bullets, collisions, respawn, immunity, kill cap) and broadcasts `game-tick`, `player-hit`, `player-destroyed`. `GamePhysics.ts` holds pure kinematics/collision helpers (unit-tested in `test/game-physics.test.ts`).
- The server is the single source of truth; clients only send `input-update` (`left/right/fire`).

**Client (`packages/client/src`)**:
- `main.ts` bootstraps the Phaser game and the DOM UI, and bridges socket events (e.g. `game-tick`) into the scene/HUD.
- Lobby/menu UI is plain DOM + Tailwind in `ui/UIManager.ts` (large file), with hash routing (`#lobby=<id>`) in `ui/router.ts` for invite links. Phaser canvas is only used during a match.
- `game/scenes/ArenaScene.ts` renders parallax `TileSprite` backgrounds and interpolates plane/bullet state between server ticks; `game/hud/InGameHUD.ts` and `game/audio/` handle HUD and sound.

## Docs

`docs/sockets-and-lobby-architecture.md` and `docs/nginx-in-dogfight.md` explain socket/lobby flow and the Nginx proxy (`/socket.io/` with WebSocket upgrade, `/health`). `agent/AGENT.md` and `agent/plan.md` are the original design blueprint/task tracker (plan status is partly stale).

## Conventions

Commits use Conventional Commits (`type(scope): description`), subject line only.
