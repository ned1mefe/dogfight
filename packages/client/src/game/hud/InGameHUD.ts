import { PlayerState, PLANE_BASE_SPEED, PLANE_MAX_SPEED } from '@dogfight/shared';
import { soundManager } from '../audio/SoundManager.js';

export interface InGameHUDCallbacks {
  onLeaveMatch: () => void;
}

export class InGameHUD {
  private container: HTMLElement;
  private callbacks: InGameHUDCallbacks;

  private isVisible: boolean = false;
  private localPlayerId: string | null = null;
  private players: PlayerState[] = [];

  private hudRoot!: HTMLElement;
  private leaderboardContainer!: HTMLElement;
  private respawnOverlay!: HTMLElement;
  private respawnTimeText!: HTMLElement;
  private soundButton!: HTMLButtonElement;
  private airspeedValueText!: HTMLElement;
  private airspeedBarFill!: HTMLElement;
  private airspeedStatusBadge!: HTMLElement;

  constructor(parentContainerId: string, callbacks: InGameHUDCallbacks) {
    const parent = document.getElementById(parentContainerId);
    if (!parent) {
      throw new Error(`HUD parent container '#${parentContainerId}' not found`);
    }
    this.container = parent;
    this.callbacks = callbacks;
    this.buildDOM();
  }

  public setLocalPlayerId(id: string | null): void {
    this.localPlayerId = id;
  }

  public show(): void {
    this.isVisible = true;
    this.hudRoot.classList.remove('hidden');
    this.hudRoot.classList.add('flex');
  }

  public hide(): void {
    this.isVisible = false;
    this.hudRoot.classList.add('hidden');
    this.hudRoot.classList.remove('flex');
    this.hideRespawnBanner();
  }

  public updateState(players: PlayerState[]): void {
    if (!this.isVisible) return;
    this.players = players;
    this.renderLeaderboard();
    this.checkRespawnStatus();

    const me = players.find((p) => p.id === this.localPlayerId);
    if (me && me.isAlive) {
      this.updateAirspeed(me.speed ?? PLANE_BASE_SPEED);
    } else {
      this.updateAirspeed(PLANE_BASE_SPEED);
    }
  }

  private updateAirspeed(speed: number = PLANE_BASE_SPEED): void {
    const clampedSpeed = Math.max(PLANE_BASE_SPEED, Math.min(PLANE_MAX_SPEED, speed));
    const ratio = (clampedSpeed - PLANE_BASE_SPEED) / (PLANE_MAX_SPEED - PLANE_BASE_SPEED);
    const percentage = Math.round(ratio * 100);

    if (this.airspeedValueText) {
      this.airspeedValueText.textContent = `${Math.round(clampedSpeed)} KTS`;
    }
    if (this.airspeedBarFill) {
      this.airspeedBarFill.style.width = `${percentage}%`;
      if (percentage >= 90) {
        this.airspeedBarFill.className =
          'h-full bg-gradient-to-r from-amber-400 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] transition-all duration-150';
      } else if (percentage > 15) {
        this.airspeedBarFill.className =
          'h-full bg-gradient-to-r from-blue-500 to-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-150';
      } else {
        this.airspeedBarFill.className = 'h-full bg-blue-500 transition-all duration-150';
      }
    }
    if (this.airspeedStatusBadge) {
      if (percentage >= 95) {
        this.airspeedStatusBadge.textContent = 'MAX THRUST';
        this.airspeedStatusBadge.className =
          'text-[9px] font-mono font-black uppercase text-emerald-400 tracking-wider animate-pulse';
      } else if (percentage > 10) {
        this.airspeedStatusBadge.textContent = 'BOOSTING';
        this.airspeedStatusBadge.className =
          'text-[9px] font-mono font-bold uppercase text-amber-400 tracking-wider';
      } else {
        this.airspeedStatusBadge.textContent = 'CRUISE';
        this.airspeedStatusBadge.className =
          'text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider';
      }
    }
  }

