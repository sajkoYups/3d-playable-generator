export function attachPlayableCanvas(container: HTMLElement) {
  container.innerHTML = "";
  container.style.pointerEvents = "auto";
  const canvas = document.createElement("canvas");
  canvas.style.touchAction = "none";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.pointerEvents = "auto";
  canvas.style.cursor = "pointer";
  container.appendChild(canvas);
  return { canvas, ctx: canvas.getContext("2d") };
}

/** Map a pointer onto the canvas drawing space (undo CSS transforms / phone-frame scale). */
export function pointerCanvasPos(
  e: PointerEvent,
  canvas: HTMLCanvasElement,
  logicalW: number,
  logicalH: number,
) {
  const rect = canvas.getBoundingClientRect();
  const rw = Math.max(1e-6, rect.width);
  const rh = Math.max(1e-6, rect.height);
  return {
    x: ((e.clientX - rect.left) / rw) * logicalW,
    y: ((e.clientY - rect.top) / rh) * logicalH,
  };
}

export function beginCanvasFrame(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  container: HTMLElement,
) {
  const w = Math.max(1, Math.round(container.clientWidth) || 1);
  const h = Math.max(1, Math.round(container.clientHeight) || 1);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const nextW = Math.max(1, Math.floor(w * dpr));
  const nextH = Math.max(1, Math.floor(h * dpr));
  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW;
    canvas.height = nextH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { w, h };
}
