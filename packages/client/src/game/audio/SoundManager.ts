import { SOUND_CONFIG, SoundConfigPaths } from './SoundConfig.js';

export class SoundManager {
  private static instance: SoundManager;
  private soundElements: Map<string, HTMLAudioElement> = new Map();
  private muted: boolean = false;
  private volume: number = 0.5;

  private constructor() {
    this.initSounds();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private initSounds(): void {
    const paths = SOUND_CONFIG as Record<string, string | undefined>;
    for (const [key, path] of Object.entries(paths)) {
      if (path && path.trim().length > 0) {
        try {
          const audio = new Audio(path);
          audio.preload = 'auto';
          this.soundElements.set(key, audio);
        } catch {
          // Gracefully ignore audio loading errors if file does not exist
        }
      }
    }
  }

  public play(key: keyof SoundConfigPaths): void {
    if (this.muted) return;

    const audio = this.soundElements.get(key as string);
    if (!audio) {
      // Audio path not yet configured; silently no-op
      return;
    }

    try {
      // Clone or reset to allow rapid consecutive plays (e.g. rapid fire)
      const soundClone = audio.cloneNode() as HTMLAudioElement;
      soundClone.volume = this.volume;
      soundClone.play().catch(() => {
        // Autoplay policy or media load errors ignored
      });
    } catch {
      // No-op
    }
  }

  public playShoot(): void {
    this.play('shoot');
  }

  public playExplosion(): void {
    this.play('explosion');
  }

  public playHit(): void {
    this.play('hit');
  }

  public playCountdown(): void {
    this.play('respawnCountdown');
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public setMute(muted: boolean): void {
    this.muted = muted;
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public get currentVolume(): number {
    return this.volume;
  }
}

export const soundManager = SoundManager.getInstance();
