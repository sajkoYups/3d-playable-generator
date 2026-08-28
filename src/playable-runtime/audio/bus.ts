import { startLoopMusic, stopLoopMusic, setLoopMusicMuted, isLoopMusicPlaying } from "@/playable-runtime/audio/loop";

export type AudioSlot = "music" | "tap" | "win" | "lose";

export type AudioBusOptions = {
  musicUrl?: string;
  tapUrl?: string;
  winUrl?: string;
  loseUrl?: string;
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
  private buffers = new Map<AudioSlot, AudioBuffer>();
  private urls: AudioBusOptions = {};
  private musicSource: AudioBufferSourceNode | null = null;
  private muted = false;
  private unlocked = false;

  setUrls(urls: AudioBusOptions) {
    this.urls = urls;
  }

  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.unlocked = true;
      return;
    }
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
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.unlocked = true;
    void this.preload();
  }

  private async preload() {
    const entries: [AudioSlot, string | undefined][] = [
      ["tap", this.urls.tapUrl],
      ["win", this.urls.winUrl],
      ["lose", this.urls.loseUrl],
    ];
    await Promise.all(
      entries.map(async ([slot, url]) => {
        if (!url || !this.ctx) return;
        try {
          const res = await fetch(url);
          const arr = await res.arrayBuffer();
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
    if (!this.unlocked || !this.ctx || this.muted) {
      this.beep(slot);
      return;
    }
    const buf = this.buffers.get(slot);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.sfxGain!);
      src.start();
      return;
    }
    this.beep(slot);
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

  private beep(slot: AudioSlot) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const freq = slot === "win" ? 660 : slot === "lose" ? 180 : 420;
    osc.frequency.setValueAtTime(freq, now);
    osc.type = slot === "lose" ? "sawtooth" : "triangle";
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (slot === "win" ? 0.35 : 0.12));
    osc.connect(gain);
    gain.connect(this.sfxGain || this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
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
