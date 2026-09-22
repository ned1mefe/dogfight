import {
  DestroyedEventPayload,
  GameStateTick,
  HitEventPayload,
  LobbyState,
  LobbySummary,
  PlaneId,
  PlayerInput
} from './types.js';

export interface CreateLobbyPayload {
  username: string;
  lobbyName?: string;
  isPrivate: boolean;
  password?: string;
  mapId?: number;
  resurrectTimeSec?: number;
  killCap?: number;
}

export interface JoinLobbyPayload {
  lobbyId: string;
  username: string;
  password?: string;
}

export interface SelectPlanePayload {
  planeId: PlaneId;
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
  'leave-lobby': () => void;
  'get-lobbies': () => void;
  'select-plane': (payload: SelectPlanePayload) => void;
  'toggle-ready': (payload: ToggleReadyPayload) => void;
  'input-update': (payload: PlayerInput) => void;
}

export interface GameOverPayload {
  winnerId: string;
  scores: Record<string, number>;
}

export interface ServerToClientEvents {
  'lobby-state-update': (state: LobbyState) => void;
  'lobbies-list': (lobbies: LobbySummary[]) => void;
  'lobby-left': () => void;
  'game-started': (payload: { lobbyId: string; mapId?: number }) => void;
  'game-tick': (payload: GameStateTick) => void;
  'player-hit': (payload: HitEventPayload) => void;
  'player-destroyed': (payload: DestroyedEventPayload) => void;
  'game-over': (payload: GameOverPayload) => void;
  'error-message': (payload: ErrorPayload) => void;
}
