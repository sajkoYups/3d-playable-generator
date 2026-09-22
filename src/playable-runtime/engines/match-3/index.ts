import type { Background, Match3Config, Orientation } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { AudioBus } from "@/playable-runtime/audio/bus";
import { pickSoundUrl, PLAYABLE_SOUNDS } from "@/playable-runtime/audio/defaults";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";

const FALLBACK_MATCH3: Match3Config = {
  movesPerRound: 15,
  scoreTarget: 80,
  roundsToWin: 3,
  rewardPerRound: 5,
  rewardPrefix: "$",
  failEnabled: true,
  hintHandEnabled: true,
  hintDelayMs: 2500,
  scoreLabel: "Score",
  scoreChipBg: "#1e293b",
  scoreChipText: "#f8fafc",
  rewardTextColor: "#fbbf24",
  coinImageUrl: "/demo-assets/coin.svg",
  hudDisplay: "both",
  hudTransparent: false,
  sounds: { moveUrl: "", matchUrl: "", denyUrl: "", payoutUrl: "" },
};

type CanvasOptions = {
  background?: Background;
  pieceImages?: string[];
  match3?: Match3Config;
  orientation?: Orientation;
  hintHandUrl?: string;
  hintHandVisible?: boolean;
  audioBus?: AudioBus;
};

const SIZE = 6;
const COLORS = ["#f73778", "#11a9ed", "#75cf18", "#ffa51d", "#9a48ed"];
const HUD_H_BOTH = 52;
const HUD_H_SCORE = 36;
const HUD_H_COINS = 48;
const SWAP_MS = 180;
const CLEAR_MS = 160;
const FALL_MS = 200;
const HINT_CYCLE_MS = 900;
const PAYOUT_BURST_MS = 280;
const PAYOUT_COLLECT_MS = 720;
const PAYOUT_STAGGER_MS = 28;
const PAYOUT_HOLD_MS = 200;
const PAYOUT_COIN_COUNT = 18;
const PAYOUT_SPARKLE_COUNT = 14;

type Cell = { r: number; c: number };

type Anim =
  | { kind: "none" }
  | { kind: "swap"; a: Cell; b: Cell; t0: number; reverse: boolean }
  | { kind: "clear"; keys: string[]; t0: number }
  | { kind: "fall"; starts: number[][]; t0: number };

type PayoutCoin = {
  angle: number;
  dist: number;
  size: number;
  rot: number;
  rotSpeed: number;
  delay: number;
};

type PayoutSparkle = {
  angle: number;
  dist: number;
  life: number;
  size: number;
};

function hudHeight(cfg: Match3Config) {
  if (cfg.hudDisplay === "score") return HUD_H_SCORE;
  if (cfg.hudDisplay === "coins") return HUD_H_COINS;
  return HUD_H_BOTH;
}

/** Center a SIZE×SIZE board in the area below the HUD using integer pixels. */
function boardLayout(w: number, h: number, hudH: number) {
  const playTop = hudH;
  const playH = Math.max(0, h - playTop);
  const pad = 8;
  const maxSide = Math.max(0, Math.min(w - pad * 2, playH - pad * 2));
  const cell = Math.max(1, Math.floor(maxSide / SIZE));
  const board = cell * SIZE;
  const ox = Math.floor((w - board) / 2);
  const oy = Math.floor(playTop + (playH - board) / 2);
  return { board, cell, ox, oy };
}

function viewSize(el: HTMLElement, canvas: HTMLCanvasElement | null) {
  const rect = (canvas ?? el).getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width) || el.clientWidth || 1);
  const h = Math.max(1, Math.round(rect.height) || el.clientHeight || 1);
  return { w, h, rect };
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function cellKey(r: number, c: number) {
  return `${r},${c}`;
}

