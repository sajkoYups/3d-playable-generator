import type { Parking2DConfig, ParkingCar } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame, pointerCanvasPos } from "@/playable-runtime/engines/canvas-setup";
import { PARKING_2D_SPRITES } from "@/playable-runtime/engines/parking-2d/sprites";
import {
  listParkingRounds,
  parkingCoinsTotal,
  repairParkingCars,
} from "@/playable-runtime/engines/parking-jam/layout";
import { slideParkingCar } from "@/playable-runtime/engines/parking-jam/rounds";
import { createPayoutHud, DEFAULT_COIN_URL } from "@/playable-runtime/engines/parking-jam/payout";
import { AudioBus } from "@/playable-runtime/audio/bus";
import { pickSoundUrl, PLAYABLE_SOUNDS } from "@/playable-runtime/audio/defaults";

type Art = {
  hero: HTMLImageElement | null;
  short: HTMLImageElement | null;
  long: HTMLImageElement | null;
  arrow: HTMLImageElement | null;
  asphalt: HTMLImageElement | null;
  grass: HTMLImageElement | null;
};

type Lot = {
  cell: number;
  originX: number;
  originY: number;
  cols: number;
  rows: number;
  exitRow: number;
  border: number;
  exitW: number;
};

type Anim = {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  duration: number;
  onDone?: () => void;
};

const EMPTY_ART: Art = { hero: null, short: null, long: null, arrow: null, asphalt: null, grass: null };

/** Share of the sprite that is painted, so padded art can be scaled to the same body size. */
function opaqueFill(img: HTMLImageElement): { w: number; h: number } {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return { w: 1, h: 1 };
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) return { w: 1, h: 1 };
  g.drawImage(img, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = g.getImageData(0, 0, w, h).data;
  } catch {
    return { w: 1, h: 1 };
  }
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! <= 16) continue;
      any = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!any) return { w: 1, h: 1 };
  return { w: (maxX - minX + 1) / w, h: (maxY - minY + 1) / h };
}

function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

function spriteUrl(override: string | undefined, fallback: string) {
  const trimmed = override?.trim();
  return trimmed || fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, fallback: string) {
  if (img && img.complete && img.naturalWidth) {
    const pattern = ctx.createPattern(img, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(x, y, w, h);
      return;
    }
  }
  ctx.fillStyle = fallback;
  ctx.fillRect(x, y, w, h);
}

