import {
  DestroyedEventPayload,
  GameStateTick,
  HitEventPayload,
  LobbyState,
  LobbySummary,
  PlayerInput
} from './types.js';

export interface CreateLobbyPayload {
  username: string;
  isPrivate: boolean;
  password?: string;
}

export interface JoinLobbyPayload {
  lobbyId: string;
  username: string;
  password?: string;
}

export interface ToggleReadyPayload {
  ready: boolean;
}

export interface ErrorPayload {
  message: string;
}

// Socket.io strongly typed contracts
export interface ClientToServerEvents {
  'create-lobby': (payload: CreateLobbyPayload) => void;
  'join-lobby': (payload: JoinLobbyPayload) => void;
  'get-lobbies': () => void;
  'toggle-ready': (payload: ToggleReadyPayload) => void;
  'input-update': (payload: PlayerInput) => void;
}

export interface ServerToClientEvents {
  'lobby-state-update': (state: LobbyState) => void;
  'lobbies-list': (lobbies: LobbySummary[]) => void;
  'game-started': (payload: { lobbyId: string }) => void;
  'game-tick': (payload: GameStateTick) => void;
  'player-hit': (payload: HitEventPayload) => void;
  'player-destroyed': (payload: DestroyedEventPayload) => void;
  'error-message': (payload: ErrorPayload) => void;
}
