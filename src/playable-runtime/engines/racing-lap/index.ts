import type { Background, Orientation, RacingLapConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame } from "@/playable-runtime/engines/canvas-setup";
import { CANVAS_HUD_H, drawCanvasHud, drawCoinIcon } from "@/playable-runtime/engines/canvas-hud";
import { createVirtualJoystick } from "@/playable-runtime/engines/virtual-joystick";
import { RACING_SPRITES } from "@/playable-runtime/engines/kenney-2d-assets";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";
import { listRacingRounds } from "@/playable-runtime/engines/racing-lap/rounds";

type Extra = {
  background?: Background;
  orientation?: Orientation;
  racingLap?: RacingLapConfig;
  playAllRounds?: boolean;
  parkingRoundIndex?: number;
};

export function createRacingLapEngine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let winCb: (() => void) | null = null;
  let loseCb: (() => void) | null = null;
  let running = false;
  let raf = 0;
  let ended = false;
  let last = 0;
  let config: RacingLapConfig = { failEnabled: true, coinImageUrl: "", hudTransparent: false, rounds: [] };
  let playAllRounds = true;
  let roundIndex = 0;
  let earned = 0;
  let laps = 0;
  let checkpoint = 0;
  let offTrack = 0;
  let background: Background | undefined;
  let orientation: Orientation = "portrait";
  let bgImage: HTMLImageElement | null = null;
  let coinImage: HTMLImageElement | null = null;
  let carImg: HTMLImageElement | null = null;
  let grassImg: HTMLImageElement | null = null;
  let roadImg: HTMLImageElement | null = null;
  let assets: Record<string, string> = {};
  let loadToken = 0;
  let angle = -Math.PI / 2;
  let t = 0;
  let trackCoins: { a: number; taken: boolean }[] = [];
  const stick = createVirtualJoystick();
  let onDown: (e: PointerEvent) => void;
  let onMove: (e: PointerEvent) => void;
  let onUp: (e: PointerEvent) => void;

  function rounds() {
    return listRacingRounds(config);
  }
  function current() {
    const list = rounds();
    return list[Math.max(0, Math.min(roundIndex, list.length - 1))] ?? list[0];
  }

  function oval(w: number, h: number) {
    const cx = w / 2;
    const cy = CANVAS_HUD_H + (h - CANVAS_HUD_H) / 2;
    const rx = w * 0.34;
    const ry = (h - CANVAS_HUD_H) * 0.28;
    return { cx, cy, rx, ry };
  }

  function resetLap() {
    angle = -Math.PI / 2;
    t = 0;
    laps = 0;
    checkpoint = 0;
    offTrack = 0;
    ended = false;
    trackCoins = [0, 1, 2, 3, 4, 5].map((i) => ({ a: (i / 6) * Math.PI * 2, taken: false }));
    stick.onUp(-1);
  }

  function completeRound() {
    if (ended) return;
    earned += current().coins;
    const list = rounds();
    if (playAllRounds && roundIndex < list.length - 1) {
      roundIndex += 1;
      resetLap();
      return;
    }
    ended = true;
    winCb?.();
  }

  function tick(dt: number, w: number, h: number) {
    if (ended) return;
    const { cx, cy, rx, ry } = oval(w, h);
    const speed = current().speed;
    angle += stick.state.x * 1.8 * dt;
    t += (0.55 + speed * 0.35) * dt;
    const trackT = t;
    const idealX = cx + Math.cos(trackT) * rx;
    const idealY = cy + Math.sin(trackT) * ry;
    const heading = trackT + Math.PI / 2 + stick.state.x * 0.7;
    angle = heading;
    const carX = idealX + stick.state.y * 18;
    const carY = idealY + stick.state.x * 10;
    for (const coin of trackCoins) {
      if (coin.taken) continue;
      const ox = cx + Math.cos(coin.a) * rx;
      const oy = cy + Math.sin(coin.a) * ry;
      if (Math.hypot(carX - ox, carY - oy) < 28) {
        coin.taken = true;
        earned += 5;
      }
    }
    const nx = (carX - cx) / rx;
    const ny = (carY - cy) / ry;
    const dist = Math.hypot(nx, ny);
    const onAsphalt = dist > 0.72 && dist < 1.18;
    if (!onAsphalt) offTrack += dt;
    else offTrack = Math.max(0, offTrack - dt * 2);
    if (config.failEnabled && offTrack > 1.6) {
      ended = true;
      loseCb?.();
      return;
    }
    const cp = Math.floor(((trackT % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2));
    if (cp === (checkpoint + 1) % 4) {
      checkpoint = cp;
      if (checkpoint === 0) {
        laps += 1;
        if (laps >= current().lapsToWin) completeRound();
      }
    }
    return { carX, carY, heading };
  }

  function draw() {
    if (!canvas || !ctx || !container) return;
    const now = performance.now();
    const dt = Math.min(0.033, (now - (last || now)) / 1000);
    last = now;
    const { w, h } = beginCanvasFrame(canvas, ctx, container);
    if (grassImg?.complete) {
      const tw = 64;
      for (let y = CANVAS_HUD_H; y < h; y += tw) {
        for (let x = 0; x < w; x += tw) ctx.drawImage(grassImg, x, y, tw, tw);
      }
    } else drawCanvasBackground(ctx, w, h, background, bgImage);
    const { cx, cy, rx, ry } = oval(w, h);
    ctx.save();
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = Math.min(rx, ry) * 0.42;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (roadImg?.complete) {
      ctx.strokeStyle = ctx.createPattern(roadImg, "repeat") || "#374151";
      ctx.lineWidth = Math.min(rx, ry) * 0.38;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(248,250,252,0.7)";
    ctx.setLineDash([10, 12]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    for (const coin of trackCoins) {
      if (coin.taken) continue;
      drawCoinIcon(ctx, coinImage, cx + Math.cos(coin.a) * rx - 9, cy + Math.sin(coin.a) * ry - 9, 18);
    }
    const pose = running ? tick(dt, w, h) : { carX: cx, carY: cy - ry, heading: 0 };
    const carX = pose?.carX ?? cx;
    const carY = pose?.carY ?? cy - ry;
    const heading = pose?.heading ?? 0;
    const cw = 36;
    const ch = 58;
    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(heading);
    if (carImg?.complete) ctx.drawImage(carImg, -cw / 2, -ch / 2, cw, ch);
    else {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    }
    ctx.restore();
    stick.place(w, h);
    stick.draw(ctx);
    const list = rounds();
    drawCanvasHud(ctx, {
      w,
      roundText: `R${Math.min(roundIndex + 1, list.length)}/${list.length}`,
      coinsText: `${earned}`,
      extraText: `Lap ${Math.min(laps, current().lapsToWin)}/${current().lapsToWin}`,
      coinImage,
      transparent: config.hudTransparent,
    });
  }

  function loop() {
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  async function load(extra: Extra) {
    if (extra.background) background = extra.background;
    if (extra.orientation) orientation = extra.orientation;
    const token = ++loadToken;
    const bgUrl = canvasBgUrl(background, orientation);
    const media = (ref: string) => resolveRuntimeUrl(ref, assets) || ref;
    const [bg, coin, car, grass, road] = await Promise.all([
      background?.type === "image" && bgUrl ? loadImage(media(bgUrl)) : Promise.resolve(null),
      config.coinImageUrl ? loadImage(media(config.coinImageUrl)) : Promise.resolve(null),
      loadImage(media(RACING_SPRITES.car)),
      loadImage(media(RACING_SPRITES.grass)),
      loadImage(media(RACING_SPRITES.road)),
    ]);
    if (token !== loadToken) return;
    bgImage = bg;
    coinImage = coin;
    carImg = car;
    grassImg = grass;
    roadImg = road;
  }

  return {
    id: "racing-lap",
    name: "Racing Lap",
    initialize(ctxInit: EngineInitContext) {
      const extra = ctxInit as EngineInitContext & Extra;
      container = ctxInit.container;
      const attached = attachPlayableCanvas(ctxInit.container);
      canvas = attached.canvas;
      ctx = attached.ctx;
      orientation = ctxInit.orientation;
      assets = ctxInit.assets || {};
      if (extra.racingLap) config = extra.racingLap;
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      background = extra.background;
      resetLap();
      onDown = (e) => {
        if (!canvas || ended) return;
        const { w, h } = { w: container!.clientWidth, h: container!.clientHeight };
        if (stick.onDown(e.clientX, e.clientY, canvas.getBoundingClientRect(), e.pointerId, w, h)) {
          canvas.setPointerCapture(e.pointerId);
        }
      };
      onMove = (e) => {
        if (!canvas) return;
        stick.onMove(e.clientX, e.clientY, canvas.getBoundingClientRect(), e.pointerId);
      };
      onUp = (e) => stick.onUp(e.pointerId);
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      void load(extra).then(() => draw());
    },
    setOptions(options) {
      const extra = options as Extra;
      if (extra.racingLap) config = extra.racingLap;
      if (typeof extra.playAllRounds === "boolean") playAllRounds = extra.playAllRounds;
      if (typeof extra.parkingRoundIndex === "number" && extra.parkingRoundIndex !== roundIndex) {
        roundIndex = extra.parkingRoundIndex;
        resetLap();
      }
      void load(extra).then(() => draw());
    },
    start() {
      running = true;
      last = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    reset() {
      earned = 0;
      roundIndex = playAllRounds ? 0 : roundIndex;
      resetLap();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("pointerdown", onDown);
      canvas?.removeEventListener("pointermove", onMove);
      canvas?.removeEventListener("pointerup", onUp);
      canvas?.removeEventListener("pointercancel", onUp);
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
