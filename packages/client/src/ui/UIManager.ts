import {
  ClientToServerEvents,
  ServerToClientEvents,
  LobbyState,
  LobbySummary,
  PlaneId,
  PLANE_IDS,
  PLAYER_COLORS,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH
} from '@dogfight/shared';
import { Socket } from 'socket.io-client';
import { UIState, ViewState, MAP_THEMES } from './types.js';
import { toast } from './toast.js';
import { copyInviteLink, setLobbyHash, clearLobbyHash } from './router.js';

export type DogfightSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class UIManager {
  private container: HTMLElement;
  private socket: DogfightSocket | null = null;
  public state: UIState;

  constructor(containerId: string = 'ui-overlay') {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`UI container #${containerId} not found in DOM`);
    }
    this.container = el;

    this.state = {
      currentView: 'MENU',
      username: '',
      savedPassword: '',
      currentLobby: null,
      publicLobbies: [],
      isConnecting: true,
      socketId: null,
      selectedPlane: null,
      selectedMapId: 1,
      isReady: false,
      joinTargetLobbyId: null
    };
  }

  public setSocket(socket: DogfightSocket): void {
    this.socket = socket;
  }

  public setView(view: ViewState): void {
    this.state.currentView = view;
    this.render();
  }

  public setSocketStatus(connected: boolean, socketId: string | null): void {
    this.state.isConnecting = !connected;
    this.state.socketId = socketId;
    this.render();
  }

  public setPublicLobbies(lobbies: LobbySummary[]): void {
    this.state.publicLobbies = lobbies;
    if (this.state.currentView === 'BROWSER') {
      this.render();
    } else if (this.state.currentView === 'JOIN_MODAL' && this.state.joinTargetLobbyId && this.state.joinTargetIsPrivate === undefined) {
      const match = lobbies.find((l) => l.id === this.state.joinTargetLobbyId);
      if (match) {
        this.state.joinTargetIsPrivate = match.isPrivate;
        this.state.joinTargetLobbyName = match.name;
        this.render();
      }
    }
  }

  public setLobbyState(lobby: LobbyState): void {
    this.state.currentLobby = lobby;
    if (lobby.mapId) {
      this.state.selectedMapId = lobby.mapId;
    }
    if (this.socket && this.socket.id) {
      const self = lobby.players.find((p) => p.id === this.socket!.id);
      if (self) {
        this.state.selectedPlane = self.planeId;
        this.state.isReady = self.ready;
      }
    }
    setLobbyHash(lobby.id);
    this.setView('ROOM');
  }

  public clearLobby(): void {
    this.state.currentLobby = null;
    this.state.selectedPlane = null;
    this.state.isReady = false;
    this.state.joinTargetLobbyId = null;
    this.state.username = '';
    clearLobbyHash();
    this.setView('MENU');
  }

  public setUsername(username: string): void {
    this.state.username = username.trim();
  }

  public promptJoinLobby(lobbyId: string, isPrivate?: boolean, lobbyName?: string): void {
    const normalizedId = lobbyId.toUpperCase();
    this.state.joinTargetLobbyId = normalizedId;
    if (isPrivate !== undefined) {
      this.state.joinTargetIsPrivate = isPrivate;
    } else {
      const match = this.state.publicLobbies.find((l) => l.id === normalizedId);
      this.state.joinTargetIsPrivate = match ? match.isPrivate : undefined;
    }
    this.state.joinTargetLobbyName = lobbyName || this.state.publicLobbies.find((l) => l.id === normalizedId)?.name || null;
    this.setView('JOIN_MODAL');
  }

  public render(): void {
    this.container.innerHTML = '';

    if (this.state.currentView === 'IN_GAME') {
      this.container.className = 'absolute inset-0 z-10 pointer-events-none transition-opacity duration-700 opacity-0';
      return;
    }

    this.container.className = 'absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6 select-none';

    // Render persistent Top Bar (connection indicator & player nickname)
    const topBar = this.renderTopBar();
    this.container.appendChild(topBar);

    // Center content area
    const centerWrapper = document.createElement('div');
    centerWrapper.className = 'flex-1 min-h-0 flex items-center justify-center pointer-events-none w-full my-auto';

    let viewNode: HTMLElement;
    switch (this.state.currentView) {
      case 'MENU':
        viewNode = this.renderMenuView();
        break;
      case 'CREATE_MODAL':
        viewNode = this.renderCreateModal();
        break;
      case 'BROWSER':
        viewNode = this.renderBrowserView();
        break;
      case 'JOIN_MODAL':
        viewNode = this.renderJoinModal();
        break;
      case 'HOW_TO_PLAY':
        viewNode = this.renderHowToPlayModal();
        break;
      case 'ROOM':
        viewNode = this.renderRoomView();
        break;
      default:
        viewNode = this.renderMenuView();
    }

    centerWrapper.appendChild(viewNode);
    this.container.appendChild(centerWrapper);

    // Bottom Bar (footer credit)
    const bottomBar = this.renderBottomBar();
    this.container.appendChild(bottomBar);
  }

  // -------------------------------------------------------------
  // Top Navigation Bar
  // -------------------------------------------------------------
  private renderTopBar(): HTMLElement {
    const bar = document.createElement('header');
    bar.className = 'pointer-events-auto flex items-center justify-between w-full max-w-6xl mx-auto py-2 px-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-lg';

    // Brand / Logo
    const brand = document.createElement('div');
    brand.className = 'flex items-center space-x-3 cursor-pointer';
    brand.onclick = () => {
      if (!this.state.currentLobby) this.setView('MENU');
    };

    const logoIcon = document.createElement('img');
    logoIcon.src = '/assets/planes/plane-1.png';
    logoIcon.alt = 'Plane';
    logoIcon.className = 'w-8 h-8 object-contain filter drop-shadow';

    const brandTitle = document.createElement('span');
    brandTitle.className = 'text-base font-bold tracking-wider text-white';
    brandTitle.style.fontFamily = "'Press Start 2P', monospace";
    brandTitle.textContent = 'DOGFIGHT';

    brand.appendChild(logoIcon);
    brand.appendChild(brandTitle);

    // Right status group
    const rightGroup = document.createElement('div');
    rightGroup.className = 'flex items-center space-x-3 text-xs';

    // Pilot nickname tag (only display when actively set)
    if (this.state.username && this.state.username.trim().length > 0) {
      const pilotTag = document.createElement('div');
      pilotTag.className = 'hidden sm:flex items-center space-x-1.5 px-3 py-1 bg-slate-800/90 border border-slate-700 rounded-lg text-slate-300 font-mono';
      pilotTag.innerHTML = `<span class="text-sky-400">PILOT:</span> <span class="font-bold text-white">${this.state.username}</span>`;
      rightGroup.appendChild(pilotTag);
    }

    // Connection indicator
    const connPill = document.createElement('div');
    connPill.className = 'flex items-center space-x-2 px-3 py-1 bg-slate-800/70 border border-slate-700/80 rounded-lg font-mono';

    const pulse = document.createElement('span');
    pulse.className = `w-2 h-2 rounded-full ${this.state.isConnecting ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`;

    const connText = document.createElement('span');
    connText.className = this.state.isConnecting ? 'text-amber-400' : 'text-emerald-400';
    connText.textContent = this.state.isConnecting ? 'Connecting...' : 'Online';

    connPill.appendChild(pulse);
    connPill.appendChild(connText);
    rightGroup.appendChild(connPill);

    bar.appendChild(brand);
    bar.appendChild(rightGroup);
    return bar;
  }

  // -------------------------------------------------------------
  // Bottom Bar / Footer
  // -------------------------------------------------------------
  private renderBottomBar(): HTMLElement {
    const footer = document.createElement('footer');
    footer.className = 'text-center text-slate-500 text-xs font-mono py-1';
    footer.textContent = '1280×720 SERVER-AUTHORITATIVE AIR COMBAT ENGINE • v0.1.0';
    return footer;
  }

  // -------------------------------------------------------------
  // Main Menu Screen
  // -------------------------------------------------------------
  private renderMenuView(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'pointer-events-auto bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200';

    // Hero title banner
    const hero = document.createElement('div');
    hero.className = 'space-y-3';

    const badge = document.createElement('div');
    badge.className = 'inline-block px-3 py-1 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-full text-xs font-mono font-bold tracking-widest uppercase';
    badge.textContent = '2-4 PLAYER MULTIPLAYER ARENA';

    const title = document.createElement('h1');
    title.className = 'text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-300 to-amber-300 tracking-wider';
    title.style.fontFamily = "'Press Start 2P', monospace";
    title.textContent = 'DOGFIGHT';

    const desc = document.createElement('p');
    desc.className = 'text-slate-400 text-sm max-w-sm mx-auto leading-relaxed';
    desc.textContent = 'Pilot iconic pixel airplanes, duel across infinite cloud layers, and master the server-authoritative skies.';

    hero.appendChild(badge);
    hero.appendChild(title);
    hero.appendChild(desc);

    // Action buttons group
    const actions = document.createElement('div');
    actions.className = 'space-y-3 pt-2';

    // Button: Create Lobby
    const createBtn = document.createElement('button');
    createBtn.className = 'w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-blue-900/40 border border-blue-400/30 transition-all flex items-center justify-center space-x-2 cursor-pointer';
    createBtn.innerHTML = `
      <span class="text-lg">⚔️</span>
      <span class="tracking-wide">CREATE ROOM</span>
    `;
    createBtn.onclick = () => this.setView('CREATE_MODAL');

    // Button: Browse Rooms
    const browseBtn = document.createElement('button');
    browseBtn.className = 'w-full py-3.5 px-6 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-100 font-bold rounded-xl border border-slate-600/80 transition-all flex items-center justify-center space-x-2 cursor-pointer';
    browseBtn.innerHTML = `
      <span class="text-lg">📡</span>
      <span class="tracking-wide">BROWSE ROOMS</span>
    `;
    browseBtn.onclick = () => {
      if (this.socket) {
        this.socket.emit('get-lobbies');
      }
      this.setView('BROWSER');
    };

    // Button: How to Play
    const guideBtn = document.createElement('button');
    guideBtn.className = 'w-full py-2.5 px-6 text-slate-400 hover:text-slate-200 text-xs font-mono font-medium rounded-lg hover:bg-slate-800/40 transition-all cursor-pointer flex items-center justify-center space-x-2';
    guideBtn.innerHTML = `<span>📖</span><span>HOW TO PLAY & CONTROLS</span>`;
    guideBtn.onclick = () => this.setView('HOW_TO_PLAY');

    actions.appendChild(createBtn);
    actions.appendChild(browseBtn);
    actions.appendChild(guideBtn);

    // Direct Code Join Box
    const directJoinBox = document.createElement('div');
    directJoinBox.className = 'pt-4 border-t border-slate-800/80';

    const directJoinLabel = document.createElement('div');
    directJoinLabel.className = 'text-xs text-slate-400 font-mono mb-2';
    directJoinLabel.textContent = 'OR ENTER ROOM CODE DIRECTLY:';

    const directJoinRow = document.createElement('div');
    directJoinRow.className = 'flex items-center space-x-2';

    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.placeholder = 'e.g. SKY492';
    codeInput.maxLength = 6;
    codeInput.className = 'flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-center text-sm font-mono tracking-widest uppercase text-white placeholder-slate-600 focus:outline-none focus:border-blue-500';

    const codeJoinBtn = document.createElement('button');
    codeJoinBtn.className = 'px-4 py-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-mono text-xs font-bold rounded-lg transition-all cursor-pointer';
    codeJoinBtn.textContent = 'JOIN';
    codeJoinBtn.onclick = () => {
      const code = codeInput.value.trim().toUpperCase();
      if (!code || code.length !== 6) {
        toast.show('Please enter a valid 6-character room code', 'error');
        return;
      }
      this.promptJoinLobby(code);
    };

    directJoinRow.appendChild(codeInput);
    directJoinRow.appendChild(codeJoinBtn);
    directJoinBox.appendChild(directJoinLabel);
    directJoinBox.appendChild(directJoinRow);

    card.appendChild(hero);
    card.appendChild(actions);
    card.appendChild(directJoinBox);
    return card;
  }

  // -------------------------------------------------------------
  // Create Lobby Modal
  // -------------------------------------------------------------
  private renderCreateModal(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'pointer-events-auto bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200';

    const header = document.createElement('div');
    header.className = 'text-center space-y-1';
    header.innerHTML = `
      <h2 class="text-xl font-bold text-white" style="font-family: 'Press Start 2P', monospace;">CREATE ROOM</h2>
      <p class="text-slate-400 text-xs">Configure your multiplayer air combat arena</p>
    `;
    card.appendChild(header);

    const form = document.createElement('div');
    form.className = 'space-y-3.5';

    // Nickname & Room Name Inputs side-by-side on sm screens
    const inputsRow = document.createElement('div');
    inputsRow.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3';

    // Nickname Input
    const nickGroup = document.createElement('div');
    nickGroup.className = 'space-y-1';
    nickGroup.innerHTML = `<label class="block text-xs font-mono font-medium text-slate-300">NICKNAME</label>`;
    const nickInput = document.createElement('input');
    nickInput.type = 'text';
    nickInput.maxLength = MAX_USERNAME_LENGTH;
    nickInput.value = this.state.username;
    nickInput.placeholder = 'Maverick';
    nickInput.className = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-blue-500';
    nickGroup.appendChild(nickInput);
    inputsRow.appendChild(nickGroup);

    // Room Name Input
    const nameGroup = document.createElement('div');
    nameGroup.className = 'space-y-1';
    nameGroup.innerHTML = `<label class="block text-xs font-mono font-medium text-slate-300">ROOM NAME</label>`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 32;
    nameInput.placeholder = 'Dogfight Arena';
    nameInput.className = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-blue-500';
    nameGroup.appendChild(nameInput);
    inputsRow.appendChild(nameGroup);

    form.appendChild(inputsRow);

    // Map / Arena Theme Selection with visual previews
    const mapGroup = document.createElement('div');
    mapGroup.className = 'space-y-1.5';

    const currentTheme = MAP_THEMES.find((m) => m.id === this.state.selectedMapId) || MAP_THEMES[0];
    mapGroup.innerHTML = `
      <div class="flex items-center justify-between">
        <label class="block text-xs font-mono font-medium text-slate-300">SECTOR / MAP PREVIEW</label>
        <span id="selected-map-label" class="text-[11px] font-bold text-sky-400 font-mono">${currentTheme.name}</span>
      </div>
    `;

    const mapGrid = document.createElement('div');
    mapGrid.className = 'grid grid-cols-2 sm:grid-cols-4 gap-2 select-none';

    MAP_THEMES.forEach((theme) => {
      const isSelected = this.state.selectedMapId === theme.id;
      const mapCard = document.createElement('div');
      mapCard.dataset.mapId = String(theme.id);
      mapCard.className = `group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all p-1 flex flex-col items-center bg-slate-950/70 hover:scale-[1.02] active:scale-95 ${
        isSelected
          ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/20'
          : 'border-slate-800 hover:border-slate-600 opacity-70 hover:opacity-100'
      }`;

      mapCard.innerHTML = `
        <div class="w-full aspect-video rounded-lg overflow-hidden relative bg-slate-900">
          <img src="${theme.preview}" alt="${theme.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ${isSelected ? '<span class="absolute top-1 right-1 bg-sky-500 text-[9px] font-black text-slate-950 px-1.5 py-0.5 rounded shadow">ACTIVE</span>' : ''}
        </div>
        <span class="text-[10px] font-bold mt-1 tracking-tight text-center truncate w-full ${isSelected ? 'text-sky-300 font-extrabold' : 'text-slate-400'}">${theme.name}</span>
      `;

      mapCard.onclick = () => {
        this.state.selectedMapId = theme.id;

        // Live preview background in ArenaScene
        const helper = (window as any).__arenaSceneHelper;
        if (helper) {
          const arena = helper.getArenaScene();
          if (arena) {
            arena.createParallaxBackground(theme.id);
          }
        }

        // Update cards UI
        mapGrid.querySelectorAll('[data-map-id]').forEach((node) => {
          const el = node as HTMLElement;
          const mapId = Number(el.dataset.mapId);
          const active = mapId === theme.id;
          el.className = `group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all p-1 flex flex-col items-center bg-slate-950/70 hover:scale-[1.02] active:scale-95 ${
            active
              ? 'border-sky-400 ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/20'
              : 'border-slate-800 hover:border-slate-600 opacity-70 hover:opacity-100'
          }`;
          const badge = el.querySelector('.bg-sky-500');
          if (active && !badge) {
            const imgWrapper = el.querySelector('.aspect-video');
            if (imgWrapper) {
              const b = document.createElement('span');
              b.className = 'absolute top-1 right-1 bg-sky-500 text-[9px] font-black text-slate-950 px-1.5 py-0.5 rounded shadow';
              b.textContent = 'ACTIVE';
              imgWrapper.appendChild(b);
            }
          } else if (!active && badge) {
            badge.remove();
          }
          const textSpan = el.querySelector('span:last-child');
          if (textSpan) {
            textSpan.className = `text-[10px] font-bold mt-1 tracking-tight text-center truncate w-full ${active ? 'text-sky-300 font-extrabold' : 'text-slate-400'}`;
          }
        });

        const label = document.getElementById('selected-map-label');
        if (label) {
          label.textContent = theme.name;
        }
      };

      mapGrid.appendChild(mapCard);
    });

    mapGroup.appendChild(mapGrid);
    form.appendChild(mapGroup);

    // Room Password Input (Optional - automatically makes room private if set)
    const passGroup = document.createElement('div');
    passGroup.className = 'space-y-1';
    passGroup.innerHTML = `<label class="block text-xs font-mono font-medium text-slate-300">PASSWORD (OPTIONAL)</label>`;
    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.maxLength = 32;
    passInput.placeholder = 'Leave blank for an open public room';
    passInput.className = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-blue-500';
    passGroup.appendChild(passInput);
    form.appendChild(passGroup);

    // Game Settings Row
    const settingsRow = document.createElement('div');
    settingsRow.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800';

    // Resurrect Time Slider
    const resGroup = document.createElement('div');
    resGroup.className = 'space-y-1.5';
    resGroup.innerHTML = `
      <div class="flex items-center justify-between">
        <label class="block text-xs font-mono font-medium text-slate-300">RESURRECT TIME (SEC)</label>
        <span id="resurrect-label" class="text-xs font-bold text-sky-400 font-mono">5</span>
      </div>
    `;
    const resInput = document.createElement('input');
    resInput.type = 'range';
    resInput.min = '1';
    resInput.max = '5';
    resInput.value = '5';
    resInput.className = 'w-full accent-sky-500 cursor-pointer';
    resInput.oninput = () => {
      const label = document.getElementById('resurrect-label');
      if (label) label.textContent = resInput.value;
    };
    resGroup.appendChild(resInput);

    // Kill Cap Input
    const killGroup = document.createElement('div');
    killGroup.className = 'space-y-1.5';
    killGroup.innerHTML = `<label class="block text-xs font-mono font-medium text-slate-300">KILL CAP (TO WIN)</label>`;
    const killInput = document.createElement('input');
    killInput.type = 'number';
    killInput.min = '1';
    killInput.placeholder = 'e.g. 10 (Leave empty for endless)';
    killInput.className = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-1.5 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-blue-500';
    killGroup.appendChild(killInput);

    settingsRow.appendChild(resGroup);
    settingsRow.appendChild(killGroup);
    
    form.appendChild(settingsRow);

    // Buttons
    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex items-center space-x-3 pt-2';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-medium rounded-xl text-sm transition-all cursor-pointer';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => this.setView('MENU');

    const submitBtn = document.createElement('button');
    submitBtn.className = 'flex-1 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-900/30 transition-all cursor-pointer';
    submitBtn.textContent = 'Launch Room';
    submitBtn.onclick = () => {
      const username = nickInput.value.trim();
      if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
        toast.show(`Nickname must be ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} characters`, 'error');
        return;
      }
      this.setUsername(username);

      const password = passInput.value.trim();
      const isPrivate = password.length > 0;
      const lobbyName = nameInput.value.trim() || undefined;

      if (!this.socket) {
        toast.show('Connecting to server... Please wait', 'error');
        return;
      }

      this.socket.emit('create-lobby', {
        username,
        lobbyName,
        isPrivate,
        password: isPrivate ? password : undefined,
        mapId: this.state.selectedMapId || 1,
        resurrectTimeSec: parseInt(resInput.value) || 5,
        killCap: parseInt(killInput.value) || 0
      });
    };

    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(submitBtn);

    card.appendChild(form);
    card.appendChild(btnGroup);
    return card;
  }

  // -------------------------------------------------------------
  // Public & Private Lobby Browser Screen
  // -------------------------------------------------------------
  private renderBrowserView(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'pointer-events-auto bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 max-w-3xl w-full h-[82vh] max-h-[850px] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200';

    // Header with actions
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between border-b border-slate-800 pb-4';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'space-y-1';
    titleGroup.innerHTML = `
      <h2 class="text-xl font-bold text-white tracking-wider" style="font-family: 'Press Start 2P', monospace;">AVAILABLE ROOMS</h2>
      <p class="text-slate-400 text-xs font-mono">Browse all public and private air combat arenas</p>
    `;

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-sky-400 text-xs font-mono font-bold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer';
    refreshBtn.innerHTML = `<span>🔄</span><span>REFRESH</span>`;
    refreshBtn.onclick = () => {
      if (this.socket) {
        this.socket.emit('get-lobbies');
        toast.show('Refreshed lobby list', 'info', 1500);
      }
    };

    header.appendChild(titleGroup);
    header.appendChild(refreshBtn);
    card.appendChild(header);

    // List container (stretches to fill vertical height)
    const listContainer = document.createElement('div');
    listContainer.className = 'flex-1 overflow-y-auto space-y-2.5 pr-2 my-4 min-h-0';

    if (this.state.publicLobbies.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'h-full flex flex-col items-center justify-center py-12 text-center space-y-3';
      emptyState.innerHTML = `
        <div class="text-4xl">🛩️</div>
        <div class="text-slate-300 text-sm font-medium">No open arenas found right now</div>
        <div class="text-slate-500 text-xs">Be the squadron leader and create the first match!</div>
      `;
      listContainer.appendChild(emptyState);
    } else {
      for (const lobby of this.state.publicLobbies) {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all';

        const info = document.createElement('div');
        info.className = 'space-y-1';

        const privBadge = lobby.isPrivate
          ? `<span class="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] rounded font-bold inline-flex items-center space-x-1"><span>🔒</span><span>PRIVATE</span></span>`
          : `<span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] rounded font-bold inline-flex items-center space-x-1"><span>🌐</span><span>PUBLIC</span></span>`;

        const nameLine = document.createElement('div');
        nameLine.className = 'flex flex-wrap items-center gap-2';
        nameLine.innerHTML = `
          <span class="font-bold text-white text-sm">${lobby.name}</span>
          <span class="px-2 py-0.5 bg-slate-800 text-slate-300 font-mono text-[10px] rounded border border-slate-700">${lobby.id}</span>
          ${privBadge}
        `;

        const countBadge = document.createElement('div');
        countBadge.className = 'text-xs text-slate-400 font-mono';
        countBadge.textContent = `Pilots: ${lobby.playerCount} / ${lobby.maxPlayers}`;

        info.appendChild(nameLine);
        info.appendChild(countBadge);

        const joinBtn = document.createElement('button');
        const isFull = lobby.playerCount >= lobby.maxPlayers;
        if (isFull) {
          joinBtn.className = 'px-4 py-2 bg-slate-800 text-slate-500 font-mono text-xs font-bold rounded-lg cursor-not-allowed';
          joinBtn.textContent = 'FULL';
          joinBtn.disabled = true;
        } else {
          joinBtn.className = 'px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-mono text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer';
          joinBtn.textContent = 'JOIN BATTLE';
          joinBtn.onclick = () => {
            this.promptJoinLobby(lobby.id, lobby.isPrivate, lobby.name);
          };
        }

        row.appendChild(info);
        row.appendChild(joinBtn);
        listContainer.appendChild(row);
      }
    }
    card.appendChild(listContainer);

    // Footer actions
    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-between pt-4 border-t border-slate-800 mt-auto';

    const backBtn = document.createElement('button');
    backBtn.className = 'py-2 px-4 text-slate-400 hover:text-white text-xs font-mono transition-all cursor-pointer';
    backBtn.textContent = '← BACK TO MENU';
    backBtn.onclick = () => this.setView('MENU');

    const newBtn = document.createElement('button');
    newBtn.className = 'py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold rounded-lg transition-all cursor-pointer';
    newBtn.textContent = '+ CREATE ROOM';
    newBtn.onclick = () => this.setView('CREATE_MODAL');

    footer.appendChild(backBtn);
    footer.appendChild(newBtn);
    card.appendChild(footer);

    return card;
  }

  // -------------------------------------------------------------
  // Direct Join Modal (for URL hashes or private rooms)
  // -------------------------------------------------------------
  private renderJoinModal(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'pointer-events-auto bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200';

    const lobbyId = this.state.joinTargetLobbyId || 'ROOM';
    const lobbyName = this.state.joinTargetLobbyName;
    const isPrivate = this.state.joinTargetIsPrivate;

    const header = document.createElement('div');
    header.className = 'text-center space-y-1';

    let privBadgeHtml = '';
    if (isPrivate === true) {
      privBadgeHtml = `<span class="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono text-[10px] font-bold">🔒 PRIVATE</span>`;
    } else if (isPrivate === false) {
      privBadgeHtml = `<span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-mono text-[10px] font-bold">🌐 PUBLIC</span>`;
    }

    header.innerHTML = `
      <div class="flex items-center justify-center space-x-2 mb-1">
        <span class="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded font-mono text-xs">ROOM: ${lobbyId}</span>
        ${privBadgeHtml}
      </div>
      <h2 class="text-xl font-bold text-white" style="font-family: 'Press Start 2P', monospace;">JOIN ARENA</h2>
      <p class="text-slate-400 text-xs">${lobbyName ? lobbyName + ' — ' : ''}${isPrivate === true ? 'Enter password to scramble your aircraft' : 'Enter your nickname to scramble your aircraft'}</p>
    `;
    card.appendChild(header);

    const form = document.createElement('div');
    form.className = 'space-y-4';

    // Nickname Input
    const nickGroup = document.createElement('div');
    nickGroup.className = 'space-y-1';
    nickGroup.innerHTML = `<label class="block text-xs font-mono font-medium text-slate-300">PILOT NICKNAME</label>`;
    const nickInput = document.createElement('input');
    nickInput.type = 'text';
    nickInput.maxLength = MAX_USERNAME_LENGTH;
    nickInput.value = this.state.username;
    nickInput.placeholder = 'Goose';
    nickInput.className = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-blue-500';
    nickGroup.appendChild(nickInput);
    form.appendChild(nickGroup);

    // Password input:
    // Only render if private, or unknown (not explicitly false)
    let passInput: HTMLInputElement | null = null;
    if (isPrivate !== false) {
      const passGroup = document.createElement('div');
      passGroup.className = 'space-y-1';
      passGroup.innerHTML = `<label class="block text-xs font-mono font-medium ${isPrivate === true ? 'text-amber-400' : 'text-slate-400'}">ROOM PASSWORD ${isPrivate === true ? '(REQUIRED)' : '(IF PRIVATE)'}</label>`;
      passInput = document.createElement('input');
      passInput.type = 'password';
      passInput.placeholder = isPrivate === true ? 'Enter room password' : 'Leave blank if public';
      passInput.className = `w-full bg-slate-950 border ${isPrivate === true ? 'border-amber-500/40 focus:border-amber-500' : 'border-slate-700 focus:border-blue-500'} rounded-xl px-3.5 py-2.5 text-sm font-medium text-white placeholder-slate-600 focus:outline-none`;
      passGroup.appendChild(passInput);
      form.appendChild(passGroup);
    }

    // Buttons
    const btnGroup = document.createElement('div');
    btnGroup.className = 'flex items-center space-x-3 pt-2';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-medium rounded-xl text-sm transition-all cursor-pointer';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => this.setView('MENU');

    const joinBtn = document.createElement('button');
    joinBtn.className = 'flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-950/50 transition-all cursor-pointer';
    joinBtn.textContent = 'Enter Combat';
    joinBtn.onclick = () => {
      const username = nickInput.value.trim();
      if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
        toast.show(`Nickname must be ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} characters`, 'error');
        return;
      }
      this.setUsername(username);

      let password: string | undefined = undefined;
      if (passInput) {
        const passVal = passInput.value.trim();
        if (isPrivate === true && passVal.length === 0) {
          toast.show('Please enter the room password', 'error');
          return;
        }
        password = passVal.length > 0 ? passVal : undefined;
      }

      if (!this.socket) {
        toast.show('Connecting to server...', 'error');
        return;
      }

      this.socket.emit('join-lobby', {
        lobbyId,
        username,
        password
      });
    };

    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(joinBtn);

    card.appendChild(form);
    card.appendChild(btnGroup);
    return card;
  }

  // -------------------------------------------------------------
  // How to Play Modal
  // -------------------------------------------------------------
  private renderHowToPlayModal(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'pointer-events-auto bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200';

    const header = document.createElement('div');
    header.className = 'text-center space-y-1';
    header.innerHTML = `
      <h2 class="text-xl font-bold text-white tracking-wider" style="font-family: 'Press Start 2P', monospace;">HOW TO PLAY</h2>
      <p class="text-slate-400 text-xs font-mono">Dogfight Combat Flight Manual</p>
    `;
    card.appendChild(header);

    const rules = document.createElement('div');
    rules.className = 'space-y-4 text-xs font-mono text-slate-300';
    rules.innerHTML = `
      <div class="flex items-start space-x-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800">
        <span class="text-xl">🔄</span>
        <div>
          <strong class="text-sky-400 text-sm block">FLIGHT CONTROLS</strong>
          Left & Right Arrow Keys (or A / D) adjust rotation. Planes maintain constant forward airspeed.
        </div>
      </div>

      <div class="flex items-start space-x-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800">
        <span class="text-xl">💥</span>
        <div>
          <strong class="text-amber-400 text-sm block">MACHINE GUN FIRE</strong>
          Spacebar fires bullets along your heading. Bullets fly forward with high velocity (200ms cooldown).
        </div>
      </div>

      <div class="flex items-start space-x-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800">
        <span class="text-xl">🌐</span>
        <div>
          <strong class="text-emerald-400 text-sm block">SCREEN WRAPPING</strong>
          Flying off any edge of the arena seamlessly transports your plane to the opposite side!
        </div>
      </div>

      <div class="flex items-start space-x-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800">
        <span class="text-xl">🏁</span>
        <div>
          <strong class="text-indigo-400 text-sm block">MATCH START</strong>
          2 to 4 pilots per room. As soon as all connected players toggle "READY", the match launches!
        </div>
      </div>
    `;
    card.appendChild(rules);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-mono text-xs font-bold rounded-xl transition-all cursor-pointer';
    closeBtn.textContent = 'DISMISS & RETURN';
    closeBtn.onclick = () => this.setView('MENU');
    card.appendChild(closeBtn);

    return card;
  }

  // -------------------------------------------------------------
  // Active Room Screen (Roster + Interactive Plane Selector)
  // -------------------------------------------------------------
  private renderRoomView(): HTMLElement {
    const lobby = this.state.currentLobby;
    if (!lobby) {
      return this.renderMenuView();
    }

    const card = document.createElement('div');
    card.className = 'pointer-events-auto bg-slate-900/95 border border-slate-700/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 max-w-4xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]';

    // 1. Room Header Bar
    const header = document.createElement('div');
    header.className = 'flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5';

    const leftHeader = document.createElement('div');
    leftHeader.className = 'flex items-center space-x-2.5';

    const roomCodeBadge = document.createElement('div');
    roomCodeBadge.className = 'flex items-center space-x-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-xl font-mono text-sm font-bold tracking-widest';
    roomCodeBadge.innerHTML = `<span class="text-blue-400">ROOM:</span> <span>${lobby.id}</span>`;

    const privBadge = document.createElement('span');
    privBadge.className = lobby.isPrivate
      ? 'px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-mono font-bold'
      : 'px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-mono font-bold';
    privBadge.textContent = lobby.isPrivate ? '🔒 PRIVATE' : '🌐 PUBLIC';

    const mapTheme = MAP_THEMES.find((m) => m.id === (lobby.mapId || 1)) || MAP_THEMES[0];
    const mapBadge = document.createElement('div');
    mapBadge.className = 'flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800/80 text-sky-300 border border-slate-700/80 rounded-lg text-xs font-mono font-bold';
    mapBadge.innerHTML = `<img src="${mapTheme.preview}" class="w-4 h-3 object-cover rounded" /> <span>${mapTheme.name}</span>`;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'text-white font-bold text-sm hidden md:inline ml-2';
    titleSpan.textContent = lobby.name;

    leftHeader.appendChild(roomCodeBadge);
    leftHeader.appendChild(privBadge);
    leftHeader.appendChild(mapBadge);
    leftHeader.appendChild(titleSpan);

    const rightHeader = document.createElement('div');
    rightHeader.className = 'flex items-center space-x-2';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-sky-400 text-xs font-mono font-bold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer';
    copyBtn.innerHTML = `<span>🔗</span><span>INVITE LINK</span>`;
    copyBtn.onclick = () => copyInviteLink(lobby.id);

    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900/90 active:scale-95 text-rose-300 text-xs font-mono font-bold rounded-lg border border-rose-800/80 transition-all cursor-pointer';
    leaveBtn.textContent = 'LEAVE ROOM';
    leaveBtn.onclick = () => {
      if (this.socket) {
        this.socket.emit('leave-lobby');
      }
      this.clearLobby();
    };

    rightHeader.appendChild(copyBtn);
    rightHeader.appendChild(leaveBtn);

    header.appendChild(leftHeader);
    header.appendChild(rightHeader);
    card.appendChild(header);

    // 2. 4-Player Roster Slots
    const rosterSection = this.renderRosterSlots(lobby);
    card.appendChild(rosterSection);

    // 3. Interactive Plane Selector
    const planeSection = this.renderPlaneSelector(lobby);
    card.appendChild(planeSection);

    // 4. Action Bar (Ready toggle & Status notice)
    const actionBar = this.renderActionBar(lobby);
    card.appendChild(actionBar);

    return card;
  }

  // -------------------------------------------------------------
  // 4-Player Roster Slots
  // -------------------------------------------------------------
  private renderRosterSlots(lobby: LobbyState): HTMLElement {
    const container = document.createElement('div');
    container.className = 'grid grid-cols-2 md:grid-cols-4 gap-3';

    for (let i = 0; i < 4; i++) {
      const color = PLAYER_COLORS[i];
      const player = lobby.players.find((p) => p.color === color);

      const slot = document.createElement('div');
      slot.className = 'rounded-xl p-3 flex flex-col justify-between min-h-[140px] border transition-all';

      if (player) {
        const isSelf = player.id === this.socket?.id;
        const colorStyles = this.getColorBadgeStyles(player.color);

        slot.className += ` ${colorStyles.border} ${colorStyles.bg} shadow-md`;

        // Slot Top: Tag & Host/You
        const slotTop = document.createElement('div');
        slotTop.className = 'flex items-center justify-between text-[11px] font-mono';

        const colorPill = document.createElement('span');
        colorPill.className = `px-1.5 py-0.5 rounded font-bold uppercase ${colorStyles.badge}`;
        colorPill.textContent = player.color;

        const badgesGroup = document.createElement('div');
        badgesGroup.className = 'flex items-center space-x-1';

        if (player.isHost) {
          const hostTag = document.createElement('span');
          hostTag.className = 'px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold';
          hostTag.textContent = '👑 HOST';
          badgesGroup.appendChild(hostTag);
        }

        if (isSelf) {
          const youTag = document.createElement('span');
          youTag.className = 'px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold';
          youTag.textContent = 'YOU';
          badgesGroup.appendChild(youTag);
        }

        slotTop.appendChild(colorPill);
        slotTop.appendChild(badgesGroup);

        // Slot Center: Plane sprite & Username
        const slotCenter = document.createElement('div');
        slotCenter.className = 'flex flex-col items-center my-2';

        const planeImg = document.createElement('img');
        planeImg.src = `/assets/planes/${player.planeId}.png`;
        planeImg.alt = player.planeId;
        planeImg.className = 'w-12 h-12 object-contain filter drop-shadow hover:scale-110 transition-transform';

        const nameLabel = document.createElement('span');
        nameLabel.className = 'text-xs font-bold text-white tracking-wide mt-1.5 truncate max-w-[120px] text-center';
        nameLabel.textContent = player.username;

        slotCenter.appendChild(planeImg);
        slotCenter.appendChild(nameLabel);

        // Slot Bottom: Ready pill
        const slotBottom = document.createElement('div');
        slotBottom.className = 'text-center pt-1 border-t border-slate-800/80';

        const readyPill = document.createElement('div');
        if (player.ready) {
          readyPill.className = 'py-0.5 px-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold animate-pulse';
          readyPill.textContent = '✔ READY';
        } else {
          readyPill.className = 'py-0.5 px-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold';
          readyPill.textContent = '⏳ WAITING';
        }
        slotBottom.appendChild(readyPill);

        slot.appendChild(slotTop);
        slot.appendChild(slotCenter);
        slot.appendChild(slotBottom);
      } else {
        // Empty Slot
        slot.className += ' border-dashed border-slate-800 bg-slate-950/40 items-center justify-center text-center';
        slot.innerHTML = `
          <div class="text-slate-700 text-lg mb-1">📡</div>
          <div class="text-slate-600 text-[11px] font-mono font-bold">SLOT ${i + 1}</div>
          <div class="text-slate-600 text-[10px] font-mono">OPEN FOR PILOT</div>
        `;
      }

      container.appendChild(slot);
    }

    return container;
  }

  // -------------------------------------------------------------
  // Interactive Plane Selector (11 Airplanes)
  // -------------------------------------------------------------
  private renderPlaneSelector(lobby: LobbyState): HTMLElement {
    const section = document.createElement('div');
    section.className = 'space-y-3 pt-2';

    const selfPlayer = lobby.players.find((p) => p.id === this.socket?.id);
    const isSelfReady = selfPlayer?.ready || false;

    const titleRow = document.createElement('div');
    titleRow.className = 'flex flex-wrap items-center justify-between gap-2';

    const title = document.createElement('div');
    title.className = 'text-xs font-mono font-bold text-slate-300 tracking-wider';
    title.textContent = 'CHOOSE YOUR COMBAT AIRFRAME (11 MODELS AVAILABLE):';

    titleRow.appendChild(title);

    if (isSelfReady) {
      const lockNotice = document.createElement('div');
      lockNotice.className = 'text-[11px] font-mono text-amber-400 flex items-center space-x-1';
      lockNotice.innerHTML = `<span>🔒</span><span>Airframe locked while READY. Toggle 'NOT READY' to change.</span>`;
      titleRow.appendChild(lockNotice);
    }

    section.appendChild(titleRow);

    // Plane Grid (11 items)
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-2';

    for (const planeId of PLANE_IDS) {
      const isSelectedBySelf = selfPlayer && selfPlayer.planeId === planeId;
      const claimedByPlayer = lobby.players.find((p) => p.planeId === planeId && p.id !== this.socket?.id);
      const isAvailable = lobby.availablePlanes.includes(planeId);

      const planeCard = document.createElement('div');
      planeCard.className = 'flex flex-col items-center justify-between p-2 rounded-xl border text-center transition-all min-h-[90px]';

      const modelNum = planeId.replace('plane-', '#');

      if (isSelectedBySelf) {
        // Selected by local player
        planeCard.className += ' bg-sky-950/70 border-sky-400 ring-2 ring-sky-400/50 shadow-lg shadow-sky-950/50 scale-[1.02]';
      } else if (claimedByPlayer) {
        // Taken by someone else
        planeCard.className += ' bg-slate-950/70 border-slate-800 opacity-40 grayscale cursor-not-allowed';
      } else if (isAvailable) {
        // Available to pick
        if (isSelfReady) {
          planeCard.className += ' bg-slate-950/50 border-slate-800/80 opacity-70 cursor-not-allowed';
        } else {
          planeCard.className += ' bg-slate-950/70 border-slate-800 hover:border-sky-500 hover:bg-slate-900 hover:scale-105 active:scale-95 cursor-pointer';
          planeCard.onclick = () => {
            if (this.socket && !isSelfReady) {
              this.socket.emit('select-plane', { planeId });
            }
          };
        }
      }

      // Plane Image
      const img = document.createElement('img');
      img.src = `/assets/planes/${planeId}.png`;
      img.alt = planeId;
      img.className = 'w-10 h-10 object-contain filter drop-shadow my-auto';

      // Model label
      const label = document.createElement('span');
      label.className = 'text-[10px] font-mono font-bold text-slate-400 mt-1';
      label.textContent = modelNum;

      // Status pill
      const statusPill = document.createElement('span');
      statusPill.className = 'text-[9px] font-mono mt-0.5 truncate max-w-full px-1 py-0.5 rounded';

      if (isSelectedBySelf) {
        statusPill.className += ' text-sky-300 font-bold bg-sky-500/20';
        statusPill.textContent = 'YOU';
      } else if (claimedByPlayer) {
        statusPill.className += ' text-slate-500 font-medium';
        statusPill.textContent = `LOCKED`;
      } else {
        statusPill.className += ' text-emerald-400 font-medium';
        statusPill.textContent = 'FREE';
      }

      planeCard.appendChild(img);
      planeCard.appendChild(label);
      planeCard.appendChild(statusPill);
      grid.appendChild(planeCard);
    }

    section.appendChild(grid);
    return section;
  }

  // -------------------------------------------------------------
  // Action Bar & Status Banner
  // -------------------------------------------------------------
  private renderActionBar(lobby: LobbyState): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'space-y-3 pt-3 border-t border-slate-800';

    const selfPlayer = lobby.players.find((p) => p.id === this.socket?.id);
    const isReady = selfPlayer?.ready || false;

    const readyCount = lobby.players.filter((p) => p.ready).length;
    const totalCount = lobby.players.length;
    const canLaunch = totalCount >= 2 && readyCount === totalCount;

    // Status Banner
    const statusBanner = document.createElement('div');
    statusBanner.className = 'p-3 rounded-xl text-center text-xs font-mono font-bold border transition-all';

    if (totalCount < 2) {
      statusBanner.className += ' bg-slate-950/80 border-slate-800 text-slate-400';
      statusBanner.innerHTML = `<span>⏳ WAITING FOR SQUADRON: Need at least 2 pilots to launch combat (${totalCount}/4 connected). Share invite link with friends!</span>`;
    } else if (!canLaunch) {
      statusBanner.className += ' bg-amber-950/40 border-amber-500/30 text-amber-300 animate-pulse';
      statusBanner.innerHTML = `<span>⚔️ WAITING FOR ALL PILOTS TO READY UP (${readyCount}/${totalCount} READY) — Match launches automatically!</span>`;
    } else {
      statusBanner.className += ' bg-emerald-950/60 border-emerald-500/50 text-emerald-300 animate-bounce';
      statusBanner.innerHTML = `<span>🚀 ALL PILOTS READY! SCRAMBLING ENGINES...</span>`;
    }

    // Big Action Button
    const readyBtn = document.createElement('button');
    if (isReady) {
      readyBtn.className = 'w-full py-4 px-6 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm font-mono tracking-wider shadow-lg shadow-amber-950/50 border border-amber-400/40 transition-all cursor-pointer flex items-center justify-center space-x-2';
      readyBtn.innerHTML = `<span>⏳ READY (CLICK TO UNREADY)</span>`;
    } else {
      readyBtn.className = 'w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm font-mono tracking-wider shadow-lg shadow-emerald-950/50 border border-emerald-400/40 transition-all cursor-pointer flex items-center justify-center space-x-2';
      readyBtn.innerHTML = `<span>✔ MARK AS READY FOR COMBAT</span>`;
    }

    readyBtn.onclick = () => {
      if (this.socket) {
        this.socket.emit('toggle-ready', { ready: !isReady });
      }
    };

    bar.appendChild(statusBanner);
    bar.appendChild(readyBtn);
    return bar;
  }

  private getColorBadgeStyles(color: string): { border: string; bg: string; badge: string } {
    switch (color) {
      case 'red':
        return {
          border: 'border-rose-500/50 hover:border-rose-500',
          bg: 'bg-rose-950/30',
          badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
        };
      case 'blue':
        return {
          border: 'border-blue-500/50 hover:border-blue-500',
          bg: 'bg-blue-950/30',
          badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
        };
      case 'green':
        return {
          border: 'border-emerald-500/50 hover:border-emerald-500',
          bg: 'bg-emerald-950/30',
          badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
        };
      case 'yellow':
      default:
        return {
          border: 'border-amber-500/50 hover:border-amber-500',
          bg: 'bg-amber-950/30',
          badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
        };
    }
  }
}
