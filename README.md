# Dogfight

A multiplayer 2D pixel plane war game built with Phaser 3, TypeScript, Express, and Socket.io in an npm workspaces monorepo.

---

## Prerequisites

- **Node.js**: `v20` or higher recommended (v18+ supported)
- **npm**: `v9` or higher

> **Note:** Docker is **NOT** strictly required! You can run everything directly using Node.js. No database or external services are needed.

---

## Quick Start (Without Docker - Recommended for Development)

### 1. Clone the repository
```bash
git clone <repository-url>
cd dogfight
```

### 2. Install dependencies
Run `npm install` in the project root. This installs dependencies across all workspaces (`shared`, `server`, and `client`):
```bash
npm install
```

### 3. Start the development environment
Run the root dev command:
```bash
npm run dev
```

This single command will:
1. Automatically build the `@dogfight/shared` package.
2. Launch the backend server with auto-reload at `http://localhost:3000`.
3. Launch the Vite client dev server at `http://localhost:5173`.

### 4. Open in browser
Navigate to [http://localhost:5173](http://localhost:5173) in your browser. Open multiple tabs or windows to test multiplayer dogfights!

---

## Alternative: Running Client and Server in Separate Terminals

If you prefer to run services in separate terminals:

**Terminal 1 (Backend Server):**
```bash
npm run build:shared
npm run dev:server
```

**Terminal 2 (Frontend Client):**
```bash
npm run dev:client
```

---

## Running with Docker (Optional)

If you have Docker installed and prefer containerized execution, you do not need to install local dependencies first:

```bash
# Build and start both client and server containers
docker compose up --build

# Stop the containers
docker compose down
```

- **Client:** [http://localhost:5173](http://localhost:5173) (served via Nginx)
- **Server:** [http://localhost:3000](http://localhost:3000)

---

## Useful Scripts

| Command | Description |
|---|---|
| `npm install` | Installs dependencies for all monorepo workspaces |
| `npm run dev` | Builds shared package and starts both client and server concurrently |
| `npm run dev:server` | Starts only the server with `tsx watch` |
| `npm run dev:client` | Starts only the client with Vite |
| `npm run build` | Builds all workspaces (`shared`, `server`, `client`) |
| `npm run build:shared`| Builds `@dogfight/shared` package |
| `npm run test:lobby` | Runs the lobby simulation tests |
| `npm run clean` | Cleans all `node_modules` and `dist` build folders |

---

## Project Structure

```text
dogfight/
├── packages/
│   ├── shared/   # Common types, packet definitions, and game constants
│   ├── server/   # Node.js + Express + Socket.io authoritative game server
│   └── client/   # Phaser 3 + Vite + Tailwind CSS frontend
├── docker-compose.yml
└── package.json
```
