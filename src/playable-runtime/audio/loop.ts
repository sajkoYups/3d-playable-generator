let bed: HTMLAudioElement | null = null;

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

export function startLoopMusic(url: string, muted = false) {
  if (!url) return;
  const el = ensureBed();
  el.muted = muted;
  el.volume = 0.45;
  const abs = new URL(url, window.location.href).href;
  if (el.src !== abs) el.src = url;
  void el.play().catch(() => undefined);
}

export function stopLoopMusic() {
  if (!bed) return;
  bed.pause();
  bed.removeAttribute("src");
  bed.load();
}

export function setLoopMusicMuted(muted: boolean) {
  if (bed) bed.muted = muted;
}

export function isLoopMusicPlaying() {
  return Boolean(bed && !bed.paused && bed.src);
}
