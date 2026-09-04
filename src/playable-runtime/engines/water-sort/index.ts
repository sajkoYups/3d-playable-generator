import type { Background, Orientation, WaterSortConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";

const DEFAULT_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"];

type Tube = number[];

type CanvasOptions = {
  background?: Background;
  waterSort?: WaterSortConfig;
  orientation?: Orientation;
};

export function createWaterSortEngine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let tubes: Tube[] = [];
  let selected: number | null = null;
  let winCb: (() => void) | null = null;
  let loseCb: (() => void) | null = null;
  let moves = 0;
  let maxMoves = 40;
  let colors = DEFAULT_COLORS;
  let running = false;
  let raf = 0;

  let background: Background | undefined;
  let orientation: Orientation = "portrait";
  let bgImage: HTMLImageElement | null = null;
  let loadToken = 0;

  function buildLevel(): Tube[] {
    const stack: number[] = [];
    const colorCount = Math.min(5, colors.length || 5);
    for (let c = 0; c < colorCount; c++) {
      for (let i = 0; i < 4; i++) stack.push(c);
    }
    for (let i = stack.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stack[i], stack[j]] = [stack[j], stack[i]];
    }
    const result: Tube[] = [];
    for (let t = 0; t < colorCount; t++) {
      result.push(stack.slice(t * 4, t * 4 + 4));
    }
    result.push([]);
    result.push([]);
    return result;
  }

  function isSolved(): boolean {
    return tubes.every(
      (tube) =>
        tube.length === 0 ||
        (tube.length === 4 && tube.every((c) => c === tube[0])),
    );
  }

  function pour(from: number, to: number) {
    if (from === to) return;
    const src = tubes[from];
    const dst = tubes[to];
    if (!src.length || dst.length >= 4) return;
    const color = src[src.length - 1];
    if (dst.length && dst[dst.length - 1] !== color) return;
    let count = 0;
    while (src.length && src[src.length - 1] === color && dst.length + count < 4) {
      count++;
      src.pop();
    }
    for (let i = 0; i < count; i++) dst.push(color);
    moves++;
    if (isSolved()) winCb?.();
    else if (moves >= maxMoves) loseCb?.();
  }

  async function applyOptions(options?: CanvasOptions) {
    if (!options) return;
    if (options.background) background = options.background;
    if (options.orientation) orientation = options.orientation;
    if (options.waterSort) {
      maxMoves = options.waterSort.maxMoves || 40;
      if (options.waterSort.colors?.length) colors = options.waterSort.colors;
    }
    const token = ++loadToken;
    const bgUrl = canvasBgUrl(background, orientation);
    const nextBg = background?.type === "image" && bgUrl ? await loadImage(bgUrl) : null;
    if (token !== loadToken) return;
    bgImage = nextBg;
  }

  function draw() {
    if (!canvas || !ctx || !container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    drawCanvasBackground(ctx, w, h, background, bgImage);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui";
    ctx.fillText(`Moves ${moves}/${maxMoves}`, 12, 20);

    const cols = tubes.length;
    const tubeW = Math.min(44, (w - 24) / cols - 8);
    const tubeH = Math.min(h * 0.7, 220);
    const gap = (w - cols * tubeW) / (cols + 1);
    const top = (h - tubeH) / 2;

    tubes.forEach((tube, i) => {
      const x = gap + i * (tubeW + gap);
      ctx!.strokeStyle = selected === i ? "#34d399" : "#94a3b8";
      ctx!.lineWidth = selected === i ? 3 : 2;
      ctx!.strokeRect(x, top, tubeW, tubeH);
      const layerH = tubeH / 4;
      tube.forEach((color, li) => {
        ctx!.fillStyle = colors[color] || DEFAULT_COLORS[color] || "#64748b";
        ctx!.fillRect(x + 2, top + tubeH - (li + 1) * layerH + 2, tubeW - 4, layerH - 3);
      });
    });
  }

  function loop() {
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function onPointer(e: PointerEvent) {
    if (!running || !canvas || !container) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = container.clientWidth;
    const cols = tubes.length;
    const tubeW = Math.min(44, (w - 24) / cols - 8);
    const gap = (w - cols * tubeW) / (cols + 1);
    for (let i = 0; i < cols; i++) {
      const tx = gap + i * (tubeW + gap);
      if (x >= tx && x <= tx + tubeW) {
        if (selected === null) selected = i;
        else {
          pour(selected, i);
          selected = null;
        }
        break;
      }
    }
  }

  return {
    id: "water-sort",
    name: "Water Sort",
    initialize(ctxInit: EngineInitContext) {
      const extra = ctxInit as EngineInitContext & CanvasOptions;
      container = ctxInit.container;
      canvas = document.createElement("canvas");
      canvas.style.touchAction = "none";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctxInit.container.innerHTML = "";
      ctxInit.container.appendChild(canvas);
      ctx = canvas.getContext("2d");
      orientation = ctxInit.orientation;
      if (extra.waterSort) {
        maxMoves = extra.waterSort.maxMoves || 40;
        if (extra.waterSort.colors?.length) colors = extra.waterSort.colors;
      }
      tubes = buildLevel();
      void applyOptions(extra).then(() => draw());
      canvas.addEventListener("pointerdown", onPointer);
    },
    setOptions(options) {
      void applyOptions(options as CanvasOptions).then(() => draw());
    },
    start() {
      running = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    reset() {
      tubes = buildLevel();
      selected = null;
      moves = 0;
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("pointerdown", onPointer);
      container = null;
      canvas = null;
      ctx = null;
    },
    onWin(cb) {
      winCb = cb;
    },
    onLose(cb) {
      loseCb = cb;
    },
    resize() {
      draw();
    },
  };
}
