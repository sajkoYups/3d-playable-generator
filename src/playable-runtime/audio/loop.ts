import { playableMediaSrc } from "@/playable-runtime/media/src";

let bed: HTMLAudioElement | null = null;
let bedKey = "";

function ensureBed() {
  if (bed) return bed;
  const el = document.createElement("audio");
  el.loop = true;
  el.preload = "auto";
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");
  el.style.display = "none";
  document.body.appendChild(el);
  bed = el;
  return el;
}

function ignoreInterruptedPlay(err: unknown) {
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
  if (name === "AbortError" || name === "NotAllowedError") return;
}

/** Decode data: URIs and assign src now so play() can stay inside a tap. */
export function prepareLoopMusic(url: string) {
  if (!url) return;
  try {
    const el = ensureBed();
    const src = playableMediaSrc(url);
    if (bedKey === src) return;
    el.pause();
    el.preload = "auto";
    el.src = src;
    bedKey = src;
    el.load();
  } catch {
    /* ignore */
  }
}

export function startLoopMusic(url: string, muted = false, loop = true) {
  if (!url) return;
  try {
    prepareLoopMusic(url);
    const el = ensureBed();
    el.muted = muted;
    el.loop = loop;
    el.volume = 0.45;
    void el.play().catch(ignoreInterruptedPlay);
  } catch {
    /* data: URIs / autoplay must not take down the playable */
  }
}

export function stopLoopMusic() {
  if (!bed) return;
  bed.pause();
}

export function setLoopMusicMuted(muted: boolean) {
  if (bed) bed.muted = muted;
}

export function isLoopMusicPlaying() {
  return Boolean(bed && !bed.paused && bed.src);
}
