import { LobbyState, LobbySummary, PlaneId, PlayerColor } from '@dogfight/shared';

export type ViewState =
  | 'MENU'
  | 'CREATE_MODAL'
  | 'BROWSER'
  | 'JOIN_MODAL'
  | 'ROOM'
  | 'HOW_TO_PLAY'
  | 'IN_GAME';

export interface UIState {
  currentView: ViewState;
  username: string;
  savedPassword: string;
  currentLobby: LobbyState | null;
  publicLobbies: LobbySummary[];
  isConnecting: boolean;
  socketId: string | null;
  selectedPlane: PlaneId | null;
  isReady: boolean;
  joinTargetLobbyId: string | null;
  joinTargetIsPrivate?: boolean;
  joinTargetLobbyName?: string | null;
}

export interface PlayerSlotDisplay {
  color: PlayerColor;
  label: string;
}

export const PLAYER_SLOT_DEFAULTS: PlayerSlotDisplay[] = [
  { color: 'red', label: 'Slot 1' },
  { color: 'blue', label: 'Slot 2' },
  { color: 'green', label: 'Slot 3' },
  { color: 'yellow', label: 'Slot 4' }
];
