export type AudioSlot = "music" | "tap" | "win" | "lose";

export type AudioBusOptions = {
  musicUrl?: string;
  tapUrl?: string;
  winUrl?: string;
  loseUrl?: string;
};

/**
 * Gesture-unlocked Web Audio. Call `unlock()` from the first pointerdown
 * on the start screen so iOS allows playback.
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
    if (this.unlocked) return;
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
    await this.preload();
  }

  private async preload() {
    const entries: [AudioSlot, string | undefined][] = [
      ["music", this.urls.musicUrl],
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
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04);
    }
  }

  isMuted() {
    return this.muted;
  }

  play(slot: AudioSlot) {
    if (!this.unlocked || !this.ctx || this.muted) {
      if (slot !== "music") this.beep(slot);
      return;
    }
    const buf = this.buffers.get(slot);
    if (slot === "music") {
      this.stopMusic();
      if (buf) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(this.musicGain!);
        src.start();
        this.musicSource = src;
        return;
      }
      this.hum();
      return;
    }
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.sfxGain!);
      src.start();
      return;
    }
    this.beep(slot);
  }

  stopMusic() {
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
