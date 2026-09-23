import { LobbyState, LobbySummary, PlaneId, PlayerColor } from '@dogfight/shared';

export type ViewState =
  | 'MENU'
  | 'CREATE_MODAL'
  | 'BROWSER'
  | 'JOIN_MODAL'
  | 'ROOM'
  | 'HOW_TO_PLAY'
  | 'IN_GAME'
  | 'GAME_OVER';

export interface UIState {
  currentView: ViewState;
  username: string;
  savedPassword: string;
  currentLobby: LobbyState | null;
  publicLobbies: LobbySummary[];
  isConnecting: boolean;
  socketId: string | null;
  selectedPlane: PlaneId | null;
  selectedMapId: number;
  isReady: boolean;
  joinTargetLobbyId: string | null;
  joinTargetIsPrivate?: boolean;
  joinTargetLobbyName?: string | null;
  lastWinnerName?: string;
}

export interface MapThemeInfo {
  id: number;
  name: string;
  preview: string;
}

export const MAP_THEMES: MapThemeInfo[] = [
  { id: 1, name: 'Clear Skies', preview: '/assets/backgrounds/Clouds 1/preview.jpg' },
  { id: 2, name: 'Overcast Haven', preview: '/assets/backgrounds/Clouds 2/preview.jpg' },
  { id: 3, name: 'Crimson Sunset', preview: '/assets/backgrounds/Clouds 3/preview.png' },
  { id: 4, name: 'Midnight Run', preview: '/assets/backgrounds/Clouds 4/preview.png' },
  { id: 5, name: 'Thunder Ridge', preview: '/assets/backgrounds/Clouds 5/preview.jpg' },
  { id: 6, name: 'Blue Horizon', preview: '/assets/backgrounds/Clouds 6/preview.png' },
  { id: 7, name: 'Golden Dawn', preview: '/assets/backgrounds/Clouds 7/preview.png' },
  { id: 8, name: 'Deep Stratosphere', preview: '/assets/backgrounds/Clouds 8/preview.png' },
];

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
