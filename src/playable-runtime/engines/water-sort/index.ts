import type { Background, Orientation, WaterSortConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame, pointerCanvasPos } from "@/playable-runtime/engines/canvas-setup";
import {
  applyPour,
  buildLevel,
  canPour,
  isComplete,
  isSolved,
  type Tube,
} from "@/playable-runtime/engines/water-sort/rules";
import { hitTubeIndex, layoutTubes, type TubeRect } from "@/playable-runtime/engines/water-sort/layout";
import {
  DEFAULT_COLORS,
  colorAt,
  drawHint,
  drawSparkles,
  drawStream,
  drawTube,
  drawVignette,
  drawWaterSortHud,
  spawnSparkles,
  type Spark,
} from "@/playable-runtime/engines/water-sort/draw";
import {
  displayedEarned,
  drawPayoutFx,
  payoutDuration,
  payoutPunch,
  spawnPayoutBits,
  type PayoutCoin,
  type PayoutSparkle,
} from "@/playable-runtime/engines/water-sort/payout";
import { listWaterSortRounds } from "@/playable-runtime/engines/water-sort/rounds";
import { AudioBus } from "@/playable-runtime/audio/bus";
import { pickSoundUrl, PLAYABLE_SOUNDS } from "@/playable-runtime/audio/defaults";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";

type CanvasOptions = {
  background?: Background;
  waterSort?: WaterSortConfig;
  orientation?: Orientation;
  playAllRounds?: boolean;
  parkingRoundIndex?: number;
  audioBus?: AudioBus;
};

const FALLBACK: WaterSortConfig = {
  maxMoves: 40,
  colors: ["#e23d3d", "#2b6fdb", "#1aa35a", "#f0b429", "#9b4de0"],
  roundsToWin: 3,
  rewardPerRound: 5,
  rewardPrefix: "$",
  failEnabled: true,
  coinImageUrl: "/demo-assets/coin.svg",
  rewardTextColor: "#c48a1a",
  hudDisplay: "both",
  rounds: [
    { maxMoves: 40, coins: 5, colorCount: 3 },
    { maxMoves: 40, coins: 5, colorCount: 4 },
    { maxMoves: 40, coins: 5, colorCount: 5 },
  ],
  sounds: { pourUrl: "", denyUrl: "", payoutUrl: "" },
};

type PourAnim = {
  from: number;
  to: number;
  color: number;
  amount: number;
  visualFrom: Tube;
  visualTo: Tube;
  popped: number;
  started: number;
};

type Shake = { i: number; started: number };

const LIFT_MS = 130;
const MOVE_MS = 220;
const TILT_MS = 150;
const STREAM_UNIT_MS = 150;
const SETTLE_MS = 130;
const RETURN_MS = 210;
const SHAKE_MS = 280;
const SELECT_LIFT = 14;
const HINT = "Tap a tube, then another to pour";

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function pourTiming(amount: number) {
  const stream = STREAM_UNIT_MS * Math.max(1, amount);
  return {
    lift: LIFT_MS,
    move: MOVE_MS,
    tilt: TILT_MS,
    stream,
    settle: SETTLE_MS,
    ret: RETURN_MS,
    total: LIFT_MS + MOVE_MS + TILT_MS + stream + SETTLE_MS + RETURN_MS,
  };
}

function phaseAt(elapsed: number, amount: number) {
  const t = pourTiming(amount);
  let u = elapsed;
  if (u < t.lift) return { name: "lift" as const, p: u / t.lift, t };
  u -= t.lift;
  if (u < t.move) return { name: "move" as const, p: u / t.move, t };
  u -= t.move;
  if (u < t.tilt) return { name: "tilt" as const, p: u / t.tilt, t };
  u -= t.tilt;
  if (u < t.stream) return { name: "stream" as const, p: u / t.stream, t };
  u -= t.stream;
  if (u < t.settle) return { name: "settle" as const, p: u / t.settle, t };
  u -= t.settle;
  return { name: "return" as const, p: clamp01(u / t.ret), t };
}