  private buildDOM(): void {
    this.hudRoot = document.createElement('div');
    this.hudRoot.id = 'in-game-hud';
    this.hudRoot.className =
      'hidden absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6 select-none font-sans';

    // 1. Top HUD Bar
    const topBar = document.createElement('div');
    topBar.className = 'w-full flex items-start justify-between pointer-events-none';

    // Match Header (Left)
    const headerWrapper = document.createElement('div');
    headerWrapper.className =
      'bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-4 py-2.5 shadow-lg flex items-center space-x-3 pointer-events-auto';

    const liveDot = document.createElement('span');
    liveDot.className = 'w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse';

    const titleText = document.createElement('div');
    titleText.innerHTML = `
      <div class="text-xs font-bold uppercase tracking-wider text-slate-400">Combat Sector</div>
      <div class="text-sm font-extrabold text-amber-400 font-mono tracking-wide">DOGFIGHT ARENA</div>
    `;

    headerWrapper.appendChild(liveDot);
    headerWrapper.appendChild(titleText);
    topBar.appendChild(headerWrapper);

    // Top Right Controls & Actions
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'flex items-center space-x-3 pointer-events-auto';

    // Sound toggle button
    this.soundButton = document.createElement('button');
    this.soundButton.className =
      'px-3 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-semibold flex items-center space-x-2 shadow-lg cursor-pointer';
    this.soundButton.innerHTML = `<span>🔊</span><span>Audio</span>`;
    this.soundButton.onclick = () => {
      const isMuted = soundManager.toggleMute();
      this.soundButton.innerHTML = isMuted
        ? `<span>🔇</span><span class="text-red-400">Muted</span>`
        : `<span>🔊</span><span>Audio</span>`;
    };

    // Leave Match button
    const leaveBtn = document.createElement('button');
    leaveBtn.className =
      'px-3.5 py-2 bg-red-600/80 hover:bg-red-500 border border-red-500/80 rounded-xl text-white transition-all text-xs font-bold tracking-wider uppercase flex items-center space-x-2 shadow-lg cursor-pointer active:scale-95';
    leaveBtn.innerHTML = `<span>✕</span><span>Leave</span>`;
    leaveBtn.onclick = () => {
      if (confirm('Leave combat sector and return to room lobby?')) {
        this.callbacks.onLeaveMatch();
      }
    };

    actionsWrapper.appendChild(this.soundButton);
    actionsWrapper.appendChild(leaveBtn);
    topBar.appendChild(actionsWrapper);

    this.hudRoot.appendChild(topBar);

    // 2. Middle Area (Leaderboard on Right + Center Respawn Banner)
    const middleArea = document.createElement('div');
    middleArea.className = 'w-full flex-1 flex items-center justify-between pointer-events-none relative';

    // Center Respawn Banner (Initially hidden)
    this.respawnOverlay = document.createElement('div');
    this.respawnOverlay.className =
      'hidden absolute inset-0 flex flex-col items-center justify-center pointer-events-none';

    const respawnCard = document.createElement('div');
    respawnCard.className =
      'bg-slate-950/90 backdrop-blur-xl border-2 border-red-500/80 rounded-2xl px-8 py-6 shadow-2xl text-center flex flex-col items-center space-y-3 animate-bounce';

    const destroyedTitle = document.createElement('div');
    destroyedTitle.className =
      'text-2xl sm:text-3xl font-black text-red-500 tracking-wider font-mono uppercase drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]';
    destroyedTitle.textContent = 'AIRCRAFT DESTROYED';

    this.respawnTimeText = document.createElement('div');
    this.respawnTimeText.className =
      'text-base sm:text-lg font-bold text-amber-300 font-mono tracking-widest';
    this.respawnTimeText.textContent = 'SCRAMBLING REPLACEMENT IN 5s';

    respawnCard.appendChild(destroyedTitle);
    respawnCard.appendChild(this.respawnTimeText);
    this.respawnOverlay.appendChild(respawnCard);
    middleArea.appendChild(this.respawnOverlay);

    // Right Side Live Leaderboard
    this.leaderboardContainer = document.createElement('div');
    this.leaderboardContainer.className =
      'ml-auto w-64 bg-slate-900/85 backdrop-blur-md border border-slate-800/90 rounded-2xl p-3.5 shadow-2xl flex flex-col space-y-2 pointer-events-auto';

    middleArea.appendChild(this.leaderboardContainer);
    this.hudRoot.appendChild(middleArea);

    // 3. Bottom Controls Hint & Cockpit Airspeed Indicator
    const bottomBar = document.createElement('div');
    bottomBar.className = 'w-full flex items-end justify-between pointer-events-none';

    // Left: Cockpit Airspeed & Linear Boost Gauge
    const airspeedCard = document.createElement('div');
    airspeedCard.className =
      'bg-slate-900/85 backdrop-blur-md border border-slate-800/90 rounded-2xl p-3 shadow-2xl flex flex-col space-y-1.5 w-44 sm:w-48 pointer-events-auto';

    const airspeedHeader = document.createElement('div');
    airspeedHeader.className = 'flex items-center justify-between';

    const airspeedLabel = document.createElement('div');
    airspeedLabel.className =
      'text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-mono';
    airspeedLabel.textContent = 'AIRSPEED';

    this.airspeedStatusBadge = document.createElement('span');
    this.airspeedStatusBadge.className =
      'text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wider';
    this.airspeedStatusBadge.textContent = 'CRUISE';

    airspeedHeader.appendChild(airspeedLabel);
    airspeedHeader.appendChild(this.airspeedStatusBadge);

    const speedRow = document.createElement('div');
    speedRow.className = 'flex items-baseline justify-between';

    this.airspeedValueText = document.createElement('div');
    this.airspeedValueText.className = 'text-lg font-black font-mono tracking-tight text-white';
    this.airspeedValueText.textContent = `${PLANE_BASE_SPEED} KTS`;

    const subLabel = document.createElement('div');
    subLabel.className = 'text-[9px] font-mono text-slate-400';
    subLabel.textContent = 'LINEAR BOOST';

    speedRow.appendChild(this.airspeedValueText);
    speedRow.appendChild(subLabel);

    // Progress Bar Track
    const barTrack = document.createElement('div');
    barTrack.className =
      'w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50';

    this.airspeedBarFill = document.createElement('div');
    this.airspeedBarFill.className = 'h-full bg-blue-500 transition-all duration-150';
    this.airspeedBarFill.style.width = '0%';

    barTrack.appendChild(this.airspeedBarFill);

    airspeedCard.appendChild(airspeedHeader);
    airspeedCard.appendChild(speedRow);
    airspeedCard.appendChild(barTrack);

    bottomBar.appendChild(airspeedCard);

    // Center: Controls Hint
    const hintBadge = document.createElement('div');
    hintBadge.className =
      'bg-slate-900/75 backdrop-blur-md border border-slate-800/80 px-4 py-2 rounded-xl flex items-center space-x-4 text-xs font-mono text-slate-300 shadow-lg';
    hintBadge.innerHTML = `
      <div class="flex items-center space-x-1.5">
        <span class="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">← / A</span>
        <span class="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-amber-400 font-bold">→ / D</span>
        <span class="text-slate-400">STEER</span>
      </div>
      <div class="h-3 w-px bg-slate-700"></div>
      <div class="flex items-center space-x-1.5">
        <span class="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-emerald-400 font-bold">SPACE</span>
        <span class="text-slate-400">FIRE CANNON</span>
      </div>
    `;

    bottomBar.appendChild(hintBadge);

    // Right dummy spacer to balance flex
    const rightSpacer = document.createElement('div');
    rightSpacer.className = 'w-44 sm:w-48 hidden sm:block pointer-events-none';
    bottomBar.appendChild(rightSpacer);

    this.hudRoot.appendChild(bottomBar);

    this.container.appendChild(this.hudRoot);
  }

