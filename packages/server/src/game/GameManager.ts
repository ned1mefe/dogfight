import { Server } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  PlayerInput
} from '@dogfight/shared';
import { Lobby } from '../lobby/Lobby.js';
import { GameRoom } from './GameRoom.js';

export class GameManager {
  private gameRooms: Map<string, GameRoom> = new Map();
  private playerRoomIndex: Map<string, string> = new Map(); // socketId -> lobbyId

  /**
   * Spins up a new GameRoom for an active lobby and begins the 30 Hz simulation.
   */
  public startGame(
    lobby: Lobby,
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    onGameOver?: (winnerId: string) => void
  ): GameRoom {
    const existing = this.gameRooms.get(lobby.id);
    if (existing) {
      existing.stop();
    }

    const room = new GameRoom(lobby.id, lobby.toState().players, io, lobby.settings, onGameOver);

    for (const player of lobby.toState().players) {
      this.playerRoomIndex.set(player.id, lobby.id);
    }

    this.gameRooms.set(lobby.id, room);
    room.start();

    return room;
  }

  /**
   * Routes incoming input packet from a player socket directly to their active GameRoom.
   */
  public handleInput(socketId: string, input: PlayerInput): void {
    const lobbyId = this.playerRoomIndex.get(socketId);
    if (!lobbyId) return;

    const room = this.gameRooms.get(lobbyId);
    if (!room) return;

    room.handleInput(socketId, input);
  }

  /**
   * Handles player departure or socket disconnection during an active match.
   */
  public handlePlayerLeave(socketId: string): void {
    const lobbyId = this.playerRoomIndex.get(socketId);
    if (!lobbyId) return;

    this.playerRoomIndex.delete(socketId);

    const room = this.gameRooms.get(lobbyId);
    if (!room) return;

    room.removePlayer(socketId);

    if (room.getPlayersCount() === 0) {
      room.stop();
      this.gameRooms.delete(lobbyId);
    }
  }

  /**
   * Stops and cleans up a game room by lobby ID.
   */
  public stopGame(lobbyId: string): void {
    const room = this.gameRooms.get(lobbyId);
    if (room) {
      room.stop();
      this.gameRooms.delete(lobbyId);
    }

    for (const [socketId, rId] of this.playerRoomIndex.entries()) {
      if (rId === lobbyId) {
        this.playerRoomIndex.delete(socketId);
      }
    }
  }

  public getGameRoom(lobbyId: string): GameRoom | undefined {
    return this.gameRooms.get(lobbyId);
  }

  public getGameRoomBySocketId(socketId: string): GameRoom | undefined {
    const lobbyId = this.playerRoomIndex.get(socketId);
    if (!lobbyId) return undefined;
    return this.gameRooms.get(lobbyId);
  }

  public getActiveGamesCount(): number {
    return this.gameRooms.size;
  }
}