export function createWaterSortEngine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let tubes: Tube[] = [];
  let selected: number | null = null;
  let winCb: (() => void) | null = null;
  let loseCb: (() => void) | null = null;
  let moves = 0;
  let colors = DEFAULT_COLORS.slice();
  let config: WaterSortConfig = { ...FALLBACK };
  let roundIndex = 0;
  let playAllRounds = true;
  let earned = 0;
  let running = false;
  let ended = false;
  let raf = 0;
  let viewW = 1;
  let viewH = 1;
  let rects: TubeRect[] = [];

  let background: Background | undefined;
  let orientation: Orientation = "portrait";
  let bgImage: HTMLImageElement | null = null;
  let coinImage: HTMLImageElement | null = null;
  let loadToken = 0;
  let assets: Record<string, string> = {};
  let sfx: AudioBus | null = null;
  let sfxOwned = false;
  let unlockEl: HTMLElement | null = null;

  let pour: PourAnim | null = null;
  let shake: Shake | null = null;
  let sparks: Spark[] = [];
  let showHint = true;
  let hintAlpha = 1;

  let payoutActive = false;
  let payoutWin = false;
  let payoutT0 = 0;
  let payoutUntil = 0;
  let payoutFrom = 0;
  let payoutTo = 0;
  let payoutOriginX = 0;
  let payoutOriginY = 0;
  let payoutCoins: PayoutCoin[] = [];
  let payoutSparkles: PayoutSparkle[] = [];
  let rewardPopUntil = 0;

  function rounds() {
    return listWaterSortRounds(config);
  }

  function current() {
    const list = rounds();
    return list[Math.max(0, Math.min(roundIndex, list.length - 1))] || {
      maxMoves: 40,
      coins: 5,
      colorCount: 5,
    };
  }

  function colorCount() {
    const n = current().colorCount || 5;
    return Math.min(5, Math.max(2, Math.min(n, colors.length || 5)));
  }

  function maxMoves() {
    return current().maxMoves || config.maxMoves || 40;
  }

  function roundReward() {
    return current().coins;
  }

  function layersFor(i: number): Tube {
    if (pour) {
      if (i === pour.from) return pour.visualFrom;
      if (i === pour.to) return pour.visualTo;
    }
    return tubes[i] || [];
  }

  function spawnPayout(from: number, to: number, willWin: boolean, origin: { x: number; y: number }) {
    const t0 = performance.now();
    const bits = spawnPayoutBits();
    payoutActive = true;
    payoutWin = willWin;
    payoutT0 = t0;
    payoutFrom = from;
    payoutTo = to;
    payoutOriginX = origin.x;
    payoutOriginY = origin.y;
    payoutCoins = bits.coins;
    payoutSparkles = bits.sparkles;
    payoutUntil = t0 + payoutDuration();
    rewardPopUntil = payoutUntil;
  }

  function resolveSfx(url: string) {
    return resolveRuntimeUrl(url, assets) || url;
  }

  function wireSfx(cfg: WaterSortConfig) {
    if (!sfx) return;
    const s = cfg.sounds;
    const urls: Record<string, string> = {
      pour: resolveSfx(pickSoundUrl(s?.pourUrl, PLAYABLE_SOUNDS.pour)),
      payout: resolveSfx(pickSoundUrl(s?.payoutUrl, PLAYABLE_SOUNDS.payout)),
    };
    const deny = s?.denyUrl?.trim();
    if (deny) urls.deny = resolveSfx(deny);
    sfx.setExtraUrls(urls);
  }

  function playCue(id: string, throttleMs = 0) {
    sfx?.playSfx(id, { throttleMs });
  }

  function onSfxUnlock() {
    void sfx?.unlock();
  }

  function completeRound(origin: { x: number; y: number }) {
    const from = earned;
    const reward = roundReward();
    earned += reward;
    const list = rounds();
    const last = !playAllRounds || roundIndex >= list.length - 1;
    if (!last) roundIndex += 1;
    playCue("payout");
    spawnPayout(from, earned, last, origin);
  }

  function finishPayout() {
    payoutActive = false;
    payoutCoins = [];
    payoutSparkles = [];
    rewardPopUntil = 0;
    if (payoutWin) {
      ended = true;
      queueMicrotask(() => winCb?.());
      return;
    }
    resetBoard();
  }

  function finishPour() {
    if (!pour) return;
    const destIndex = pour.to;
    applyPour(pour.from, pour.to, tubes);
    moves++;
    showHint = false;
    if (isComplete(tubes[destIndex])) {
      const rect = rects[destIndex];
      if (rect) sparks.push(...spawnSparkles(rect, performance.now()));
    }
    pour = null;
    selected = null;
    if (isSolved(tubes)) {
      const rect = rects[destIndex];
      completeRound({
        x: rect ? rect.x + rect.w / 2 : viewW / 2,
        y: rect ? rect.y + rect.h / 2 : viewH / 2,
      });
    } else if (moves >= maxMoves()) {
      if (config.failEnabled) {
        ended = true;
        queueMicrotask(() => loseCb?.());
      } else {
        moves = 0;
      }
    }
  }

  async function applyOptions(options?: CanvasOptions) {
    if (!options) return;
    if (options.background) background = options.background;
    if (options.orientation) orientation = options.orientation;
    if (typeof options.playAllRounds === "boolean") playAllRounds = options.playAllRounds;
    if (options.waterSort) {
      config = { ...FALLBACK, ...config, ...options.waterSort };
      if (config.colors?.length) colors = config.colors;
      wireSfx(config);
    }
    if (typeof options.parkingRoundIndex === "number") {
      const list = rounds();
      const nextIdx = Math.max(0, Math.min(Math.floor(options.parkingRoundIndex), Math.max(0, list.length - 1)));
      if (nextIdx !== roundIndex) {
        roundIndex = nextIdx;
        resetBoard();
      }
    }
    const token = ++loadToken;
    const bgUrl = canvasBgUrl(background, orientation);
    const coinUrl = config.coinImageUrl || FALLBACK.coinImageUrl;
    const [nextBg, nextCoin] = await Promise.all([
      background?.type === "image" && bgUrl ? loadImage(bgUrl) : Promise.resolve(null),
      coinUrl ? loadImage(coinUrl) : Promise.resolve(null),
    ]);
    if (token !== loadToken || !ctx || !canvas) return;
    bgImage = nextBg;
    coinImage = nextCoin;
  }

  function mouthHover(from: TubeRect, to: TubeRect) {
    const pourRight = to.x + to.w / 2 >= from.x + from.w / 2;
    const mouthX = Math.max(
      from.w * 0.4,
      Math.min(viewW - from.w * 0.4, to.x + to.w / 2 + (pourRight ? -from.w * 0.12 : from.w * 0.12)),
    );
    const mouthY = Math.max(rects[0] ? rects[0].y - 10 : 40, to.y - 6);
    return { mouthX, mouthY, pourRight };
  }

  function draw() {
    const surface = ctx;
    const el = canvas;
    const host = container;
    if (!el || !surface || !host) return;
    const { w, h } = beginCanvasFrame(el, surface, host);
    viewW = w;
    viewH = h;
    const now = performance.now();
    const board = layoutTubes(tubes.length, w, h, orientation);
    rects = board.rects;

    drawCanvasBackground(surface, w, h, background, bgImage);
    drawVignette(surface, w, h);

    if (payoutActive && now >= payoutUntil) finishPayout();

    if (showHint) hintAlpha = Math.min(1, hintAlpha + 0.08);
    else hintAlpha = Math.max(0, hintAlpha - 0.08);
    if (hintAlpha > 0.02) {
      drawHint(surface, w, board.hudH + 18, HINT, hintAlpha);
    }

    const shownEarned = payoutActive ? displayedEarned(now, payoutT0, payoutFrom, payoutTo) : earned;
    const list = rounds();
    const totalReward = list.reduce((sum, item) => sum + item.coins, 0);
    const display = config.hudDisplay || "both";
    const hud = drawWaterSortHud(surface, {
      w,
      hudH: board.hudH,
      moves,
      maxMoves: maxMoves(),
      round: roundIndex,
      roundsToWin: Math.max(1, list.length),
      earnedLabel: `${config.rewardPrefix}${Math.round(shownEarned)} / ${config.rewardPrefix}${totalReward}`,
      rewardTextColor: config.rewardTextColor || "#c48a1a",
      coinImage,
      punch: payoutPunch(now, payoutT0, payoutUntil, rewardPopUntil, payoutActive),
      payoutActive,
      showMoves: display !== "coins",
      showCoins: display !== "score",
    });

    if (shake && now - shake.started > SHAKE_MS) shake = null;
    sparks = sparks.filter((s) => now - s.born < s.life);

    let pourPhase: ReturnType<typeof phaseAt> | null = null;
    if (pour) {
      const elapsed = now - pour.started;
      pourPhase = phaseAt(elapsed, pour.amount);
      if (pourPhase.name === "stream") {
        const want = Math.min(pour.amount, Math.floor(pourPhase.p * pour.amount + 0.0001));
        while (pour.popped < want) {
          pour.visualFrom.pop();
          pour.visualTo.push(pour.color);
          pour.popped++;
        }
      }
      if (elapsed >= pourPhase.t.total) {
        while (pour.popped < pour.amount) {
          pour.visualFrom.pop();
          pour.visualTo.push(pour.color);
          pour.popped++;
        }
        finishPour();
        pourPhase = null;
        if (!ctx) return;
      }
    }

    const pouringFrom = pour?.from ?? -1;
    const sourceRect = pouringFrom >= 0 ? rects[pouringFrom] : null;
    const destRect = pour ? rects[pour.to] : null;

    rects.forEach((rect) => {
      if (rect.i === pouringFrom) return;
      const shakeX =
        shake && shake.i === rect.i
          ? Math.sin(((now - shake.started) / SHAKE_MS) * Math.PI * 8) * 7 * (1 - (now - shake.started) / SHAKE_MS)
          : 0;
      const lift = selected === rect.i && !pour ? SELECT_LIFT : 0;
      surface.save();
      surface.translate(shakeX, -lift);
      drawTube(surface, {
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        layers: layersFor(rect.i),
        colors,
        selected: selected === rect.i && !pour,
        complete: isComplete(layersFor(rect.i)),
      });
      surface.restore();
    });

    if (pour && pourPhase && sourceRect && destRect) {
      const hover = mouthHover(sourceRect, destRect);
      const restMouthX = sourceRect.x + sourceRect.w / 2;
      const restMouthY = sourceRect.y;
      let moveT = 0;
      let liftT = 0;
      let tiltT = 0;
      if (pourPhase.name === "lift") {
        liftT = easeOutCubic(pourPhase.p);
      } else if (pourPhase.name === "move") {
        liftT = 1;
        moveT = easeInOut(pourPhase.p);
      } else if (pourPhase.name === "tilt" || pourPhase.name === "stream") {
        liftT = 1;
        moveT = 1;
        tiltT = pourPhase.name === "tilt" ? easeOutCubic(pourPhase.p) : 1;
      } else if (pourPhase.name === "settle") {
        liftT = 1;
        moveT = 1;
        tiltT = 1 - easeInOut(pourPhase.p);
      } else {
        liftT = 1 - easeInOut(pourPhase.p);
        moveT = 1 - easeInOut(pourPhase.p);
        tiltT = 0;
      }
      const mouthX = restMouthX + (hover.mouthX - restMouthX) * moveT;
      const mouthY = restMouthY - SELECT_LIFT * liftT + (hover.mouthY - (restMouthY - SELECT_LIFT)) * moveT;
      const tilt = (hover.pourRight ? 0.72 : -0.72) * tiltT;
      if (pourPhase.name === "stream" && pour) {
        const destMouthX = destRect.x + destRect.w / 2;
        const destMouthY = destRect.y + 4;
        const lipX = mouthX + Math.sin(tilt) * (sourceRect.w * 0.42);
        const lipY = mouthY + Math.abs(Math.sin(tilt)) * 6;
        drawStream(
          surface,
          lipX,
          lipY,
          destMouthX,
          destMouthY,
          colorAt(colors, pour.color),
          Math.max(5, sourceRect.w * 0.16),
          0.6 + 0.4 * Math.sin(pourPhase.p * Math.PI),
        );
      }
      surface.save();
      surface.translate(mouthX, mouthY);
      surface.rotate(tilt);
      drawTube(surface, {
        x: -sourceRect.w / 2,
        y: 0,
        w: sourceRect.w,
        h: sourceRect.h,
        layers: layersFor(sourceRect.i),
        colors,
        selected: true,
        complete: false,
      });
      surface.restore();
    }

    drawSparkles(surface, sparks, now);

    if (payoutActive) {
      drawPayoutFx(surface, {
        now,
        t0: payoutT0,
        until: payoutUntil,
        originX: payoutOriginX,
        originY: payoutOriginY,
        targetX: hud.targetX,
        targetY: hud.targetY,
        coins: payoutCoins,
        sparkles: payoutSparkles,
        coinImage,
        amount: `+${config.rewardPrefix}${Math.round(payoutTo - payoutFrom)}`,
        rewardTextColor: config.rewardTextColor || "#c48a1a",
      });
    }
  }

  function loop() {
    if (!running || !ctx) return;
    draw();
    if (running && ctx) raf = requestAnimationFrame(loop);
  }

  function onPointer(e: PointerEvent) {
    if (!running || ended || !canvas || pour || payoutActive) return;
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = pointerCanvasPos(e, canvas, viewW, viewH);
    const i = hitTubeIndex(x, y, rects);
    if (i < 0) return;

    if (selected === null) {
      if (!tubes[i].length) return;
      selected = i;
      return;
    }
    if (selected === i) {
      selected = null;
      return;
    }
    const legal = canPour(selected, i, tubes);
    if (legal) {
      pour = {
        from: selected,
        to: i,
        color: legal.color,
        amount: legal.count,
        visualFrom: tubes[selected].slice(),
        visualTo: tubes[i].slice(),
        popped: 0,
        started: performance.now(),
      };
      playCue("pour");
      return;
    }
    shake = { i, started: performance.now() };
    playCue("deny");
    if (tubes[i].length) selected = i;
  }

  function resetBoard() {
    tubes = buildLevel(colorCount());
    selected = null;
    moves = 0;
    ended = false;
    pour = null;
    shake = null;
    sparks = [];
    showHint = true;
    hintAlpha = 1;
  }

  function resetRun() {
    earned = 0;
    payoutActive = false;
    payoutWin = false;
    payoutCoins = [];
    payoutSparkles = [];
    rewardPopUntil = 0;
    resetBoard();
  }

  return {
    id: "water-sort",
    name: "Water Sort",
    initialize(ctxInit: EngineInitContext) {
      const extra = ctxInit as EngineInitContext & CanvasOptions;
      container = ctxInit.container;
      const attached = attachPlayableCanvas(ctxInit.container);
      canvas = attached.canvas;
      ctx = attached.ctx;
      viewW = Math.max(1, ctxInit.container.clientWidth);
      viewH = Math.max(1, ctxInit.container.clientHeight);
      orientation = ctxInit.orientation;
      assets = ctxInit.assets || {};
      if (extra.waterSort) {
        config = { ...FALLBACK, ...extra.waterSort };
        if (config.colors?.length) colors = config.colors;
      }
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
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
      resetRun();
      void applyOptions(extra).then(() => {
        if (ctx) draw();
      });
      canvas.addEventListener("pointerdown", onPointer);
    },
    setOptions(options) {
      void applyOptions(options as CanvasOptions).then(() => {
        if (ctx) draw();
      });
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
      roundIndex = playAllRounds ? 0 : roundIndex;
      resetRun();
    },
    destroy() {
      running = false;
      ended = true;
      pour = null;
      loadToken++;
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("pointerdown", onPointer);
      unlockEl?.removeEventListener("pointerdown", onSfxUnlock, true);
      unlockEl = null;
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
