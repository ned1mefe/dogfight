import {
  CreateLobbyPayload,
  JoinLobbyPayload,
  LobbySummary,
  PlaneId,
  PlayerState
} from '@dogfight/shared';
import { generateRoomId, Lobby } from './Lobby.js';

export interface LeaveLobbyResult {
  lobby: Lobby | null;
  removed: boolean;
  destroyed: boolean;
  newHostSocketId: string | null;
}

export class LobbyManager {
  private lobbies: Map<string, Lobby> = new Map();
  private playerLobbyIndex: Map<string, string> = new Map(); // socketId (of player) -> lobbyId

  public createLobby(
    socketId: string,
    payload: CreateLobbyPayload
  ): { lobby: Lobby; player: PlayerState } {
    // If the socket was already in another lobby, leave it first
    if (this.playerLobbyIndex.has(socketId)) {
      this.leaveLobby(socketId);
    }

    // Generate collision-free room ID
    let roomId = generateRoomId();
    let attempts = 0;
    while (this.lobbies.has(roomId) && attempts < 10) {
      roomId = generateRoomId();
      attempts++;
    }

    const lobby = new Lobby({
      id: roomId,
      name: payload.lobbyName,
      isPrivate: payload.isPrivate,
      password: payload.password
    });

    const player = lobby.addPlayer(socketId, payload.username, payload.password);

    this.lobbies.set(lobby.id, lobby);
    this.playerLobbyIndex.set(socketId, lobby.id);

    return { lobby, player };
  }

  public joinLobby(
    socketId: string,
    payload: JoinLobbyPayload
  ): { lobby: Lobby; player: PlayerState } {
    // If already in a lobby, clean up previous membership first
    if (this.playerLobbyIndex.has(socketId)) {
      this.leaveLobby(socketId);
    }

    const normalizedLobbyId = payload.lobbyId.trim().toUpperCase();
    const lobby = this.lobbies.get(normalizedLobbyId);

    if (!lobby) {
      throw new Error(`Lobby "${payload.lobbyId}" does not exist`);
    }

    const player = lobby.addPlayer(socketId, payload.username, payload.password);

    this.playerLobbyIndex.set(socketId, lobby.id);

    return { lobby, player };
  }

  public leaveLobby(socketId: string): LeaveLobbyResult {
    const lobbyId = this.playerLobbyIndex.get(socketId);
    if (!lobbyId) {
      return {
        lobby: null,
        removed: false,
        destroyed: false,
        newHostSocketId: null
      };
    }

    this.playerLobbyIndex.delete(socketId);
    const lobby = this.lobbies.get(lobbyId);

    if (!lobby) {
      return {
        lobby: null,
        removed: false,
        destroyed: false,
        newHostSocketId: null
      };
    }

    const { removed, newHostSocketId } = lobby.removePlayer(socketId);
    let destroyed = false;

    if (lobby.getPlayerCount() === 0) {
      this.lobbies.delete(lobby.id);
      destroyed = true;
    }

    return {
      lobby,
      removed,
      destroyed,
      newHostSocketId
    };
  }

  public selectPlane(
    socketId: string,
    planeId: PlaneId
  ): { lobby: Lobby; player: PlayerState } {
    const lobby = this.getLobbyBySocketId(socketId);
    if (!lobby) {
      throw new Error('You are not currently in any lobby');
    }

    const player = lobby.selectPlane(socketId, planeId);
    return { lobby, player };
  }

  public toggleReady(
    socketId: string,
    ready: boolean
  ): { lobby: Lobby; player: PlayerState; canStart: boolean } {
    const lobby = this.getLobbyBySocketId(socketId);
    if (!lobby) {
      throw new Error('You are not currently in any lobby');
    }

    const { player, canStart } = lobby.toggleReady(socketId, ready);
    return { lobby, player, canStart };
  }

  public startGame(lobbyId: string): Lobby {
    const lobby = this.getLobby(lobbyId);
    if (!lobby) {
      throw new Error(`Lobby "${lobbyId}" does not exist`);
    }

    lobby.startGame();
    return lobby;
  }

  public getLobby(lobbyId: string): Lobby | undefined {
    return this.lobbies.get(lobbyId.trim().toUpperCase());
  }

  public getLobbyBySocketId(socketId: string): Lobby | undefined {
    const lobbyId = this.playerLobbyIndex.get(socketId);
    if (!lobbyId) return undefined;
    return this.lobbies.get(lobbyId);
  }

  public getPublicLobbies(): LobbySummary[] {
    const result: LobbySummary[] = [];
    for (const lobby of this.lobbies.values()) {
      if (!lobby.isGameStarted) {
        result.push(lobby.toSummary());
      }
    }
    return result;
  }

  public getActiveLobbiesCount(): number {
    return this.lobbies.size;
  }
}
