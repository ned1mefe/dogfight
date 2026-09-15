/**
 * Audio Asset Paths Configuration
 *
 * Fill in the file paths to your audio / SFX files here when you are ready.
 * Supported formats: .mp3, .wav, .ogg, etc.
 * Example:
 *   shoot: '/assets/audio/laser-shot.mp3',
 *   explosion: '/assets/audio/plane-explosion.wav',
 */
export interface SoundConfigPaths {
  shoot?: string;
  explosion?: string;
  hit?: string;
  engineHum?: string;
  respawnCountdown?: string;
}

export const SOUND_CONFIG: SoundConfigPaths = {
  // Add your audio asset paths here when available:
  shoot: '',
  explosion: '',
  hit: '',
  engineHum: '',
  respawnCountdown: ''
};
