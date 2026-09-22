import type { Background, Orientation, TappyPlaneConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame } from "@/playable-runtime/engines/canvas-setup";
import { CANVAS_HUD_H, drawCanvasHud, drawCoinIcon } from "@/playable-runtime/engines/canvas-hud";
import { drawHintHand } from "@/playable-runtime/engines/hint-hand";
import { TAPPY_SPRITES } from "@/playable-runtime/engines/kenney-2d-assets";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";
import { listTappyRounds } from "@/playable-runtime/engines/tappy-plane/rounds";
import { AudioBus } from "@/playable-runtime/audio/bus";
import { pickSoundUrl, PLAYABLE_SOUNDS } from "@/playable-runtime/audio/defaults";

type Extra = {
  background?: Background;
  orientation?: Orientation;
  tappyPlane?: TappyPlaneConfig;
  playAllRounds?: boolean;
  parkingRoundIndex?: number;
  hintHandUrl?: string;
  hintHandVisible?: boolean;
  audioBus?: AudioBus;
};

type RockCoin = { taken: boolean; offset: number };
type Rock = { x: number; gapY: number; gapSize: number; passed: boolean; coin: RockCoin | null };

type BurstPiece = {
  angle: number;
  dist: number;
  size: number;
  rot: number;
  rotSpeed: number;
  delay: number;
};
type BurstSparkle = { angle: number; dist: number; life: number; size: number };
type Burst = {
  t0: number;
  until: number;
  ox: number;
  oy: number;
  reward: number;
  coins: BurstPiece[];
  sparkles: BurstSparkle[];
};