export function createMatch3Engine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let grid: number[][] = [];
  let selected: Cell | null = null;
  let score = 0;
  let moves = FALLBACK_MATCH3.movesPerRound;
  let round = 0;
  let earned = 0;
  let winCb: (() => void) | null = null;
  let loseCb: (() => void) | null = null;
  let running = false;
  let raf = 0;
  let busy = false;
  let anim: Anim = { kind: "none" };
  let rewardPopUntil = 0;
  let lastInputAt = 0;
  let hintPair: { a: Cell; b: Cell } | null = null;
  let payoutActive = false;
  let payoutT0 = 0;
  let payoutUntil = 0;
  let payoutFrom = 0;
  let payoutTo = 0;
  let payoutWin = false;
  let payoutCoins: PayoutCoin[] = [];
  let payoutSparkles: PayoutSparkle[] = [];

  let config: Match3Config = { ...FALLBACK_MATCH3 };
  let background: Background | undefined;
  let orientation: "portrait" | "landscape" = "portrait";
  let pieceImages: string[] = ["", "", "", "", ""];
  let hintHandUrl = "";
  let hintHandVisible = true;
  let bgImage: HTMLImageElement | null = null;
  let handImage: HTMLImageElement | null = null;
  let coinImage: HTMLImageElement | null = null;
  let pieceImgs: (HTMLImageElement | null)[] = [null, null, null, null, null];
  let loadToken = 0;
  let assets: Record<string, string> = {};
  let sfx: AudioBus | null = null;
  let sfxOwned = false;
  let unlockEl: HTMLElement | null = null;

  function randColor() {
    return Math.floor(Math.random() * COLORS.length);
  }

  function createGrid() {
    for (let attempt = 0; attempt < 40; attempt++) {
      grid = Array.from({ length: SIZE }, () =>
        Array.from({ length: SIZE }, () => randColor()),
      );
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          while (formsMatch(r, c)) grid[r][c] = randColor();
        }
      }
      if (findHint()) return;
    }
  }

  function formsMatch(r: number, c: number) {
    const v = grid[r][c];
    if (c >= 2 && grid[r][c - 1] === v && grid[r][c - 2] === v) return true;
    if (r >= 2 && grid[r - 1][c] === v && grid[r - 2][c] === v) return true;
    return false;
  }

  function findMatches(): string[] {
    const set = new Set<string>();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE - 2; c++) {
        const v = grid[r][c];
        if (v >= 0 && v === grid[r][c + 1] && v === grid[r][c + 2]) {
          set.add(cellKey(r, c));
          set.add(cellKey(r, c + 1));
          set.add(cellKey(r, c + 2));
        }
      }
    }
    for (let c = 0; c < SIZE; c++) {
      for (let r = 0; r < SIZE - 2; r++) {
        const v = grid[r][c];
        if (v >= 0 && v === grid[r + 1][c] && v === grid[r + 2][c]) {
          set.add(cellKey(r, c));
          set.add(cellKey(r + 1, c));
          set.add(cellKey(r + 2, c));
        }
      }
    }
    return [...set];
  }

  function swapCells(a: Cell, b: Cell) {
    const t = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = t;
  }

  function findHint(): { a: Cell; b: Cell } | null {
    const dirs = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
    ];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        for (const d of dirs) {
          const nr = r + d.dr;
          const nc = c + d.dc;
          if (nr >= SIZE || nc >= SIZE) continue;
          const a = { r, c };
          const b = { r: nr, c: nc };
          swapCells(a, b);
          const hits = findMatches();
          swapCells(a, b);
          if (hits.length) return { a, b };
        }
      }
    }
    return null;
  }

  function resetBoardOnly() {
    createGrid();
    selected = null;
    score = 0;
    moves = config.movesPerRound;
    anim = { kind: "none" };
    busy = false;
    hintPair = null;
    lastInputAt = performance.now();
  }

  function clearPayout() {
    payoutActive = false;
    payoutCoins = [];
    payoutSparkles = [];
    payoutWin = false;
    payoutUntil = 0;
    rewardPopUntil = 0;
  }

  function resolveSfx(url: string) {
    return resolveRuntimeUrl(url, assets) || url;
  }

  function wireSfx(cfg: Match3Config) {
    if (!sfx) return;
    const s = cfg.sounds;
    const urls: Record<string, string> = {
      move: resolveSfx(pickSoundUrl(s?.moveUrl, PLAYABLE_SOUNDS.swoosh)),
      match: resolveSfx(pickSoundUrl(s?.matchUrl, PLAYABLE_SOUNDS.match3Match)),
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

  function spawnPayout(from: number, to: number, willWin: boolean) {
    const t0 = performance.now();
    payoutActive = true;
    playCue("payout");
    payoutT0 = t0;
    payoutFrom = from;
    payoutTo = to;
    payoutWin = willWin;
    payoutCoins = [];
    payoutSparkles = [];
    for (let i = 0; i < PAYOUT_COIN_COUNT; i++) {
      payoutCoins.push({
        angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35,
        dist: 48 + Math.random() * 100,
        size: 18 + Math.random() * 16,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.018,
        delay: i * PAYOUT_STAGGER_MS + Math.random() * 20,
      });
    }
    for (let i = 0; i < PAYOUT_SPARKLE_COUNT; i++) {
      payoutSparkles.push({
        angle: Math.random() * Math.PI * 2,
        dist: 20 + Math.random() * 70,
        life: 280 + Math.random() * 280,
        size: 1.5 + Math.random() * 2.5,
      });
    }
    const lastDelay = (PAYOUT_COIN_COUNT - 1) * PAYOUT_STAGGER_MS + 20;
    payoutUntil = t0 + PAYOUT_BURST_MS + lastDelay + PAYOUT_COLLECT_MS + PAYOUT_HOLD_MS;
    rewardPopUntil = payoutUntil;
    busy = true;
    anim = { kind: "none" };
  }

  function displayedEarned(now: number) {
    if (!payoutActive) return earned;
    const start = payoutT0 + PAYOUT_BURST_MS;
    const end =
      start + (PAYOUT_COIN_COUNT - 1) * PAYOUT_STAGGER_MS + PAYOUT_COLLECT_MS;
    const t = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
    return payoutFrom + (payoutTo - payoutFrom) * easeOutCubic(t);
  }

  function completeRound() {
    const from = earned;
    earned += config.rewardPerRound;
    round += 1;
    spawnPayout(from, earned, round >= config.roundsToWin);
  }

  function finishPayout() {
    payoutActive = false;
    payoutCoins = [];
    payoutSparkles = [];
    rewardPopUntil = 0;
    if (payoutWin) {
      busy = false;
      winCb?.();
      return;
    }
    resetBoardOnly();
  }

  function onOutOfMoves() {
    if (config.failEnabled) {
      completeRound();
      return;
    }
    // No-fail mode: keep board + score, just refill moves
    moves = config.movesPerRound;
    selected = null;
    busy = false;
    anim = { kind: "none" };
    lastInputAt = performance.now();
  }

  /** Collapse empties downward and spawn new pieces from above. Returns per-cell fall distance. */
  function applyCollapse(): number[][] {
    const starts = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    for (let c = 0; c < SIZE; c++) {
      const kept: number[] = [];
      const keptFrom: number[] = [];
      for (let r = SIZE - 1; r >= 0; r--) {
        if (grid[r][c] >= 0) {
          kept.push(grid[r][c]);
          keptFrom.push(r);
        }
      }
      const final: number[] = Array(SIZE);
      const finalStart: number[] = Array(SIZE);
      let write = SIZE - 1;
      for (let i = 0; i < kept.length; i++) {
        final[write] = kept[i];
        finalStart[write] = keptFrom[i] - write;
        write--;
      }
      let spawnRow = -1;
      while (write >= 0) {
        final[write] = randColor();
        finalStart[write] = spawnRow - write;
        spawnRow--;
        write--;
      }
      for (let r = 0; r < SIZE; r++) {
        grid[r][c] = final[r];
        starts[r][c] = finalStart[r];
      }
    }
    return starts;
  }

  function beginClear(keys: string[]) {
    score += keys.length * 2;
    playCue("match", 80);
    anim = { kind: "clear", keys, t0: performance.now() };
  }

  function finishClear(keys: string[]) {
    for (const key of keys) {
      const [r, c] = key.split(",").map(Number);
      grid[r][c] = -1;
    }
    const starts = applyCollapse();
    anim = { kind: "fall", starts, t0: performance.now() };
  }

  function afterFallSettled() {
    const matches = findMatches();
    if (matches.length) {
      beginClear(matches);
      return;
    }
    anim = { kind: "none" };
    if (score >= config.scoreTarget) {
      completeRound();
      return;
    }
    busy = false;
    if (moves <= 0) onOutOfMoves();
  }

  function tickPayout(now: number) {
    if (payoutActive && now >= payoutUntil) finishPayout();
  }

  function tickAnim(now: number) {
    tickPayout(now);
    if (anim.kind === "swap") {
      const t = (now - anim.t0) / SWAP_MS;
      if (t >= 1) {
        if (anim.reverse) {
          swapCells(anim.a, anim.b);
          busy = false;
          anim = { kind: "none" };
        } else {
          const matches = findMatches();
          if (!matches.length) {
            playCue("deny");
            anim = {
              kind: "swap",
              a: anim.a,
              b: anim.b,
              t0: now,
              reverse: true,
            };
          } else {
            moves--;
            beginClear(matches);
          }
        }
      }
      return;
    }
    if (anim.kind === "clear") {
      if ((now - anim.t0) / CLEAR_MS >= 1) {
        finishClear(anim.keys);
      }
      return;
    }
    if (anim.kind === "fall") {
      if ((now - anim.t0) / FALL_MS >= 1) {
        anim = { kind: "none" };
        afterFallSettled();
      }
    }
  }

  function trySwap(a: Cell, b: Cell) {
    if (busy) return;
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return;
    busy = true;
    hintPair = null;
    swapCells(a, b);
    playCue("move");
    anim = { kind: "swap", a, b, t0: performance.now(), reverse: false };
  }

  async function applyOptions(options?: CanvasOptions) {
    if (!options) return;
    if (options.background) background = options.background;
    if (options.orientation) orientation = options.orientation;
    if (options.match3) {
      config = { ...FALLBACK_MATCH3, ...options.match3 };
      wireSfx(config);
    }
    if (typeof options.hintHandUrl === "string") hintHandUrl = options.hintHandUrl;
    if (typeof options.hintHandVisible === "boolean") hintHandVisible = options.hintHandVisible;
    if (options.pieceImages) {
      pieceImages = [...options.pieceImages];
      while (pieceImages.length < 5) pieceImages.push("");
      pieceImages = pieceImages.slice(0, 5);
    }

    const token = ++loadToken;
    const bgUrl = canvasBgUrl(background, orientation);

    const coinUrl = config.coinImageUrl || FALLBACK_MATCH3.coinImageUrl;

    const [nextBg, nextHand, nextCoin, ...nextPieces] = await Promise.all([
      background?.type === "image" && bgUrl ? loadImage(bgUrl) : Promise.resolve(null),
      hintHandUrl ? loadImage(hintHandUrl) : Promise.resolve(null),
      coinUrl ? loadImage(coinUrl) : Promise.resolve(null),
      ...pieceImages.map((url) => loadImage(url)),
    ]);

    if (token !== loadToken) return;
    bgImage = nextBg;
    handImage = nextHand;
    coinImage = nextCoin;
    pieceImgs = nextPieces;
  }

  function roundRect(
    x: number,
    y: number,
    rw: number,
    rh: number,
    radius: number,
  ) {
    if (!ctx) return;
    const r = Math.min(radius, rw / 2, rh / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, r);
    ctx.arcTo(x + rw, y + rh, x, y + rh, r);
    ctx.arcTo(x, y + rh, x, y, r);
    ctx.arcTo(x, y, x + rw, y, r);
    ctx.closePath();
  }

  function drawPiece(
    x: number,
    y: number,
    cell: number,
    idx: number,
    alpha = 1,
    scale = 1,
  ) {
    if (!ctx || idx < 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    const img = pieceImgs[idx];
    const pad = Math.max(1, Math.floor(cell * 0.1));
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, x + pad, y + pad, cell - pad * 2, cell - pad * 2);
    } else {
      ctx.fillStyle = COLORS[idx] || "#334155";
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCoinIcon(x: number, y: number, size: number) {
    if (!ctx) return;
    if (coinImage && coinImage.complete && coinImage.naturalWidth) {
      ctx.drawImage(coinImage, x, y, size, size);
    } else {
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function payoutPunch(now: number) {
    if (payoutActive && payoutUntil > payoutT0) {
      const u = Math.min(1, (now - payoutT0) / (payoutUntil - payoutT0));
      return 1 + 0.35 * Math.sin(u * Math.PI);
    }
    if (now < rewardPopUntil) {
      return 1 + 0.12 * Math.sin(((rewardPopUntil - now) / 700) * Math.PI);
    }
    return 1;
  }

  function coinFlight(
    p: PayoutCoin,
    now: number,
    ox: number,
    oy: number,
    tx: number,
    ty: number,
  ) {
    const t = now - payoutT0;
    const burstX = ox + Math.cos(p.angle) * p.dist;
    const burstY = oy + Math.sin(p.angle) * p.dist;
    const collectStart = PAYOUT_BURST_MS + p.delay;
    const collectEnd = collectStart + PAYOUT_COLLECT_MS;
    const rot = p.rot + p.rotSpeed * t;
    if (t < PAYOUT_BURST_MS) {
      const u = easeOutCubic(t / PAYOUT_BURST_MS);
      return {
        x: ox + (burstX - ox) * u,
        y: oy + (burstY - oy) * u,
        scale: 0.35 + u * 1.15,
        alpha: 0.4 + u * 0.6,
        rot,
      };
    }
    if (t < collectStart) {
      return {
        x: burstX,
        y: burstY + Math.sin((t - PAYOUT_BURST_MS) * 0.02) * 3,
        scale: 1.15,
        alpha: 1,
        rot,
      };
    }
    if (t < collectEnd) {
      const u = easeInOut(Math.min(1, (t - collectStart) / PAYOUT_COLLECT_MS));
      const cx = (burstX + tx) / 2 + (burstX - tx) * 0.12;
      const cy = Math.min(burstY, ty) - 50;
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

  function hudTarget(hudH: number) {
    const showScore = config.hudDisplay !== "coins";
    const showCoins = config.hudDisplay !== "score";
    if (showCoins) {
      const coinSize = showScore ? 16 : 24;
      return { x: 8 + coinSize / 2, y: showScore ? hudH - 14 : hudH / 2 };
    }
    ctx!.font = "600 11px system-ui";
    const scoreText = `${config.scoreLabel} ${score}/${config.scoreTarget}`;
    const scoreW = Math.ceil(ctx!.measureText(scoreText).width) + 20;
    const scoreH = 22;
    const scoreY = Math.floor((hudH - scoreH) / 2);
    return { x: 8 + scoreW / 2, y: scoreY + scoreH / 2 };
  }

  function drawHud(w: number, now: number) {
    const hudH = hudHeight(config);
    const showScore = config.hudDisplay !== "coins";
    const showCoins = config.hudDisplay !== "score";
    const totalReward = config.rewardPerRound * config.roundsToWin;
    const rewardLabel = `${config.rewardPrefix}${Math.round(displayedEarned(now))} / ${config.rewardPrefix}${totalReward}`;
    const scoreText = `${config.scoreLabel} ${score}/${config.scoreTarget}`;
    const movesText = `Moves ${moves}`;
    const roundText = `R${Math.min(round + 1, config.roundsToWin)}/${config.roundsToWin}`;
    const pop = payoutPunch(now);

    ctx!.textBaseline = "middle";
    ctx!.textAlign = "left";

    const shadow = config.hudTransparent;
    const shadowOn = () => {
      if (!shadow || !ctx) return;
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
    };
    const shadowOff = () => {
      if (!ctx) return;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    };

    let targetX = 24;
    let targetY = hudH / 2;

    if (showScore) {
      ctx!.font = "600 11px system-ui";
      const scorePadX = 10;
      const scoreW = Math.ceil(ctx!.measureText(scoreText).width) + scorePadX * 2;
      const scoreH = 22;
      const scoreX = 8;
      const scoreY = showCoins ? 6 : Math.floor((hudH - scoreH) / 2);
      const chipPop = showCoins ? 1 : pop;
      ctx!.save();
      ctx!.translate(scoreX + scoreW / 2, scoreY + scoreH / 2);
      ctx!.scale(chipPop, chipPop);
      ctx!.translate(-(scoreX + scoreW / 2), -(scoreY + scoreH / 2));
      if (payoutActive && !showCoins) {
        ctx!.globalAlpha = Math.min(0.5, (pop - 1) * 1.4);
        ctx!.fillStyle = "#fbbf24";
        ctx!.beginPath();
        ctx!.arc(scoreX + scoreW / 2, scoreY + scoreH / 2, 20 * pop, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }
      roundRect(scoreX, scoreY, scoreW, scoreH, 11);
      ctx!.fillStyle = config.scoreChipBg || "#1e293b";
      ctx!.fill();
      ctx!.strokeStyle = "rgba(255,255,255,0.18)";
      ctx!.lineWidth = 1;
      ctx!.stroke();
      ctx!.fillStyle = config.scoreChipText || "#f8fafc";
      ctx!.fillText(scoreText, scoreX + scorePadX, scoreY + scoreH / 2);
      ctx!.restore();

      shadowOn();
      ctx!.font = "11px system-ui";
      ctx!.fillStyle = "#cbd5e1";
      ctx!.fillText(movesText, scoreX + scoreW + 10, scoreY + scoreH / 2);
      if (!showCoins) {
        ctx!.textAlign = "right";
        ctx!.fillText(roundText, w - 8, hudH / 2);
        ctx!.textAlign = "left";
      }
      shadowOff();

      targetX = scoreX + scoreW / 2;
      targetY = scoreY + scoreH / 2;
    }

    if (showCoins) {
      const big = !showScore;
      const coinSize = big ? 24 : 16;
      const fontSize = big ? 15 : 11;
      const rewardY = showScore ? hudH - 14 : hudH / 2;
      if (payoutActive) {
        ctx!.save();
        ctx!.globalAlpha = Math.min(0.55, (pop - 1) * 1.4);
        ctx!.fillStyle = "#fbbf24";
        ctx!.beginPath();
        ctx!.arc(8 + coinSize / 2, rewardY, coinSize * 1.2 * pop, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }
      ctx!.save();
      ctx!.translate(8, rewardY);
      ctx!.scale(pop, pop);
      drawCoinIcon(0, -coinSize / 2, coinSize);
      shadowOn();
      ctx!.fillStyle = config.rewardTextColor || "#fbbf24";
      ctx!.font = `600 ${fontSize}px system-ui`;
      ctx!.textBaseline = "middle";
      ctx!.fillText(`${roundText}  ${rewardLabel}`, coinSize + 6, 0);
      shadowOff();
      ctx!.restore();
      targetX = 8 + coinSize / 2;
      targetY = rewardY;
    }

    return { hudH, targetX, targetY };
  }

  function drawPayoutFx(
    now: number,
    originX: number,
    originY: number,
    targetX: number,
    targetY: number,
  ) {
    if (!ctx || !payoutActive) return;

    for (const s of payoutSparkles) {
      const u = Math.min(1, (now - payoutT0) / s.life);
      if (u >= 1) continue;
      const e = easeOutCubic(u);
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = u < 0.35 ? "#ffffff" : "#fbbf24";
      ctx.beginPath();
      ctx.arc(
        originX + Math.cos(s.angle) * s.dist * e,
        originY + Math.sin(s.angle) * s.dist * e,
        s.size * (1.2 - u),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    for (const p of payoutCoins) {
      const f = coinFlight(p, now, originX, originY, targetX, targetY);
      if (f.alpha <= 0.02 || f.scale <= 0.02) continue;
      const size = p.size * f.scale;
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      drawCoinIcon(-size / 2, -size / 2, size);
      ctx.restore();
    }

    const dur = Math.max(1, payoutUntil - payoutT0);
    const p = Math.min(1, (now - payoutT0) / dur);
    const amount = `+${config.rewardPrefix}${config.rewardPerRound}`;
    let x = originX;
    let y = originY;
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
      x = originX + (targetX - originX) * e;
      y = originY + (targetY - originY) * e;
      scale = 1.5 * (1 - e * 0.75);
      alpha = 1 - e * 0.85;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.font = "800 28px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.strokeText(amount, 0, 0);
    ctx.fillStyle = config.rewardTextColor || "#fbbf24";
    ctx.fillText(amount, 0, 0);
    ctx.restore();
  }

  function draw() {
    if (!canvas || !ctx || !container) return;
    const now = performance.now();
    tickAnim(now);

    const { w, h } = viewSize(container, canvas);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const nextW = Math.max(1, Math.floor(w * dpr));
    const nextH = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    drawCanvasBackground(ctx, w, h, background, bgImage);

    const hudH = hudHeight(config);
    if (!config.hudTransparent) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, w, hudH);
    }

    const { board, cell, ox, oy } = boardLayout(w, h, hudH);
    const clearSet = anim.kind === "clear" ? new Set(anim.keys) : null;
    const clearT =
      anim.kind === "clear" ? Math.min(1, (now - anim.t0) / CLEAR_MS) : 0;
    const fallT =
      anim.kind === "fall" ? easeInOut(Math.min(1, (now - anim.t0) / FALL_MS)) : 1;
    const swapT =
      anim.kind === "swap" ? easeInOut(Math.min(1, (now - anim.t0) / SWAP_MS)) : 0;

    const skip = new Set<string>();
    if (anim.kind === "swap") {
      skip.add(cellKey(anim.a.r, anim.a.c));
      skip.add(cellKey(anim.b.r, anim.b.c));
    }

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const key = cellKey(r, c);
        if (skip.has(key)) continue;
        const idx = grid[r][c];
        if (idx < 0) continue;
        let x = ox + c * cell;
        let y = oy + r * cell;
        if (anim.kind === "fall" && anim.starts[r]) {
          y = oy + (r + anim.starts[r][c] * (1 - fallT)) * cell;
        }
        let alpha = 1;
        let scale = 1;
        if (clearSet?.has(key)) {
          alpha = 1 - clearT;
          scale = 1 - clearT * 0.55;
        }
        drawPiece(x, y, cell, idx, alpha, scale);
        if (selected && selected.r === r && selected.c === c && !busy) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.strokeRect(ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4);
        }
      }
    }

    if (anim.kind === "swap") {
      const ax = ox + anim.a.c * cell;
      const ay = oy + anim.a.r * cell;
      const bx = ox + anim.b.c * cell;
      const by = oy + anim.b.r * cell;
      const t = anim.reverse ? 1 - swapT : swapT;
      const aIdx = grid[anim.a.r][anim.a.c];
      const bIdx = grid[anim.b.r][anim.b.c];
      drawPiece(bx + (ax - bx) * t, by + (ay - by) * t, cell, aIdx);
      drawPiece(ax + (bx - ax) * t, ay + (by - ay) * t, cell, bIdx);
    }

    const showHint =
      config.hintHandEnabled &&
      hintHandVisible &&
      !busy &&
      running &&
      now - lastInputAt >= config.hintDelayMs;

    if (showHint) {
      if (!hintPair) hintPair = findHint();
      if (hintPair) {
        const cycle = ((now - lastInputAt - config.hintDelayMs) % HINT_CYCLE_MS) / HINT_CYCLE_MS;
        const ht = easeInOut(cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2);
        const ax = ox + hintPair.a.c * cell + cell / 2;
        const ay = oy + hintPair.a.r * cell + cell / 2;
        const bx = ox + hintPair.b.c * cell + cell / 2;
        const by = oy + hintPair.b.r * cell + cell / 2;
        const hx = ax + (bx - ax) * ht;
        const hy = ay + (by - ay) * ht;
        const hs = cell * 0.85;
        if (handImage && handImage.complete && handImage.naturalWidth) {
          ctx.drawImage(
            handImage,
            Math.round(hx - hs * 0.2),
            Math.round(hy - hs * 0.1),
            hs,
            hs,
          );
        } else {
          ctx.fillStyle = "rgba(248,250,252,0.95)";
          ctx.beginPath();
          ctx.arc(hx, hy, cell * 0.18, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    const target = hudTarget(hudH);
    drawPayoutFx(now, ox + board / 2, oy + board / 2, target.x, target.y);
    drawHud(w, now);
  }

  function loop() {
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function cellAtEvent(e: PointerEvent): Cell | null {
    if (!canvas || !container) return null;
    const { w, h, rect } = viewSize(container, canvas);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { cell, ox, oy } = boardLayout(w, h, hudHeight(config));
    const c = Math.floor((x - ox) / cell);
    const r = Math.floor((y - oy) / cell);
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return null;
    return { r, c };
  }

  let dragStart: Cell | null = null;

  function onPointerDown(e: PointerEvent) {
    if (!running || !canvas || !container || busy) return;
    lastInputAt = performance.now();
    hintPair = null;
    const cell = cellAtEvent(e);
    if (!cell) return;
    dragStart = cell;
    canvas.setPointerCapture?.(e.pointerId);
    if (!selected) selected = cell;
    else {
      trySwap(selected, cell);
      selected = null;
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!running || busy || !dragStart) {
      dragStart = null;
      return;
    }
    const end = cellAtEvent(e);
    const start = dragStart;
    dragStart = null;
    if (!end || (end.r === start.r && end.c === start.c)) return;
    trySwap(start, end);
    selected = null;
  }

  return {
    id: "match-3",
    name: "Match-3",
    initialize(ctxInit: EngineInitContext) {
      const extra = ctxInit as EngineInitContext & CanvasOptions;
      container = ctxInit.container;
      ctxInit.container.style.position = ctxInit.container.style.position || "relative";
      canvas = document.createElement("canvas");
      canvas.style.cssText =
        "position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none;";
      ctxInit.container.innerHTML = "";
      ctxInit.container.appendChild(canvas);
      ctx = canvas.getContext("2d");
      orientation = ctxInit.orientation;
      assets = ctxInit.assets || {};
      config = { ...FALLBACK_MATCH3, ...(extra.match3 || {}) };
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
      round = 0;
      earned = 0;
      clearPayout();
      resetBoardOnly();
      lastInputAt = performance.now();
      void applyOptions(extra).then(() => draw());
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
    },
    setOptions(options) {
      void applyOptions(options as CanvasOptions).then(() => draw());
    },
    start() {
      running = true;
      lastInputAt = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    reset() {
      round = 0;
      earned = 0;
      clearPayout();
      resetBoardOnly();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("pointerdown", onPointerDown);
      canvas?.removeEventListener("pointerup", onPointerUp);
      canvas?.removeEventListener("pointercancel", onPointerUp);
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
