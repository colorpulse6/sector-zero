import { AudioEvent } from "./types";

export type MusicTrack = "menu" | "game";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const MUSIC_PATHS: Record<MusicTrack, string> = {
  menu: `${basePath}/audio/menu-theme.mp3`,
  game: `${basePath}/audio/main-theme.mp3`,
};
const MUSIC_VOLUME = 0.35;
const SFX_VOLUME = 0.25;
const FADE_MS = 800;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private music: HTMLAudioElement | null = null;
  private currentTrack: MusicTrack | null = null;
  private fadeInterval: ReturnType<typeof setInterval> | null = null;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = SFX_VOLUME;
    this.masterGain.connect(this.ctx.destination);
  }

  switchMusic(track: MusicTrack): void {
    if (track === this.currentTrack) return;

    // Clear any in-progress fade
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const oldAudio = this.music;
    this.currentTrack = track;

    // Fade out old track
    if (oldAudio) {
      const startVol = oldAudio.volume;
      const steps = 20;
      const stepMs = FADE_MS / steps;
      let step = 0;
      this.fadeInterval = setInterval(() => {
        step++;
        oldAudio.volume = Math.max(0, startVol * (1 - step / steps));
        if (step >= steps) {
          clearInterval(this.fadeInterval!);
          this.fadeInterval = null;
          oldAudio.pause();
          oldAudio.src = "";
        }
      }, stepMs);
    }

    // Start new track
    const audio = new Audio(MUSIC_PATHS[track]);
    audio.loop = true;
    audio.volume = this.muted ? 0 : MUSIC_VOLUME;
    audio.play().catch(() => {
      const retry = () => {
        audio.play().catch(() => {});
        document.removeEventListener("click", retry);
        document.removeEventListener("keydown", retry);
        document.removeEventListener("touchstart", retry);
      };
      document.addEventListener("click", retry, { once: true });
      document.addEventListener("keydown", retry, { once: true });
      document.addEventListener("touchstart", retry, { once: true });
    });
    this.music = audio;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : SFX_VOLUME;
    }
    if (this.music) {
      this.music.volume = this.muted ? 0 : MUSIC_VOLUME;
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  play(event: AudioEvent): void {
    if (!this.ctx || this.muted) return;

    switch (event) {
      case AudioEvent.PLAYER_SHOOT:
        this.playNote("square", 880, 40, { pitchEnd: 1200, gainStart: 0.1 });
        break;

      case AudioEvent.PLAYER_HIT:
        this.playNote("sawtooth", 200, 200, { pitchEnd: 80, gainStart: 0.25 });
        break;

      case AudioEvent.PLAYER_DEATH:
        this.playNote("sawtooth", 400, 600, { pitchEnd: 60, gainStart: 0.3 });
        this.playNote("square", 300, 500, { pitchEnd: 40, gainStart: 0.2, delay: 0.1 });
        break;

      case AudioEvent.ENEMY_HIT:
        this.playNote("square", 300, 50, { gainStart: 0.12 });
        break;

      case AudioEvent.ENEMY_DESTROY:
        this.playNote("sawtooth", 200, 150, { pitchEnd: 80, gainStart: 0.2 });
        this.playNote("square", 150, 100, { pitchEnd: 50, gainStart: 0.15, delay: 0.02 });
        break;

      case AudioEvent.ENEMY_SHOOT:
        this.playNote("sine", 300, 60, { pitchEnd: 200, gainStart: 0.06 });
        break;

      case AudioEvent.BOSS_HIT:
        this.playNote("sawtooth", 150, 100, { gainStart: 0.2 });
        this.playNote("square", 200, 80, { gainStart: 0.15, delay: 0.03 });
        break;

      case AudioEvent.BOSS_PHASE:
        this.playNote("sawtooth", 100, 400, { pitchEnd: 400, gainStart: 0.2 });
        this.playNote("sine", 200, 300, { pitchEnd: 600, gainStart: 0.15, delay: 0.1 });
        break;

      case AudioEvent.BOSS_DEFEAT:
        for (let i = 0; i < 5; i++) {
          this.playNote("sawtooth", 100 + i * 50, 200, {
            pitchEnd: 50, gainStart: 0.2, delay: i * 0.15,
          });
        }
        this.playNote("sine", 523, 100, { gainStart: 0.2, delay: 0.8 });
        this.playNote("sine", 659, 100, { gainStart: 0.2, delay: 0.9 });
        this.playNote("sine", 784, 100, { gainStart: 0.2, delay: 1.0 });
        this.playNote("sine", 1047, 300, { gainStart: 0.25, delay: 1.1 });
        break;

      case AudioEvent.POWER_UP_COLLECT:
        this.playNote("sine", 523, 60, { gainStart: 0.2 });
        this.playNote("sine", 784, 60, { gainStart: 0.2, delay: 0.06 });
        this.playNote("sine", 1047, 80, { gainStart: 0.2, delay: 0.12 });
        break;

      case AudioEvent.BOMB_ACTIVATE:
        this.playNote("sawtooth", 60, 500, { pitchEnd: 30, gainStart: 0.35 });
        this.playNote("square", 100, 400, { pitchEnd: 40, gainStart: 0.25, delay: 0.05 });
        break;

      case AudioEvent.COMBO:
        this.playNote("sine", 660, 40, { gainStart: 0.12 });
        this.playNote("sine", 880, 40, { gainStart: 0.12, delay: 0.04 });
        break;

      case AudioEvent.LEVEL_COMPLETE:
        this.playNote("sine", 523, 100, { gainStart: 0.2 });
        this.playNote("sine", 659, 100, { gainStart: 0.2, delay: 0.12 });
        this.playNote("sine", 784, 100, { gainStart: 0.2, delay: 0.24 });
        this.playNote("sine", 1047, 250, { gainStart: 0.25, delay: 0.36 });
        break;

      case AudioEvent.GAME_OVER:
        this.playNote("sawtooth", 330, 800, { pitchEnd: 80, gainStart: 0.2 });
        break;

      case AudioEvent.MENU_SELECT:
        this.playNote("sine", 660, 50, { gainStart: 0.15 });
        break;

      case AudioEvent.SHIELD_HIT:
        this.playNote("sine", 500, 80, { pitchEnd: 300, gainStart: 0.15 });
        break;

      // ── Cockpit Hub Sounds ──

      case AudioEvent.COCKPIT_NAV:
        this.playNote("sine", 440, 30, { gainStart: 0.08 });
        break;

      case AudioEvent.COCKPIT_OPEN:
        this.playNote("sine", 523, 50, { gainStart: 0.12 });
        this.playNote("sine", 784, 60, { gainStart: 0.12, delay: 0.04 });
        break;

      case AudioEvent.COCKPIT_BACK:
        this.playNote("sine", 784, 50, { pitchEnd: 523, gainStart: 0.1 });
        break;

      case AudioEvent.UPGRADE_PURCHASE:
        this.playNote("sine", 523, 60, { gainStart: 0.18 });
        this.playNote("sine", 659, 60, { gainStart: 0.18, delay: 0.06 });
        this.playNote("sine", 784, 60, { gainStart: 0.18, delay: 0.12 });
        this.playNote("sine", 1047, 120, { gainStart: 0.2, delay: 0.18 });
        break;

      case AudioEvent.UPGRADE_DENIED:
        this.playNote("square", 200, 80, { pitchEnd: 150, gainStart: 0.08 });
        break;

      case AudioEvent.QUEST_ACCEPT:
        this.playNote("sine", 440, 50, { gainStart: 0.15 });
        this.playNote("sine", 660, 50, { gainStart: 0.15, delay: 0.05 });
        this.playNote("sine", 880, 80, { gainStart: 0.15, delay: 0.1 });
        break;

      case AudioEvent.QUEST_ABANDON:
        this.playNote("sine", 660, 60, { pitchEnd: 330, gainStart: 0.12 });
        break;

      case AudioEvent.DIALOG_ADVANCE:
        this.playNote("sine", 600, 25, { gainStart: 0.06 });
        break;

      case AudioEvent.DIALOG_CLOSE:
        this.playNote("sine", 500, 40, { pitchEnd: 350, gainStart: 0.08 });
        break;
    }
  }

  private playNote(
    type: OscillatorType,
    frequency: number,
    durationMs: number,
    options?: {
      pitchEnd?: number;
      gainStart?: number;
      gainEnd?: number;
      delay?: number;
    }
  ): void {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const start = now + (options?.delay ?? 0);
    const end = start + durationMs / 1000;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (options?.pitchEnd) {
      osc.frequency.linearRampToValueAtTime(options.pitchEnd, end);
    }

    gain.gain.setValueAtTime(options?.gainStart ?? 0.2, start);
    gain.gain.linearRampToValueAtTime(options?.gainEnd ?? 0, end);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(start);
    osc.stop(end + 0.01);
  }
}
