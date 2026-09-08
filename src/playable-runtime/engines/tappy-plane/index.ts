import type { Background, Orientation, TappyPlaneConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame } from "@/playable-runtime/engines/canvas-setup";
import { CANVAS_HUD_H, drawCanvasHud } from "@/playable-runtime/engines/canvas-hud";
import { drawHintHand } from "@/playable-runtime/engines/hint-hand";
import { TAPPY_SPRITES } from "@/playable-runtime/engines/kenney-2d-assets";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";
import { listTappyRounds } from "@/playable-runtime/engines/tappy-plane/rounds";

type Extra = {
  background?: Background;
  orientation?: Orientation;
  tappyPlane?: TappyPlaneConfig;
  playAllRounds?: boolean;
  parkingRoundIndex?: number;
  hintHandUrl?: string;
  hintHandVisible?: boolean;
};

type Rock = { x: number; gapY: number; passed: boolean };

export function createTappyPlaneEngine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let winCb: (() => void) | null = null;
  let loseCb: (() => void) | null = null;
  let running = false;
  let raf = 0;
  let ended = false;
  let last = 0;
  let config: TappyPlaneConfig = { failEnabled: true, hintHandEnabled: true, hintDelayMs: 1800, coinImageUrl: "", hudTransparent: false, rounds: [] };
  let playAllRounds = true;
  let roundIndex = 0;
  let earned = 0;
  let passed = 0;
  let lastInputAt = 0;
  let background: Background | undefined;
  let orientation: Orientation = "portrait";
  let hintHandUrl = "";
  let hintHandVisible = true;
  let bgImage: HTMLImageElement | null = null;
  let handImage: HTMLImageElement | null = null;
  let coinImage: HTMLImageElement | null = null;
  let planeImgs: (HTMLImageElement | null)[] = [null, null, null];
  let rockUp: HTMLImageElement | null = null;
  let rockDown: HTMLImageElement | null = null;
  let groundImg: HTMLImageElement | null = null;
  let skyImg: HTMLImageElement | null = null;
  let assets: Record<string, string> = {};
  let loadToken = 0;
  let y = 0.45;
  let vy = 0;
  let scroll = 0;
  let rocks: Rock[] = [];
  let started = false;

  function rounds() {
    return listTappyRounds(config);
  }
  function current() {
    const list = rounds();
    return list[Math.max(0, Math.min(roundIndex, list.length - 1))] ?? list[0];
  }

  function resetFlight() {
    y = 0.45;
    vy = 0;
    scroll = 0;
    passed = 0;
    started = false;
    ended = false;
    rocks = [];
    lastInputAt = performance.now();
    spawn(1.15);
    spawn(1.85);
  }

  function spawn(x: number) {
    rocks.push({ x, gapY: 0.28 + Math.random() * 0.34, passed: false });
  }

  function completeRound() {
    if (ended) return;
    earned += current().coins;
    const list = rounds();
    if (playAllRounds && roundIndex < list.length - 1) {
      roundIndex += 1;
      resetFlight();
      return;
    }
    ended = true;
    winCb?.();
  }

  function crash() {
    if (ended) return;
    if (!config.failEnabled) {
      y = 0.45;
      vy = 0;
      return;
    }
    ended = true;
    loseCb?.();
  }

  function flap() {
    lastInputAt = performance.now();
    started = true;
    vy = -0.55;
  }

  function onPointer() {
    if (!running || ended) return;
    flap();
  }

  function tick(dt: number) {
    if (!started || ended) return;
    const round = current();
    vy += 1.35 * dt;
    y += vy * dt;
    scroll += round.speed * 0.28 * dt;
    for (const rock of rocks) rock.x -= round.speed * 0.32 * dt;
    if (rocks.length && rocks[0].x < -0.35) {
      rocks.shift();
      spawn(1.2 + Math.random() * 0.2);
    }
    const gap = round.gapSize;
    for (const rock of rocks) {
      if (!rock.passed && rock.x + 0.08 < 0.28) {
        rock.passed = true;
        passed += 1;
        if (passed >= round.gapsToWin) completeRound();
      }
      const inX = rock.x < 0.38 && rock.x + 0.18 > 0.22;
      if (inX && (y < rock.gapY || y > rock.gapY + gap)) crash();
    }
    if (y > 0.82 || y < 0.06) crash();
  }

  function draw() {
    if (!canvas || !ctx || !container) return;
    const now = performance.now();
    const dt = Math.min(0.033, (now - (last || now)) / 1000);
    last = now;
    if (running) tick(dt);
    const { w, h } = beginCanvasFrame(canvas, ctx, container);
    if (background?.type === "transparent") {
      drawCanvasBackground(ctx, w, h, background, bgImage);
    } else if (skyImg && skyImg.complete) {
      const sw = skyImg.naturalWidth || w;
      const ox = -((scroll * 40) % sw);
      ctx.drawImage(skyImg, ox, CANVAS_HUD_H, sw, h - CANVAS_HUD_H);
      ctx.drawImage(skyImg, ox + sw, CANVAS_HUD_H, sw, h - CANVAS_HUD_H);
    } else drawCanvasBackground(ctx, w, h, background, bgImage);
    const list = rounds();
    const round = current();
    drawCanvasHud(ctx, {
      w,
      roundText: `R${Math.min(roundIndex + 1, list.length)}/${list.length}`,
      coinsText: `${earned}`,
      extraText: `${passed}/${round.gapsToWin}`,
      coinImage,
      transparent: config.hudTransparent,
    });
    const groundH = h * 0.12;
    const playTop = CANVAS_HUD_H;
    const playH = h - playTop - groundH;
    const gapPx = round.gapSize * playH;
    for (const rock of rocks) {
      const rx = rock.x * w;
      const rw = w * 0.16;
      const gapY = playTop + rock.gapY * playH;
      if (rockDown?.complete) ctx.drawImage(rockDown, rx, playTop, rw, gapY - playTop);
      else {
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(rx, playTop, rw, gapY - playTop);
      }
      if (rockUp?.complete) ctx.drawImage(rockUp, rx, gapY + gapPx, rw, playTop + playH - (gapY + gapPx));
      else {
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(rx, gapY + gapPx, rw, playTop + playH - (gapY + gapPx));
      }
    }
    if (groundImg?.complete) {
      const gw = groundImg.naturalWidth || w;
      const gx = -((scroll * 80) % gw);
      ctx.drawImage(groundImg, gx, h - groundH, gw, groundH);
      ctx.drawImage(groundImg, gx + gw, h - groundH, gw, groundH);
    } else {
      ctx.fillStyle = "#65a30d";
      ctx.fillRect(0, h - groundH, w, groundH);
    }
    const frame = Math.floor(now / 120) % 3;
    const plane = planeImgs[frame] || planeImgs[0];
    const pw = w * 0.16;
    const ph = pw * 0.72;
    const px = w * 0.22;
    const py = playTop + y * playH;
    if (plane?.complete) ctx.drawImage(plane, px, py - ph / 2, pw, ph);
    else {
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(px, py - ph / 2, pw, ph);
    }
    if (
      !started &&
      config.hintHandEnabled &&
      hintHandVisible &&
      now - lastInputAt >= config.hintDelayMs
    ) {
      drawHintHand(ctx, handImage, px + pw * 0.6, py + ph * 0.4, 48, now);
    }
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
    const [bg, hand, coin, p1, p2, p3, ru, rd, g, sky] = await Promise.all([
      background?.type === "image" && bgUrl ? loadImage(media(bgUrl)) : Promise.resolve(null),
      hintHandUrl ? loadImage(media(hintHandUrl)) : Promise.resolve(null),
      config.coinImageUrl ? loadImage(media(config.coinImageUrl)) : Promise.resolve(null),
      loadImage(media(TAPPY_SPRITES.plane1)),
      loadImage(media(TAPPY_SPRITES.plane2)),
      loadImage(media(TAPPY_SPRITES.plane3)),
      loadImage(media(TAPPY_SPRITES.rock)),
      loadImage(media(TAPPY_SPRITES.rockDown)),
      loadImage(media(TAPPY_SPRITES.ground)),
      loadImage(media(TAPPY_SPRITES.background)),
    ]);
    if (token !== loadToken) return;
    bgImage = bg;
    handImage = hand;
    coinImage = coin;
    planeImgs = [p1, p2, p3];
    rockUp = ru;
    rockDown = rd;
    groundImg = g;
    skyImg = sky;
  }

  return {
    id: "tappy-plane",
    name: "Tappy Plane",
    initialize(ctxInit: EngineInitContext) {
      const extra = ctxInit as EngineInitContext & Extra;
      container = ctxInit.container;
      const attached = attachPlayableCanvas(ctxInit.container);
      canvas = attached.canvas;
      ctx = attached.ctx;
      orientation = ctxInit.orientation;
      assets = ctxInit.assets || {};
      if (extra.tappyPlane) config = extra.tappyPlane;
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      hintHandUrl = extra.hintHandUrl || "";
      hintHandVisible = extra.hintHandVisible !== false;
      background = extra.background;
      resetFlight();
      void load(extra).then(() => draw());
      canvas.addEventListener("pointerdown", onPointer);
    },
    setOptions(options) {
      const extra = options as Extra;
      if (extra.tappyPlane) config = extra.tappyPlane;
      if (typeof extra.playAllRounds === "boolean") playAllRounds = extra.playAllRounds;
      if (typeof extra.parkingRoundIndex === "number" && extra.parkingRoundIndex !== roundIndex) {
        roundIndex = extra.parkingRoundIndex;
        resetFlight();
      }
      if (typeof extra.hintHandUrl === "string") hintHandUrl = extra.hintHandUrl;
      if (typeof extra.hintHandVisible === "boolean") hintHandVisible = extra.hintHandVisible;
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
      resetFlight();
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