export function createParking2DEngine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx2d: CanvasRenderingContext2D | null = null;
  let config: Parking2DConfig | null = null;
  let assets: Record<string, string> = {};
  let art: Art = { ...EMPTY_ART };
  let heroDrawScale = 1;
  let loadToken = 0;
  let viewW = 1;
  let viewH = 1;
  let state: ParkingCar[] = [];
  let moves = 0;
  let earned = 0;
  let roundIndex = 0;
  let playAllRounds = true;
  let lastEditorRoundIndex: number | null = null;
  let started = false;
  let ended = false;
  let failed = false;
  let running = false;
  let raf = 0;
  let last = 0;
  let anim: Anim | null = null;
  let selectedId: string | null = null;
  let drag: { x: number; y: number } | null = null;
  let winCb: () => void = () => undefined;
  let loseCb: () => void = () => undefined;
  let sfx: AudioBus | null = null;
  let sfxOwned = false;
  const hud = createPayoutHud();
  const scratch = document.createElement("canvas");
  const scratchCtx = scratch.getContext("2d");

  function liveRound(cfg = config!) {
    const rounds = listParkingRounds(cfg);
    const index = Math.max(0, Math.min(roundIndex, rounds.length - 1));
    return { round: rounds[index], index, total: rounds.length };
  }

  function media(ref: string) {
    if (!ref) return "";
    if (assets[ref]) return assets[ref];
    if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("data:")) return ref;
    if (Object.keys(assets).length > 0) return "";
    if (ref.startsWith("/")) return /%[0-9A-Fa-f]{2}/.test(ref) ? ref : encodeURI(ref);
    return ref;
  }

  function wireSfx(cfg: Parking2DConfig) {
    if (!sfx) return;
    const s = cfg.sounds;
    sfx.setExtraUrls({
      ambience: media(pickSoundUrl(s?.ambienceUrl, PLAYABLE_SOUNDS.trafficAmbience)),
      move: media(pickSoundUrl(s?.moveUrl, PLAYABLE_SOUNDS.swoosh)),
      coin: media(pickSoundUrl(s?.coinUrl, PLAYABLE_SOUNDS.coin)),
      payout: media(pickSoundUrl(s?.payoutUrl, PLAYABLE_SOUNDS.payout)),
    });
  }

  function playCue(id: string, throttleMs = 0) {
    sfx?.playSfx(id, { throttleMs });
  }

  function startAmbience(restart = false) {
    if (restart) sfx?.restartLoop("ambience", { volume: 0.22 });
    else sfx?.playLoop("ambience", { volume: 0.22 });
  }

  function syncHud() {
    if (!config) return;
    const url = media(config.coinImageUrl || DEFAULT_COIN_URL);
    hud.setCoinUrl(url || DEFAULT_COIN_URL);
    hud.setState(earned, parkingCoinsTotal(config));
  }

  function layoutKey(cfg: Parking2DConfig, idx: number) {
    const rounds = listParkingRounds(cfg);
    const i = Math.max(0, Math.min(idx, rounds.length - 1));
    const round = rounds[i];
    return JSON.stringify({
      i,
      cols: round.gridCols,
      rows: round.gridRows,
      hero: cfg.heroCarUrl,
      short: cfg.shortCarUrl,
      long: cfg.longCarUrl,
      arrow: cfg.exitArrowUrl,
      asphalt: cfg.asphaltUrl,
      grass: cfg.grassUrl,
      cars: round.cars.map((c) => `${c.id}:${c.col},${c.row},${c.length},${c.axis},${c.isHero ? 1 : 0}`),
    });
  }

  function resetBoard() {
    if (!config) return;
    const { round } = liveRound();
    state = repairParkingCars(
      round.cars.map((c) => ({ ...c })),
      round.gridCols,
      round.gridRows,
    );
    moves = 0;
    ended = false;
    failed = false;
    anim = null;
    selectedId = null;
    drag = null;
    syncHud();
  }

  async function loadArt() {
    if (!config) return;
    const token = ++loadToken;
    const cfg = config;
    const urls = {
      hero: media(spriteUrl(cfg.heroCarUrl, PARKING_2D_SPRITES.hero)),
      short: media(spriteUrl(cfg.shortCarUrl, PARKING_2D_SPRITES.short)),
      long: media(spriteUrl(cfg.longCarUrl, PARKING_2D_SPRITES.long)),
      arrow: media(spriteUrl(cfg.exitArrowUrl, PARKING_2D_SPRITES.arrow)),
      asphalt: media(spriteUrl(cfg.asphaltUrl, PARKING_2D_SPRITES.asphalt)),
      grass: media(spriteUrl(cfg.grassUrl, PARKING_2D_SPRITES.grass)),
    };
    const [hero, short, long, arrow, asphalt, grass] = await Promise.all([
      loadImage(urls.hero),
      loadImage(urls.short),
      loadImage(urls.long),
      loadImage(urls.arrow),
      loadImage(urls.asphalt),
      loadImage(urls.grass),
    ]);
    if (token !== loadToken) return;
    art = { hero, short, long, arrow, asphalt, grass };
    heroDrawScale = 1;
    if (hero && short) {
      const heroFill = opaqueFill(hero);
      const shortFill = opaqueFill(short);
      heroDrawScale = Math.max(shortFill.w / heroFill.w, shortFill.h / heroFill.h);
    }
  }

  function lotOf(w: number, h: number, cols: number, rows: number, exitRow: number): Lot {
    const hudH = 48;
    const margin = 2;
    const availW = Math.max(1, w - margin * 2);
    const availH = Math.max(1, h - hudH - margin);
    const borderRatio = 0.04;
    const exitRatio = 0.72;
    const cell = Math.max(
      8,
      Math.min(availW / (cols + borderRatio * 2 + exitRatio), availH / (rows + borderRatio * 2)),
    );
    const border = cell * borderRatio;
    const exitW = cell * exitRatio;
    const blockW = cols * cell + border * 2 + exitW;
    const blockH = rows * cell + border * 2;
    return {
      cell,
      originX: margin + (availW - blockW) / 2 + border,
      originY: hudH + (availH - blockH) / 2 + border,
      cols,
      rows,
      exitRow,
      border,
      exitW,
    };
  }

  function carCenter(car: ParkingCar, lot: Lot) {
    return {
      x: lot.originX + (car.col + (car.axis === "h" ? car.length / 2 : 0.5)) * lot.cell,
      y: lot.originY + (car.row + (car.axis === "v" ? car.length / 2 : 0.5)) * lot.cell,
    };
  }

  function drawTinted(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    tint: string | null,
  ) {
    if (!tint || !scratchCtx) {
      ctx.drawImage(img, dx, dy, dw, dh);
      return;
    }
    const w = Math.max(1, Math.ceil(dw));
    const h = Math.max(1, Math.ceil(dh));
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w;
      scratch.height = h;
    }
    scratchCtx.clearRect(0, 0, scratch.width, scratch.height);
    scratchCtx.globalCompositeOperation = "source-over";
    scratchCtx.drawImage(img, 0, 0, w, h);
    scratchCtx.globalCompositeOperation = "multiply";
    scratchCtx.fillStyle = tint;
    scratchCtx.fillRect(0, 0, w, h);
    scratchCtx.globalCompositeOperation = "destination-in";
    scratchCtx.drawImage(img, 0, 0, w, h);
    scratchCtx.globalCompositeOperation = "source-over";
    ctx.drawImage(scratch, dx, dy, dw, dh);
  }

  function drawCar(ctx: CanvasRenderingContext2D, car: ParkingCar, lot: Lot, at: { x: number; y: number }) {
    const pad = 0.97;
    const fit = car.isHero ? heroDrawScale : 1;
    const along = lot.cell * car.length * pad * fit;
    const across = lot.cell * pad * fit;
    const horizontal = car.axis === "h";
    const img = car.isHero ? art.hero : car.length >= 3 ? art.long : art.short;
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(horizontal ? Math.PI / 2 : 0);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, along * 0.04, along * 0.4, across * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    if (img) {
      drawTinted(ctx, img, -across / 2, -along / 2, across, along, car.isHero ? null : car.color);
    } else {
      ctx.fillStyle = car.color;
      roundRect(ctx, -across / 2, -along / 2, across, along, across * 0.2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLot(ctx: CanvasRenderingContext2D, w: number, h: number, lot: Lot) {
    fillImage(ctx, art.grass, 0, 0, w, h, "#4f8f38");
    const curb = lot.cell * 0.16;
    const gridW = lot.cols * lot.cell;
    const gridH = lot.rows * lot.cell;
    ctx.fillStyle = "#d7dbe0";
    roundRect(ctx, lot.originX - curb, lot.originY - curb, gridW + curb * 2, gridH + curb * 2, lot.cell * 0.28);
    ctx.fill();
    ctx.save();
    roundRect(ctx, lot.originX, lot.originY, gridW, gridH, lot.cell * 0.16);
    ctx.clip();
    fillImage(ctx, art.asphalt, lot.originX, lot.originY, gridW, gridH, "#3c4046");
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < lot.cols; c++) {
      const x = lot.originX + c * lot.cell;
      ctx.moveTo(x, lot.originY);
      ctx.lineTo(x, lot.originY + gridH);
    }
    for (let r = 1; r < lot.rows; r++) {
      const y = lot.originY + r * lot.cell;
      ctx.moveTo(lot.originX, y);
      ctx.lineTo(lot.originX + gridW, y);
    }
    ctx.stroke();
    ctx.restore();
    const gapY = lot.originY + lot.exitRow * lot.cell;
    const gapW = lot.exitW;
    const gridRight = lot.originX + gridW;
    ctx.save();
    ctx.beginPath();
    ctx.rect(gridRight - 2, gapY, gapW + 2, lot.cell);
    ctx.clip();
    fillImage(ctx, art.asphalt, gridRight - 2, gapY, gapW + 2, lot.cell, "#3c4046");
    ctx.restore();
    ctx.fillStyle = "#d7dbe0";
    ctx.fillRect(gridRight, gapY - curb, gapW, curb);
    ctx.fillRect(gridRight, gapY + lot.cell, gapW, curb);
    if (art.arrow) {
      const aw = Math.min(lot.cell * 0.62, gapW * 0.92);
      const ah = aw * 0.5;
      ctx.drawImage(art.arrow, gridRight + Math.max(0, gapW - aw) * 0.35, gapY + (lot.cell - ah) / 2, aw, ah);
    }
  }

  function draw() {
    if (!canvas || !ctx2d || !container || !config) return;
    const { w, h } = beginCanvasFrame(canvas, ctx2d, container);
    viewW = w;
    viewH = h;
    const { round } = liveRound();
    const exitRow = state.find((c) => c.isHero)?.row ?? round.cars.find((c) => c.isHero)?.row ?? 2;
    const lot = lotOf(w, h, round.gridCols, round.gridRows, exitRow);
    drawLot(ctx2d, w, h, lot);
    for (const car of state) {
      if (anim && anim.id === car.id) continue;
      drawCar(ctx2d, car, lot, carCenter(car, lot));
    }
    const slide = anim;
    if (slide) {
      const car = state.find((c) => c.id === slide.id);
      if (car) {
        const k = easeOutCubic(slide.t / slide.duration);
        drawCar(ctx2d, car, lot, {
          x: slide.fromX + (slide.toX - slide.fromX) * k,
          y: slide.fromY + (slide.toY - slide.fromY) * k,
        });
      }
    }
    const left = Math.max(0, round.movesLimit - moves);
    ctx2d.save();
    ctx2d.font = "600 13px system-ui, sans-serif";
    ctx2d.textAlign = "right";
    ctx2d.textBaseline = "middle";
    ctx2d.lineWidth = 3;
    ctx2d.strokeStyle = "rgba(0,0,0,0.45)";
    ctx2d.strokeText(`${left} moves`, w - 12, 24);
    ctx2d.fillStyle = "#f8fafc";
    ctx2d.fillText(`${left} moves`, w - 12, 24);
    if (failed) {
      ctx2d.textAlign = "center";
      ctx2d.font = "800 28px system-ui, sans-serif";
      ctx2d.strokeText("Out of moves", w / 2, h / 2);
      ctx2d.fillStyle = "#fbbf24";
      ctx2d.fillText("Out of moves", w / 2, h / 2);
    }
    ctx2d.restore();
  }

  function tickAnim(dt: number) {
    if (!anim) return;
    anim.t += dt;
    if (anim.t < anim.duration) return;
    const done = anim.onDone;
    anim = null;
    done?.();
  }

  function finish(kind: "win" | "lose") {
    if (ended) return;
    ended = true;
    started = false;
    failed = kind === "lose";
    if (kind === "lose") hud.cancel();
    if (kind === "win") winCb();
    else loseCb();
  }

  function completeRound() {
    if (!config || hud.busy()) return;
    const { round, index, total } = liveRound();
    const reward = round.coins;
    const from = earned;
    earned += reward;
    const hasNext = playAllRounds && index < total - 1;
    hud.setState(earned, parkingCoinsTotal(config));
    playCue("coin");
    playCue("payout");
    hud.startPayout({
      from,
      to: earned,
      reward,
      nextRound: hasNext ? index + 2 : null,
      onDone: (kind) => {
        if (kind === "next") {
          roundIndex = index + 1;
          resetBoard();
          return;
        }
        finish("win");
      },
    });
  }

  function hitCar(x: number, y: number) {
    if (!config) return null;
    const { round } = liveRound();
    const exitRow = state.find((c) => c.isHero)?.row ?? 2;
    const lot = lotOf(viewW, viewH, round.gridCols, round.gridRows, exitRow);
    for (let i = state.length - 1; i >= 0; i--) {
      const car = state[i];
      const c = carCenter(car, lot);
      const along = lot.cell * car.length * 0.9;
      const across = lot.cell * 0.9;
      const left = car.axis === "h" ? c.x - along / 2 : c.x - across / 2;
      const top = car.axis === "h" ? c.y - across / 2 : c.y - along / 2;
      const w = car.axis === "h" ? along : across;
      const h = car.axis === "h" ? across : along;
      if (x >= left && x <= left + w && y >= top && y <= top + h) return car;
    }
    return null;
  }

  function onDown(e: PointerEvent) {
    void sfx?.unlock();
    startAmbience();
    if (!canvas || !started || ended || anim || hud.busy()) return;
    const pos = pointerCanvasPos(e, canvas, viewW, viewH);
    const car = hitCar(pos.x, pos.y);
    if (!car) return;
    selectedId = car.id;
    drag = { x: e.clientX, y: e.clientY };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* pointer may already be gone */
    }
  }

  function onUp(e: PointerEvent) {
    if (!selectedId || !drag || !config || anim || ended) {
      selectedId = null;
      drag = null;
      return;
    }
    const car = state.find((c) => c.id === selectedId);
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    selectedId = null;
    drag = null;
    if (!car) return;
    let dCol = 0;
    let dRow = 0;
    if (car.axis === "h" && Math.abs(dx) > 18) dCol = dx > 0 ? 1 : -1;
    else if (car.axis === "v" && Math.abs(dy) > 18) dRow = dy > 0 ? 1 : -1;
    else return;
    const { round } = liveRound();
    const exitRow = car.isHero ? car.row : (state.find((c) => c.isHero)?.row ?? 2);
    const lot = lotOf(viewW, viewH, round.gridCols, round.gridRows, exitRow);
    const from = carCenter(car, lot);
    const result = slideParkingCar(state, car.id, dCol, dRow, round.gridCols, round.gridRows);
    if (result.kind === "blocked") return;
    state = result.cars;
    const moved = state.find((c) => c.id === car.id);
    if (!moved) return;
    const to = carCenter(moved, lot);
    if (result.kind === "exit") to.x += lot.cell * 1.7;
    playCue("move", 40);
    const limit = round.movesLimit;
    const kind = result.kind;
    anim = {
      id: car.id,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      t: 0,
      duration: Math.min(0.5, 0.14 * Math.max(1, result.cells + (kind === "exit" ? 1 : 0))),
      onDone: () => {
        if (kind === "exit") {
          state = state.filter((c) => c.id !== car.id);
          completeRound();
          return;
        }
        moves += 1;
        if (moves >= limit) finish("lose");
      },
    };
  }

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    tickAnim(dt);
    draw();
    hud.tick(now);
    raf = requestAnimationFrame(frame);
  }

  return {
    id: "parking-2d",
    name: "Parking Jam 2D",
    initialize(init) {
      const extra = init as EngineInitContext & {
        parking2d?: Parking2DConfig;
        playAllRounds?: boolean;
        parkingRoundIndex?: number;
        audioBus?: AudioBus;
      };
      container = init.container;
      assets = init.assets ?? {};
      config = extra.parking2d ?? null;
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      if (!config) {
        config = {
          heroCarUrl: "",
          shortCarUrl: "",
          longCarUrl: "",
          exitArrowUrl: "",
          asphaltUrl: "",
          grassUrl: "",
          movesLimit: 24,
          gridCols: 6,
          gridRows: 6,
          cars: [],
          rounds: [],
          coinImageUrl: "",
          sounds: { ambienceUrl: "", moveUrl: "", coinUrl: "", payoutUrl: "" },
        };
      }
      roundIndex = Math.max(0, Math.min(roundIndex, Math.max(0, listParkingRounds(config).length - 1)));
      lastEditorRoundIndex = roundIndex;
      if (extra.audioBus) {
        sfx = extra.audioBus;
        sfxOwned = false;
      } else {
        sfx = new AudioBus();
        sfxOwned = true;
      }
      wireSfx(config);
      const attached = attachPlayableCanvas(init.container);
      canvas = attached.canvas;
      ctx2d = attached.ctx;
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      hud.mount(init.container);
      resetBoard();
      void loadArt();
      draw();
    },
    start() {
      started = true;
      running = true;
      last = 0;
      startAmbience();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    pause() {
      started = false;
      running = false;
      cancelAnimationFrame(raf);
    },
    reset() {
      started = true;
      hud.cancel();
      earned = 0;
      if (playAllRounds) roundIndex = 0;
      resetBoard();
      if (!running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("pointerdown", onDown);
      canvas?.removeEventListener("pointerup", onUp);
      canvas?.removeEventListener("pointercancel", onUp);
      hud.destroy();
      if (sfxOwned) sfx?.destroy();
      else sfx?.stopLoop();
      sfx = null;
      art = { ...EMPTY_ART };
      loadToken += 1;
      canvas = null;
      ctx2d = null;
      container = null;
    },
    onWin(cb) {
      winCb = cb;
    },
    onLose(cb) {
      loseCb = cb;
    },
    setOptions(options) {
      const next = options.parking2d as Parking2DConfig | undefined;
      const prevKey = config ? layoutKey(config, roundIndex) : "";
      if (next) config = next;
      if (typeof options.playAllRounds === "boolean") playAllRounds = options.playAllRounds;
      if (options.assets && typeof options.assets === "object") {
        assets = options.assets as Record<string, string>;
      }
      if (config) wireSfx(config);
      if (typeof options.parkingRoundIndex === "number" && config) {
        const n = listParkingRounds(config).length;
        const nextIdx = Math.max(0, Math.min(Math.floor(options.parkingRoundIndex), n - 1));
        if (lastEditorRoundIndex !== null && nextIdx !== lastEditorRoundIndex) {
          hud.cancel();
          earned = 0;
          roundIndex = nextIdx;
        }
        lastEditorRoundIndex = nextIdx;
      }
      if (!config) return;
      const nextKey = layoutKey(config, roundIndex);
      if (!prevKey || prevKey !== nextKey) {
        void loadArt();
        resetBoard();
      } else {
        const roundCars = liveRound().round.cars;
        for (const live of state) {
          const spec = roundCars.find((c) => c.id === live.id);
          if (spec) live.color = spec.color;
        }
        syncHud();
      }
    },
    resize() {
      hud.resize();
      draw();
    },
  };
}