const GROUND_ASPECT = 808 / 71;
/** Transparent / jagged grass at the top of the Kenney ground strip. */
const GROUND_SOLID = 0.34;
const PLANE_HIT_W = 0.48;
const PLANE_HIT_H = 0.36;
const ROCK_INSET_X = 0.3;
const BURST_COUNT = 12;
const BURST_SPARKLES = 10;
const BURST_MS = 220;
const COLLECT_MS = 560;
const STAGGER_MS = 22;
const HOLD_MS = 120;
const FINISH_HOLD_MS = 1100;

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

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
  let config: TappyPlaneConfig = {
    failEnabled: true,
    hintHandEnabled: true,
    hintDelayMs: 1800,
    coinImageUrl: "",
    hudTransparent: false,
    endless: true,
    rounds: [],
    sounds: { engineUrl: "", flapUrl: "", coinUrl: "", crashUrl: "" },
  };
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
  let sfx: AudioBus | null = null;
  let sfxOwned = false;
  let unlockEl: HTMLElement | null = null;
  let loadToken = 0;
  let y = 0.45;
  let vy = 0;
  let scroll = 0;
  let rocks: Rock[] = [];
  let started = false;
  let bursts: Burst[] = [];
  let spawnedCount = 0;
  let finishX: number | null = null;
  let finishCrossed = false;
  let finishT0 = 0;
  let finishHoldUntil = 0;

  function isEndless() {
    return config.endless === true;
  }

  function rounds() {
    return listTappyRounds(config);
  }
  function current() {
    const list = rounds();
    if (isEndless()) return list[0] ?? list[list.length - 1];
    return list[Math.max(0, Math.min(roundIndex, list.length - 1))] ?? list[0];
  }

  /** Endless ramps with pipes passed. Round mode uses the round’s own knobs. */
  function flightStats() {
    const round = current();
    if (!isEndless()) return { speed: round.speed, gapSize: round.gapSize };
    const n = passed;
    return {
      speed: Math.min(2.65, round.speed + 0.22 + n * 0.055),
      gapSize: Math.max(0.248, round.gapSize - 0.06 - n * 0.011),
    };
  }

  function groundBand(w: number, h: number) {
    const aspect =
      groundImg?.complete && groundImg.naturalWidth && groundImg.naturalHeight
        ? groundImg.naturalWidth / groundImg.naturalHeight
        : GROUND_ASPECT;
    const gH = Math.max(26, Math.min(Math.round(h * 0.14), Math.round(w / aspect)));
    return { gH, tileW: gH * aspect };
  }

  function playLayout() {
    const w = Math.max(1, container?.clientWidth || canvas?.clientWidth || 360);
    const h = Math.max(1, container?.clientHeight || canvas?.clientHeight || 640);
    const { gH, tileW } = groundBand(w, h);
    const playTop = CANVAS_HUD_H;
    const playH = Math.max(1, h - playTop - gH);
    return { w, h, gH, tileW, playTop, playH };
  }

  function planeSprite(w: number) {
    const pw = w * 0.16;
    return { pw, ph: pw * 0.72, px: w * 0.22 };
  }

  function planeHit(w: number, playTop: number, playH: number) {
    const { pw, ph, px } = planeSprite(w);
    const py = playTop + y * playH;
    const hitW = pw * PLANE_HIT_W;
    const hitH = ph * PLANE_HIT_H;
    return {
      pw,
      ph,
      px,
      py,
      hitX: px + (pw - hitW) * 0.42,
      hitY: py - hitH / 2,
      hitW,
      hitH,
    };
  }

  function coinWorld(rock: Rock, w: number, playTop: number, playH: number) {
    const rw = w * 0.16;
    const size = Math.max(16, w * 0.075);
    return {
      cx: rock.x * w + rw * 0.5,
      cy: playTop + (rock.gapY + rock.gapSize * (rock.coin?.offset ?? 0.5)) * playH,
      size,
    };
  }

  function resolveSfx(url: string) {
    return resolveRuntimeUrl(url, assets) || url;
  }

  function wireSfx(cfg: TappyPlaneConfig) {
    if (!sfx) return;
    const s = cfg.sounds;
    sfx.setExtraUrls({
      engine: resolveSfx(pickSoundUrl(s?.engineUrl, PLAYABLE_SOUNDS.planeLoop)),
      flap: resolveSfx(pickSoundUrl(s?.flapUrl, PLAYABLE_SOUNDS.swoosh)),
      coin: resolveSfx(pickSoundUrl(s?.coinUrl, PLAYABLE_SOUNDS.coin)),
      crash: resolveSfx(pickSoundUrl(s?.crashUrl, PLAYABLE_SOUNDS.crash)),
    });
  }

  function playCue(id: string, throttleMs = 0) {
    sfx?.playSfx(id, { throttleMs });
  }

  function onSfxUnlock() {
    void sfx?.unlock();
  }

  function startEngine() {
    sfx?.playLoop("engine", { volume: 0.12 });
  }

  function stopEngine() {
    sfx?.stopLoop("engine");
  }

  function resetFlight() {
    y = 0.45;
    vy = 0;
    scroll = 0;
    passed = 0;
    started = false;
    ended = false;
    rocks = [];
    bursts = [];
    spawnedCount = 0;
    finishX = null;
    finishCrossed = false;
    finishT0 = 0;
    finishHoldUntil = 0;
    lastInputAt = performance.now();
    stopEngine();
    spawn(0.62);
    spawn(1.38);
  }

  function spawn(x: number) {
    if (!isEndless() && spawnedCount >= current().gapsToWin) return;
    spawnedCount += 1;
    const { gapSize } = flightStats();
    const margin = isEndless() ? 0.11 : 0.14;
    const lo = margin;
    const hi = Math.max(lo + 0.02, 1 - gapSize - margin);
    rocks.push({
      x,
      gapY: lo + Math.random() * (hi - lo),
      gapSize,
      passed: false,
      coin: { taken: false, offset: 0.28 + Math.random() * 0.44 },
    });
  }

  function spawnBurst(ox: number, oy: number, reward: number) {
    const t0 = performance.now();
    const coins: BurstPiece[] = [];
    const sparkles: BurstSparkle[] = [];
    for (let i = 0; i < BURST_COUNT; i++) {
      coins.push({
        angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4,
        dist: 28 + Math.random() * 56,
        size: 12 + Math.random() * 10,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        delay: i * STAGGER_MS + Math.random() * 16,
      });
    }
    for (let i = 0; i < BURST_SPARKLES; i++) {
      sparkles.push({
        angle: Math.random() * Math.PI * 2,
        dist: 14 + Math.random() * 46,
        life: 240 + Math.random() * 240,
        size: 1.4 + Math.random() * 2.2,
      });
    }
    const lastDelay = (BURST_COUNT - 1) * STAGGER_MS + 16;
    bursts.push({
      t0,
      until: t0 + BURST_MS + lastDelay + COLLECT_MS + HOLD_MS,
      ox,
      oy,
      reward,
      coins,
      sparkles,
    });
  }

  function collectCoin(rock: Rock, w: number, playTop: number, playH: number) {
    if (!rock.coin || rock.coin.taken) return;
    rock.coin.taken = true;
    const { cx, cy } = coinWorld(rock, w, playTop, playH);
    const reward = Math.max(5, Math.round(current().coins / 4));
    earned += reward;
    spawnBurst(cx, cy, reward);
    playCue("coin");
  }

  function completeRound() {
    if (ended || isEndless()) return;
    earned += current().coins;
    const list = rounds();
    if (playAllRounds && roundIndex < list.length - 1) {
      roundIndex += 1;
      resetFlight();
      return;
    }
    ended = true;
    stopEngine();
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
    playCue("crash");
    stopEngine();
    loseCb?.();
  }

  function flap() {
    lastInputAt = performance.now();
    if (!started) startEngine();
    started = true;
    vy = -0.55;
    playCue("flap", 90);
  }

  function onPointer() {
    if (!running || ended) return;
    flap();
  }

  function tick(dt: number) {
    if (!started || ended) return;
    const now = performance.now();
    if (finishCrossed) {
      vy = 0;
      if (now >= finishHoldUntil) completeRound();
      return;
    }
    const stats = flightStats();
    const gravity = isEndless() ? 1.42 + Math.min(0.28, passed * 0.014) : 1.35;
    vy += gravity * dt;
    y += vy * dt;
    scroll += stats.speed * 0.28 * dt;
    for (const rock of rocks) rock.x -= stats.speed * 0.32 * dt;
    if (finishX != null) finishX -= stats.speed * 0.32 * dt;
    if (rocks.length && rocks[0].x < -0.35) {
      rocks.shift();
      const lastX = rocks.length ? rocks[rocks.length - 1].x : 1.15;
      const spacing = isEndless()
        ? Math.max(0.86, 1.06 - passed * 0.016) + Math.random() * 0.08
        : 1.2 + Math.random() * 0.2;
      spawn(lastX + spacing);
    }

    const { w, h, gH, playTop, playH } = playLayout();
    const { hitX, hitY, hitW, hitH } = planeHit(w, playTop, playH);
    const solidY = h - gH + gH * GROUND_SOLID;
    if (hitY <= playTop || hitY + hitH >= solidY) {
      crash();
      return;
    }

    const rw = w * 0.16;
    const inset = rw * ROCK_INSET_X;
    for (const rock of rocks) {
      if (!rock.passed && rock.x + 0.08 < 0.28) {
        rock.passed = true;
        passed += 1;
        if (!isEndless() && passed >= current().gapsToWin && finishX == null) {
          const lastX = rocks.reduce((m, r) => Math.max(m, r.x), 0.4);
          finishX = Math.max(0.92, lastX + 0.55);
        }
      }
      if (rock.coin && !rock.coin.taken) {
        const { cx, cy, size } = coinWorld(rock, w, playTop, playH);
        const r = size * 0.42;
        if (overlaps(hitX, hitY, hitW, hitH, cx - r, cy - r, r * 2, r * 2)) {
          collectCoin(rock, w, playTop, playH);
        }
      }
      const rx = rock.x * w + inset;
      const rockW = Math.max(4, rw - inset * 2);
      const gapY = playTop + rock.gapY * playH;
      const gapPx = rock.gapSize * playH;
      const topH = gapY - playTop;
      if (topH > 6 && overlaps(hitX, hitY, hitW, hitH, rx, playTop, rockW, topH)) {
        crash();
        return;
      }
      const botY = gapY + gapPx;
      const botH = playTop + playH - botY;
      if (botH > 6 && overlaps(hitX, hitY, hitW, hitH, rx, botY, rockW, botH)) {
        crash();
        return;
      }
    }
    if (finishX != null && !finishCrossed && finishX < 0.3) {
      finishCrossed = true;
      finishT0 = now;
      finishHoldUntil = now + FINISH_HOLD_MS;
      vy = 0;
    }
  }

  function pieceFlight(p: BurstPiece, burst: Burst, now: number, tx: number, ty: number) {
    const t = now - burst.t0;
    const burstX = burst.ox + Math.cos(p.angle) * p.dist;
    const burstY = burst.oy + Math.sin(p.angle) * p.dist;
    const collectStart = BURST_MS + p.delay;
    const collectEnd = collectStart + COLLECT_MS;
    const rot = p.rot + p.rotSpeed * t;
    if (t < BURST_MS) {
      const u = easeOutCubic(t / BURST_MS);
      return {
        x: burst.ox + (burstX - burst.ox) * u,
        y: burst.oy + (burstY - burst.oy) * u,
        scale: 0.35 + u * 1.15,
        alpha: 0.45 + u * 0.55,
        rot,
      };
    }
    if (t < collectStart) {
      return {
        x: burstX,
        y: burstY + Math.sin((t - BURST_MS) * 0.02) * 3,
        scale: 1.15,
        alpha: 1,
        rot,
      };
    }
    if (t < collectEnd) {
      const u = easeInOut(Math.min(1, (t - collectStart) / COLLECT_MS));
      const cx = (burstX + tx) / 2 + (burstX - tx) * 0.12;
      const cy = Math.min(burstY, ty) - 46;
      const iu = 1 - u;
      return {
        x: iu * iu * burstX + 2 * iu * u * cx + u * u * tx,
        y: iu * iu * burstY + 2 * iu * u * cy + u * u * ty,
        scale: 1.15 * (1 - u * 0.7),
        alpha: 1 - u * 0.2,
        rot,
      };
    }
    return { x: tx, y: ty, scale: 0, alpha: 0, rot };
  }

  function drawCheckeredFinish(w: number, h: number, playTop: number, playH: number, now: number) {
    if (!ctx || finishX == null) return;
    const poleX = finishX * w;
    const poleW = Math.max(4, w * 0.014);
    const tapeW = Math.max(10, w * 0.038);
    const flagW = Math.max(36, w * 0.2);
    const flagH = Math.max(28, playH * 0.26);
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(poleX, playTop, poleW, h - playTop - 2);
    const rows = 14;
    const cols = 2;
    const th = playH / rows;
    const tw = tapeW / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#fafafa" : "#111827";
        ctx.fillRect(poleX + poleW, playTop + r * th, tw + 0.5, th + 0.5);
      }
    }
    const fRows = 6;
    const fCols = 8;
    const cw = flagW / fCols;
    const ch = flagH / fRows;
    const flagY = playTop + 6;
    for (let r = 0; r < fRows; r++) {
      const wave = Math.sin(now / 150 + r * 0.5) * 6;
      for (let c = 0; c < fCols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#fafafa" : "#111827";
        const fx = poleX + poleW + tapeW + c * cw + wave * (c / Math.max(1, fCols - 1));
        ctx.fillRect(fx, flagY + r * ch, cw + 1, ch + 1);
      }
    }
  }

  function drawRoundClearBanner(w: number, h: number, now: number) {
    if (!ctx || !finishCrossed) return;
    const u = Math.min(1, (now - finishT0) / FINISH_HOLD_MS);
    let scale = 1;
    let alpha = 1;
    if (u < 0.18) {
      scale = 0.4 + easeOutCubic(u / 0.18) * 0.7;
      alpha = Math.min(1, u / 0.08);
    } else if (u > 0.78) {
      const e = easeInOut((u - 0.78) / 0.22);
      scale = 1 - e * 0.1;
      alpha = 1 - e;
    }
    const list = rounds();
    const label = roundIndex >= list.length - 1 ? "FINISH" : `ROUND ${roundIndex + 1}`;
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    const bw = Math.min(w * 0.78, 240);
    const bh = 64;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    const cells = 16;
    const cw = bw / cells;
    for (let i = 0; i < cells; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#fafafa" : "#111827";
      ctx.fillRect(-bw / 2 + i * cw, -bh / 2, cw + 0.4, 8);
      ctx.fillRect(-bw / 2 + i * cw, bh / 2 - 8, cw + 0.4, 8);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.font = "800 13px system-ui";
    ctx.strokeText("ROUND CLEAR", 0, -12);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("ROUND CLEAR", 0, -12);
    ctx.font = "800 22px system-ui";
    ctx.strokeText(label, 0, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, 0, 12);
    ctx.restore();
  }

  function hudPunch(now: number) {
    let pop = 1;
    for (const burst of bursts) {
      if (now >= burst.until) continue;
      const u = Math.min(1, (now - burst.t0) / Math.max(1, burst.until - burst.t0));
      pop = Math.max(pop, 1 + 0.38 * Math.sin(u * Math.PI));
    }
    return pop;
  }

  function drawBursts(
    now: number,
    tx: number,
    ty: number,
  ) {
    if (!ctx) return;
    bursts = bursts.filter((b) => now < b.until);
    for (const burst of bursts) {
      for (const s of burst.sparkles) {
        const u = Math.min(1, (now - burst.t0) / s.life);
        if (u >= 1) continue;
        const e = easeOutCubic(u);
        ctx.save();
        ctx.globalAlpha = 1 - u;
        ctx.fillStyle = u < 0.35 ? "#ffffff" : "#fbbf24";
        ctx.beginPath();
        ctx.arc(burst.ox + Math.cos(s.angle) * s.dist * e, burst.oy + Math.sin(s.angle) * s.dist * e, s.size * (1.2 - u), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (const p of burst.coins) {
        const f = pieceFlight(p, burst, now, tx, ty);
        if (f.alpha <= 0.02 || f.scale <= 0.02) continue;
        const size = p.size * f.scale;
        ctx.save();
        ctx.globalAlpha = f.alpha;
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        drawCoinIcon(ctx, coinImage, -size / 2, -size / 2, size);
        ctx.restore();
      }
      const dur = Math.max(1, burst.until - burst.t0);
      const p = Math.min(1, (now - burst.t0) / dur);
      const amount = `+${burst.reward}`;
      let x = burst.ox;
      let y = burst.oy;
      let scale = 1;
      let alpha = 1;
      if (p < 0.16) {
        scale = 0.2 + easeOutCubic(p / 0.16) * 1.7;
        alpha = Math.min(1, p / 0.08);
      } else if (p < 0.42) {
        scale = 1.9 - ((p - 0.16) / 0.26) * 0.4;
      } else if (p < 0.55) {
        scale = 1.5;
      } else {
        const e = easeInOut((p - 0.55) / 0.45);
        x = burst.ox + (tx - burst.ox) * e;
        y = burst.oy + (ty - burst.oy) * e;
        scale = 1.5 * (1 - e * 0.75);
        alpha = 1 - e * 0.85;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.font = "800 22px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.strokeText(amount, 0, 0);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(amount, 0, 0);
      ctx.restore();
    }
  }

  function draw() {
    const host = container;
    const gl = canvas;
    const c2d = ctx;
    if (!gl || !c2d || !host) return;
    const now = performance.now();
    const dt = Math.min(0.033, (now - (last || now)) / 1000);
    last = now;
    if (running) tick(dt);
    if (!container || !canvas || !ctx) return;
    const { w, h } = beginCanvasFrame(gl, c2d, host);
    const { gH, tileW, playTop, playH } = playLayout();
    if (background?.type === "transparent") {
      drawCanvasBackground(ctx, w, h, background, bgImage);
    } else if (skyImg && skyImg.complete) {
      const sw = skyImg.naturalWidth || w;
      const ox = -((scroll * 40) % sw);
      ctx.drawImage(skyImg, ox, playTop, sw, h - playTop);
      ctx.drawImage(skyImg, ox + sw, playTop, sw, h - playTop);
    } else drawCanvasBackground(ctx, w, h, background, bgImage);
    const list = rounds();
    const round = current();
    const endless = isEndless();
    const hud = drawCanvasHud(ctx, {
      w,
      roundText: endless
        ? "∞"
        : list.length > 1
          ? `R${Math.min(roundIndex + 1, list.length)}/${list.length}`
          : `${passed}/${round.gapsToWin}`,
      coinsText: `${earned}`,
      extraText: endless ? `${passed}` : list.length > 1 ? `${passed}/${round.gapsToWin}` : undefined,
      coinImage,
      transparent: config.hudTransparent,
      coinPop: hudPunch(now),
    });
    for (const rock of rocks) {
      const rx = rock.x * w;
      const rw = w * 0.16;
      const gapY = playTop + rock.gapY * playH;
      const gapPx = rock.gapSize * playH;
      const topH = gapY - playTop;
      if (topH > 1) {
        if (rockDown?.complete) ctx.drawImage(rockDown, rx, playTop, rw, topH);
        else {
          ctx.fillStyle = "#4b5563";
          ctx.fillRect(rx, playTop, rw, topH);
        }
      }
      const botY = gapY + gapPx;
      const botH = h - botY;
      if (botH > 1) {
        if (rockUp?.complete) ctx.drawImage(rockUp, rx, botY, rw, botH);
        else {
          ctx.fillStyle = "#4b5563";
          ctx.fillRect(rx, botY, rw, botH);
        }
      }
      if (rock.coin && !rock.coin.taken) {
        const { cx, cy, size } = coinWorld(rock, w, playTop, playH);
        const bob = Math.sin(now / 180) * 3;
        drawCoinIcon(ctx, coinImage, cx - size / 2, cy - size / 2 + bob, size);
      }
    }
    if (groundImg?.complete) {
      const gx = -((scroll * 80) % tileW);
      for (let x = gx - tileW; x < w; x += tileW) {
        ctx.drawImage(groundImg, x, h - gH, tileW, gH);
      }
    } else {
      ctx.fillStyle = "#65a30d";
      ctx.fillRect(0, h - gH, w, gH);
    }
    drawCheckeredFinish(w, h, playTop, playH, now);
    const frame = Math.floor(now / 120) % 3;
    const plane = planeImgs[frame] || planeImgs[0];
    const { pw, ph, px, py } = planeHit(w, playTop, playH);
    if (plane?.complete) ctx.drawImage(plane, px, py - ph / 2, pw, ph);
    else {
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(px, py - ph / 2, pw, ph);
    }
    drawBursts(now, hud.coinX, hud.coinY);
    drawRoundClearBanner(w, h, now);
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
    if (!running || !container || !canvas || !ctx) return;
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
      loadImage(media(config.coinImageUrl || "/demo-assets/coin.svg")),
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
      roundIndex = isEndless()
        ? 0
        : typeof extra.parkingRoundIndex === "number"
          ? extra.parkingRoundIndex
          : 0;
      hintHandUrl = extra.hintHandUrl || "";
      hintHandVisible = extra.hintHandVisible !== false;
      background = extra.background;
      if (extra.audioBus) {
        sfx = extra.audioBus;
        sfxOwned = false;
      } else {
        sfx = new AudioBus();
        sfxOwned = true;
      }
      wireSfx(config);
      unlockEl = ctxInit.container;
      unlockEl.addEventListener("pointerdown", onSfxUnlock, true);
      resetFlight();
      void load(extra).then(() => draw());
      canvas.addEventListener("pointerdown", onPointer);
    },
    setOptions(options) {
      const extra = options as Extra;
      const wasEndless = isEndless();
      if (extra.tappyPlane) {
        config = extra.tappyPlane;
        wireSfx(config);
      }
      if (typeof extra.playAllRounds === "boolean") playAllRounds = extra.playAllRounds;
      if (isEndless()) {
        if (roundIndex !== 0 || wasEndless !== isEndless()) {
          roundIndex = 0;
          resetFlight();
        }
      } else if (typeof extra.parkingRoundIndex === "number" && extra.parkingRoundIndex !== roundIndex) {
        roundIndex = extra.parkingRoundIndex;
        resetFlight();
      } else if (wasEndless !== isEndless()) {
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
      roundIndex = playAllRounds || isEndless() ? 0 : roundIndex;
      resetFlight();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("pointerdown", onPointer);
      unlockEl?.removeEventListener("pointerdown", onSfxUnlock, true);
      unlockEl = null;
      stopEngine();
      if (sfxOwned) sfx?.destroy();
      else sfx?.stopLoop();
      sfx = null;
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