  private renderLeaderboard(): void {
    this.leaderboardContainer.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold tracking-wider uppercase text-slate-400';
    header.innerHTML = `
      <span>Pilots (${this.players.length})</span>
      <span>Kills</span>
    `;
    this.leaderboardContainer.appendChild(header);

    // Sort players by score descending
    const sorted = [...this.players].sort((a, b) => b.score - a.score);

    for (let index = 0; index < sorted.length; index++) {
      const p = sorted[index];
      const isMe = p.id === this.localPlayerId;

      const row = document.createElement('div');
      row.className = `flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors ${
        isMe
          ? 'bg-blue-950/60 border border-blue-500/40 text-blue-200 font-bold'
          : 'hover:bg-slate-800/50 text-slate-200'
      }`;

      // Left: rank + avatar + name + status
      const leftCol = document.createElement('div');
      leftCol.className = 'flex items-center space-x-2 truncate';

      const rankBadge = document.createElement('span');
      rankBadge.className = `font-mono text-[10px] w-3 ${
        index === 0 ? 'text-amber-400 font-black' : 'text-slate-500'
      }`;
      rankBadge.textContent = `${index + 1}`;

      const avatar = document.createElement('img');
      avatar.src = `/assets/planes/${p.planeId}.png`;
      avatar.alt = p.planeId;
      avatar.className = 'w-5 h-5 object-contain filter drop-shadow';

      const nameWrapper = document.createElement('div');
      nameWrapper.className = 'flex flex-col truncate';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'truncate max-w-[90px]';
      nameSpan.textContent = p.username + (isMe ? ' (You)' : '');

      const statusSpan = document.createElement('span');
      statusSpan.className = `text-[9px] font-mono leading-none ${
        p.isAlive ? 'text-emerald-400' : 'text-rose-400'
      }`;
      statusSpan.textContent = p.isAlive
        ? 'AIRBORNE'
        : `DOWN (${Math.ceil(p.respawnTimer || 0)}s)`;

      nameWrapper.appendChild(nameSpan);
      nameWrapper.appendChild(statusSpan);

      leftCol.appendChild(rankBadge);
      leftCol.appendChild(avatar);
      leftCol.appendChild(nameWrapper);

      // Right: score badge
      const scoreBadge = document.createElement('span');
      scoreBadge.className =
        'font-mono font-black text-sm px-2 py-0.5 rounded bg-slate-800/80 text-amber-400 border border-slate-700/50';
      scoreBadge.textContent = `${p.score}`;

      row.appendChild(leftCol);
      row.appendChild(scoreBadge);
      this.leaderboardContainer.appendChild(row);
    }
  }

  private checkRespawnStatus(): void {
    if (!this.localPlayerId) {
      this.hideRespawnBanner();
      return;
    }

    const me = this.players.find((p) => p.id === this.localPlayerId);
    if (me && !me.isAlive) {
      this.showRespawnBanner(me.respawnTimer);
    } else {
      this.hideRespawnBanner();
    }
  }

  private showRespawnBanner(secondsLeft: number): void {
    this.respawnOverlay.classList.remove('hidden');
    const formatted = Math.max(0, secondsLeft).toFixed(1);
    this.respawnTimeText.textContent = `SCRAMBLING REPLACEMENT IN ${formatted}s`;
  }

  private hideRespawnBanner(): void {
    this.respawnOverlay.classList.add('hidden');
  }

  public destroy(): void {
    this.hudRoot.remove();
  }
}
