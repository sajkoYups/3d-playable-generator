import { startLoopMusic, stopLoopMusic, setLoopMusicMuted, isLoopMusicPlaying, prepareLoopMusic } from "@/playable-runtime/audio/loop";
import { dataUriToArrayBuffer, playableMediaSrc } from "@/playable-runtime/media/src";

export type AudioSlot = "music" | "tap" | "win" | "lose";

export type AudioBusOptions = {
  musicUrl?: string;
  tapUrl?: string;
  winUrl?: string;
  loseUrl?: string;
};

export type SfxPlayOptions = {
  throttleMs?: number;
  rate?: number;
};

const SFX_FALLBACK: Record<string, { freq: number; dur: number; type: OscillatorType; vol: number }> = {
  tap: { freq: 420, dur: 0.12, type: "triangle", vol: 0.18 },
  win: { freq: 660, dur: 0.35, type: "triangle", vol: 0.18 },
  lose: { freq: 180, dur: 0.28, type: "sawtooth", vol: 0.16 },
  arrowFire: { freq: 920, dur: 0.07, type: "square", vol: 0.12 },
  cannonFire: { freq: 96, dur: 0.22, type: "sawtooth", vol: 0.2 },
  turretFire: { freq: 1680, dur: 0.035, type: "square", vol: 0.08 },
  hit: { freq: 260, dur: 0.05, type: "triangle", vol: 0.1 },
  death: { freq: 170, dur: 0.16, type: "sine", vol: 0.14 },
  leak: { freq: 130, dur: 0.26, type: "sawtooth", vol: 0.18 },
  place: { freq: 540, dur: 0.11, type: "triangle", vol: 0.16 },
  wave: { freq: 380, dur: 0.22, type: "sine", vol: 0.14 },
};

/**
 * Gesture-unlocked Web Audio for SFX. Music is a looping HTMLAudioElement so it
 * can start in the same click as Preview / the start-screen toggle.
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private urls: AudioBusOptions = {};
  private extraUrls: Record<string, string> = {};
  private lastSfxAt = new Map<string, number>();
  private musicSource: AudioBufferSourceNode | null = null;
  private muted = false;
  private unlocked = false;

  setUrls(urls: AudioBusOptions) {
    this.urls = urls;
    if (urls.musicUrl) prepareLoopMusic(urls.musicUrl);
    if (this.unlocked) void this.preload();
  }

  setExtraUrls(urls: Record<string, string>) {
    this.extraUrls = { ...urls };
    if (this.unlocked) void this.preload();
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.35;
      this.sfxGain.gain.value = 0.7;
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
    void this.preload();
  }

  private async preload() {
    const entries: Array<[string, string | undefined]> = [
      ["tap", this.urls.tapUrl],
      ["win", this.urls.winUrl],
      ["lose", this.urls.loseUrl],
      ...Object.entries(this.extraUrls),
    ];
    await Promise.all(
      entries.map(async ([slot, url]) => {
        if (!url || !this.ctx) return;
        try {
          let arr: ArrayBuffer | null = url.startsWith("data:") ? dataUriToArrayBuffer(url) : null;
          if (!arr) {
            const res = await fetch(playableMediaSrc(url));
            if (!res.ok) return;
            arr = await res.arrayBuffer();
          }
          const buf = await this.ctx.decodeAudioData(arr.slice(0));
          this.buffers.set(slot, buf);
        } catch {
          // keep procedural fallback
        }
      }),
    );
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    setLoopMusicMuted(muted);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04);
    }
  }

  isMuted() {
    return this.muted;
  }

  isMusicPlaying() {
    return isLoopMusicPlaying() || Boolean(this.musicSource);
  }

  play(slot: AudioSlot) {
    if (slot === "music") {
      this.playMusic();
      return;
    }
    this.playSfx(slot);
  }

  playSfx(id: string, opts?: SfxPlayOptions) {
    if (this.muted) return;
    const minGap = opts?.throttleMs ?? 0;
    if (minGap > 0) {
      const now = performance.now();
      const last = this.lastSfxAt.get(id) ?? 0;
      if (now - last < minGap) return;
      this.lastSfxAt.set(id, now);
    }
    if (!this.unlocked || !this.ctx) {
      this.beep(id);
      return;
    }
    const buf = this.buffers.get(id);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts?.rate ?? 1;
      src.connect(this.sfxGain!);
      src.start();
      return;
    }
    this.beep(id);
  }

  private playMusic() {
    if (this.muted) return;
    if (this.urls.musicUrl) {
      startLoopMusic(this.urls.musicUrl, this.muted);
      return;
    }
    if (this.musicSource) return;
    if (!this.unlocked || !this.ctx) return;
    this.hum();
  }

  stopMusic() {
    stopLoopMusic();
    try {
      this.musicSource?.stop();
    } catch {
      /* already stopped */
    }
    this.musicSource = null;
  }

  destroy() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
    this.unlocked = false;
    this.buffers.clear();
  }

  private beep(slot: string) {
    if (!this.ctx || this.muted) return;
    const tone = SFX_FALLBACK[slot] ?? SFX_FALLBACK.tap;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(tone.freq, now);
    osc.type = tone.type;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone.vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.dur);
    osc.connect(gain);
    gain.connect(this.sfxGain || this.ctx.destination);
    osc.start(now);
    osc.stop(now + tone.dur + 0.05);
  }

  private hum() {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 110;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(this.musicGain || this.ctx.destination);
    osc.start();
    this.musicSource = osc as unknown as AudioBufferSourceNode;
  }
}
