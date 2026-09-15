import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  CreateLobbyPayload,
  JoinLobbyPayload,
  SelectPlanePayload,
  ToggleReadyPayload,
  PlayerInput
} from '@dogfight/shared';
import { LobbyManager } from '../lobby/LobbyManager.js';
import { GameManager } from '../game/GameManager.js';

export function getLobbyRoomName(lobbyId: string): string {
  return `lobby:${lobbyId.trim().toUpperCase()}`;
}

export function broadcastPublicLobbies(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  lobbyManager: LobbyManager
): void {
  io.emit('lobbies-list', lobbyManager.getPublicLobbies());
}

export function registerLobbyHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  lobbyManager: LobbyManager,
  gameManager: GameManager
): void {
  // 1. Create Lobby
  socket.on('create-lobby', async (payload: CreateLobbyPayload) => {
    try {
      const { lobby } = lobbyManager.createLobby(socket.id, payload);
      const roomName = getLobbyRoomName(lobby.id);

      await socket.join(roomName);

      // Emit to room (including creator)
      io.to(roomName).emit('lobby-state-update', lobby.toState());

      // Update lobby browser list for all clients
      broadcastPublicLobbies(io, lobbyManager);
    } catch (err: any) {
      socket.emit('error-message', {
        message: err.message || 'Failed to create lobby'
      });
    }
  });

  // 2. Join Lobby
  socket.on('join-lobby', async (payload: JoinLobbyPayload) => {
    try {
      const { lobby } = lobbyManager.joinLobby(socket.id, payload);
      const roomName = getLobbyRoomName(lobby.id);

      await socket.join(roomName);

      // Broadcast new state to room
      io.to(roomName).emit('lobby-state-update', lobby.toState());

      // Update lobby browser list
      broadcastPublicLobbies(io, lobbyManager);
    } catch (err: any) {
      socket.emit('error-message', {
        message: err.message || 'Failed to join lobby'
      });
    }
  });

  // 3. Leave Lobby
  socket.on('leave-lobby', async () => {
    try {
      const currentLobby = lobbyManager.getLobbyBySocketId(socket.id);
      if (!currentLobby) return;

      const roomName = getLobbyRoomName(currentLobby.id);
      await socket.leave(roomName);

      gameManager.handlePlayerLeave(socket.id);
      const result = lobbyManager.leaveLobby(socket.id);
      socket.emit('lobby-left');

      if (result.lobby && !result.destroyed) {
        io.to(roomName).emit('lobby-state-update', result.lobby.toState());
      }

      broadcastPublicLobbies(io, lobbyManager);
    } catch (err: any) {
      socket.emit('error-message', {
        message: err.message || 'Failed to leave lobby'
      });
    }
  });

  // 4. Select Plane Model
  socket.on('select-plane', (payload: SelectPlanePayload) => {
    try {
      const { lobby } = lobbyManager.selectPlane(socket.id, payload.planeId);
      const roomName = getLobbyRoomName(lobby.id);

      io.to(roomName).emit('lobby-state-update', lobby.toState());
    } catch (err: any) {
      socket.emit('error-message', {
        message: err.message || 'Failed to select plane'
      });
    }
  });

  // 5. Toggle Ready Status
  socket.on('toggle-ready', (payload: ToggleReadyPayload) => {
    try {
      const { lobby, canStart } = lobbyManager.toggleReady(socket.id, payload.ready);
      const roomName = getLobbyRoomName(lobby.id);

      io.to(roomName).emit('lobby-state-update', lobby.toState());

      // If all players ready (min 2), auto-start game
      if (canStart) {
        lobbyManager.startGame(lobby.id);
        const gameRoom = gameManager.startGame(lobby, io);
        io.to(roomName).emit('lobby-state-update', lobby.toState());
        io.to(roomName).emit('game-started', { lobbyId: lobby.id, mapId: lobby.mapId });

        // Lobby is no longer joinable in browser
        broadcastPublicLobbies(io, lobbyManager);
      }
    } catch (err: any) {
      socket.emit('error-message', {
        message: err.message || 'Failed to update ready state'
      });
    }
  });

  // 6. Input Updates (In-Game Controls)
  socket.on('input-update', (payload: PlayerInput) => {
    try {
      if (payload && typeof payload === 'object') {
        gameManager.handleInput(socket.id, payload);
      }
    } catch {
      // Ignore invalid input updates
    }
  });

  // 7. Get Public Lobbies List
  socket.on('get-lobbies', () => {
    socket.emit('lobbies-list', lobbyManager.getPublicLobbies());
  });

  // 8. Socket Disconnect
  socket.on('disconnecting', () => {
    try {
      gameManager.handlePlayerLeave(socket.id);
      const currentLobby = lobbyManager.getLobbyBySocketId(socket.id);
      if (currentLobby) {
        const roomName = getLobbyRoomName(currentLobby.id);
        const result = lobbyManager.leaveLobby(socket.id);

        if (result.lobby && !result.destroyed) {
          io.to(roomName).emit('lobby-state-update', result.lobby.toState());
        }

        broadcastPublicLobbies(io, lobbyManager);
      }
    } catch {
      // Ignore disconnect cleanup errors
    }
  });
}
