export const DEFAULT_COIN_URL = "/coin.svg";

const MAX_DPR = 2;
const PAYOUT_BURST_MS = 280;
const PAYOUT_COLLECT_MS = 720;
const PAYOUT_STAGGER_MS = 28;
const PAYOUT_HOLD_MS = 200;
const PAYOUT_COIN_COUNT = 18;
const PAYOUT_SPARKLE_COUNT = 14;
const BANNER_MS = 1200;
const HUD_H = 48;

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

type DoneKind = "next" | "win";

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

function loadImage(url: string, onLoad: (img: HTMLImageElement | null) => void) {
  if (!url) {
    onLoad(null);
    return;
  }
  const img = new Image();
  img.onload = () => onLoad(img);
  img.onerror = () => onLoad(null);
  img.src = url;
}

export type PayoutHud = {
  mount(container: HTMLElement): void;
  setCoinUrl(url: string): void;
  setState(earned: number, total: number): void;
  busy(): boolean;
  startPayout(opts: {
    from: number;
    to: number;
    reward: number;
    nextRound: number | null;
    onDone: (kind: DoneKind) => void;
  }): void;
  cancel(): void;
  tick(now: number): void;
  resize(): void;
  destroy(): void;
};

export function createPayoutHud(): PayoutHud {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let coinImage: HTMLImageElement | null = null;
  let coinUrl = DEFAULT_COIN_URL;
  let loadGen = 0;
  let earned = 0;
  let total = 0;
  let payoutActive = false;
  let payoutT0 = 0;
  let payoutUntil = 0;
  let payoutFrom = 0;
  let payoutTo = 0;
  let payoutReward = 0;
  let payoutCoins: PayoutCoin[] = [];
  let payoutSparkles: PayoutSparkle[] = [];
  let bannerRound: number | null = null;
  let bannerT0 = 0;
  let bannerUntil = 0;
  let pendingNextRound: number | null = null;
  let onDone: ((kind: DoneKind) => void) | null = null;
  let pendingKind: DoneKind = "win";

  function viewSize() {
    const el = container;
    if (!el) return { w: 1, h: 1 };
    const rect = (canvas ?? el).getBoundingClientRect();
    return {
      w: Math.max(1, Math.round(rect.width) || el.clientWidth || 1),
      h: Math.max(1, Math.round(rect.height) || el.clientHeight || 1),
    };
  }

  function clearFx() {
    payoutActive = false;
    payoutCoins = [];
    payoutSparkles = [];
    payoutUntil = 0;
    bannerRound = null;
    bannerUntil = 0;
    pendingNextRound = null;
    onDone = null;
  }

  function finishPhase() {
    const cb = onDone;
    const kind = pendingKind;
    clearFx();
    cb?.(kind);
  }

  function displayedEarned(now: number) {
    if (!payoutActive) return earned;
    const start = payoutT0 + PAYOUT_BURST_MS;
    const end = start + (PAYOUT_COIN_COUNT - 1) * PAYOUT_STAGGER_MS + PAYOUT_COLLECT_MS;
    const t = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
    return payoutFrom + (payoutTo - payoutFrom) * easeOutCubic(t);
  }

  function punch(now: number) {
    if (payoutActive && payoutUntil > payoutT0) {
      const u = Math.min(1, (now - payoutT0) / (payoutUntil - payoutT0));
      return 1 + 0.35 * Math.sin(u * Math.PI);
    }
    return 1;
  }

  function drawCoin(x: number, y: number, size: number) {
    if (!ctx) return;
    if (coinImage && coinImage.complete && coinImage.naturalWidth) {
      ctx.drawImage(coinImage, x, y, size, size);
      return;
    }
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function coinFlight(p: PayoutCoin, now: number, ox: number, oy: number, tx: number, ty: number) {
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
      return { x: burstX, y: burstY + Math.sin((t - PAYOUT_BURST_MS) * 0.02) * 3, scale: 1.15, alpha: 1, rot };
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

  function drawHud(w: number, now: number) {
    if (!ctx) return { x: 20, y: HUD_H / 2 };
    const pop = punch(now);
    const coinSize = 24;
    const rewardY = HUD_H / 2;
    const label = `${Math.round(displayedEarned(now))} / ${total}`;
    if (payoutActive) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, (pop - 1) * 1.4);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(8 + coinSize / 2, rewardY, coinSize * 1.2 * pop, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(8, rewardY);
    ctx.scale(pop, pop);
    drawCoin(0, -coinSize / 2, coinSize);
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(label, coinSize + 6, 0);
    ctx.restore();
    return { x: 8 + coinSize / 2, y: rewardY };
  }

  function drawPayoutFx(now: number, ox: number, oy: number, tx: number, ty: number) {
    if (!ctx || !payoutActive) return;
    for (const s of payoutSparkles) {
      const u = Math.min(1, (now - payoutT0) / s.life);
      if (u >= 1) continue;
      const e = easeOutCubic(u);
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = u < 0.35 ? "#ffffff" : "#fbbf24";
      ctx.beginPath();
      ctx.arc(ox + Math.cos(s.angle) * s.dist * e, oy + Math.sin(s.angle) * s.dist * e, s.size * (1.2 - u), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const p of payoutCoins) {
      const f = coinFlight(p, now, ox, oy, tx, ty);
      if (f.alpha <= 0.02 || f.scale <= 0.02) continue;
      const size = p.size * f.scale;
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      drawCoin(-size / 2, -size / 2, size);
      ctx.restore();
    }
    const dur = Math.max(1, payoutUntil - payoutT0);
    const p = Math.min(1, (now - payoutT0) / dur);
    const amount = `+${payoutReward}`;
    let x = ox;
    let y = oy;
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
      x = ox + (tx - ox) * e;
      y = oy + (ty - oy) * e;
      scale = 1.5 * (1 - e * 0.75);
      alpha = 1 - e * 0.85;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.font = "800 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.strokeText(amount, 0, 0);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(amount, 0, 0);
    ctx.restore();
  }

  function drawBanner(w: number, h: number, now: number) {
    if (!ctx || bannerRound == null || bannerUntil <= bannerT0) return;
    const u = Math.min(1, (now - bannerT0) / Math.max(1, bannerUntil - bannerT0));
    let scale = 1;
    let alpha = 1;
    if (u < 0.18) {
      scale = 0.35 + easeOutCubic(u / 0.18) * 0.75;
      alpha = Math.min(1, u / 0.08);
    } else if (u > 0.78) {
      const e = easeInOut((u - 0.78) / 0.22);
      scale = 1 - e * 0.12;
      alpha = 1 - e;
    }
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.strokeText("SUCCESS", 0, -22);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("SUCCESS", 0, -22);
    ctx.font = "800 36px system-ui, sans-serif";
    ctx.strokeText(`ROUND ${bannerRound}`, 0, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`ROUND ${bannerRound}`, 0, 18);
    ctx.restore();
  }

  function draw(now: number) {
    if (!canvas || !ctx || !container) return;
    const { w, h } = viewSize();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const nextW = Math.max(1, Math.floor(w * dpr));
    const nextH = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const target = drawHud(w, now);
    drawPayoutFx(now, w / 2, h / 2, target.x, target.y);
    drawBanner(w, h, now);
  }

  return {
    mount(el) {
      container = el;
      if (!el.style.position) el.style.position = "relative";
      canvas = document.createElement("canvas");
      canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block;";
      el.appendChild(canvas);
      ctx = canvas.getContext("2d");
      loadImage(coinUrl, (img) => {
        coinImage = img;
      });
      draw(performance.now());
    },
    setCoinUrl(url) {
      const next = url || DEFAULT_COIN_URL;
      if (next === coinUrl && coinImage) return;
      coinUrl = next;
      const gen = ++loadGen;
      loadImage(coinUrl, (img) => {
        if (gen !== loadGen) return;
        coinImage = img;
      });
    },
    setState(nextEarned, nextTotal) {
      earned = nextEarned;
      total = Math.max(0, nextTotal);
    },
    busy() {
      return payoutActive || bannerRound != null;
    },
    startPayout(opts) {
      const t0 = performance.now();
      payoutActive = true;
      payoutT0 = t0;
      payoutFrom = opts.from;
      payoutTo = opts.to;
      payoutReward = opts.reward;
      earned = opts.to;
      pendingKind = opts.nextRound != null ? "next" : "win";
      pendingNextRound = opts.nextRound;
      bannerRound = null;
      bannerUntil = 0;
      onDone = opts.onDone;
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
    },
    cancel() {
      clearFx();
    },
    tick(now) {
      if (payoutActive && now >= payoutUntil) {
        payoutActive = false;
        payoutCoins = [];
        payoutSparkles = [];
        if (pendingNextRound != null) {
          bannerRound = pendingNextRound;
          pendingNextRound = null;
          bannerT0 = now;
          bannerUntil = now + BANNER_MS;
        } else {
          finishPhase();
        }
      }
      if (!payoutActive && bannerRound != null && bannerUntil > 0 && now >= bannerUntil) {
        finishPhase();
      }
      draw(now);
    },
    resize() {
      draw(performance.now());
    },
    destroy() {
      clearFx();
      canvas?.remove();
      canvas = null;
      ctx = null;
      container = null;
      coinImage = null;
    },
  };
}
