import { drawCoinIcon } from "@/playable-runtime/engines/water-sort/draw";

export const PAYOUT_BURST_MS = 280;
export const PAYOUT_COLLECT_MS = 720;
export const PAYOUT_STAGGER_MS = 28;
export const PAYOUT_HOLD_MS = 200;
export const PAYOUT_COIN_COUNT = 18;
export const PAYOUT_SPARKLE_COUNT = 14;

export type PayoutCoin = {
  angle: number;
  dist: number;
  size: number;
  rot: number;
  rotSpeed: number;
  delay: number;
};

export type PayoutSparkle = {
  angle: number;
  dist: number;
  life: number;
  size: number;
};

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function payoutDuration() {
  const lastDelay = (PAYOUT_COIN_COUNT - 1) * PAYOUT_STAGGER_MS + 20;
  return PAYOUT_BURST_MS + lastDelay + PAYOUT_COLLECT_MS + PAYOUT_HOLD_MS;
}

export function spawnPayoutBits(): { coins: PayoutCoin[]; sparkles: PayoutSparkle[] } {
  const coins: PayoutCoin[] = [];
  const sparkles: PayoutSparkle[] = [];
  for (let i = 0; i < PAYOUT_COIN_COUNT; i++) {
    coins.push({
      angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35,
      dist: 48 + Math.random() * 100,
      size: 16 + Math.random() * 14,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.018,
      delay: i * PAYOUT_STAGGER_MS + Math.random() * 20,
    });
  }
  for (let i = 0; i < PAYOUT_SPARKLE_COUNT; i++) {
    sparkles.push({
      angle: Math.random() * Math.PI * 2,
      dist: 20 + Math.random() * 70,
      life: 280 + Math.random() * 280,
      size: 1.5 + Math.random() * 2.5,
    });
  }
  return { coins, sparkles };
}

export function displayedEarned(now: number, t0: number, from: number, to: number) {
  const start = t0 + PAYOUT_BURST_MS;
  const end = start + (PAYOUT_COIN_COUNT - 1) * PAYOUT_STAGGER_MS + PAYOUT_COLLECT_MS;
  const t = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
  return from + (to - from) * easeOutCubic(t);
}

export function payoutPunch(now: number, t0: number, until: number, popUntil: number, active: boolean) {
  if (active && until > t0) {
    const u = Math.min(1, (now - t0) / (until - t0));
    return 1 + 0.35 * Math.sin(u * Math.PI);
  }
  if (now < popUntil) {
    return 1 + 0.12 * Math.sin(((popUntil - now) / 700) * Math.PI);
  }
  return 1;
}

function coinFlight(
  p: PayoutCoin,
  now: number,
  t0: number,
  ox: number,
  oy: number,
  tx: number,
  ty: number,
) {
  const t = now - t0;
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

export function drawPayoutFx(
  ctx: CanvasRenderingContext2D,
  opts: {
    now: number;
    t0: number;
    until: number;
    originX: number;
    originY: number;
    targetX: number;
    targetY: number;
    coins: PayoutCoin[];
    sparkles: PayoutSparkle[];
    coinImage: HTMLImageElement | null;
    amount: string;
    rewardTextColor: string;
  },
) {
  const { now, t0, originX, originY, targetX, targetY } = opts;

  for (const s of opts.sparkles) {
    const u = Math.min(1, (now - t0) / s.life);
    if (u >= 1) continue;
    const e = easeOutCubic(u);
    ctx.save();
    ctx.globalAlpha = 1 - u;
    ctx.fillStyle = u < 0.35 ? "#ffffff" : "#e2b13a";
    ctx.beginPath();
    ctx.arc(originX + Math.cos(s.angle) * s.dist * e, originY + Math.sin(s.angle) * s.dist * e, s.size * (1.2 - u), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const p of opts.coins) {
    const f = coinFlight(p, now, t0, originX, originY, targetX, targetY);
    if (f.alpha <= 0.02 || f.scale <= 0.02) continue;
    const size = p.size * f.scale;
    ctx.save();
    ctx.globalAlpha = f.alpha;
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    drawCoinIcon(ctx, opts.coinImage, -size / 2, -size / 2, size);
    ctx.restore();
  }

  const dur = Math.max(1, opts.until - t0);
  const p = Math.min(1, (now - t0) / dur);
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
  ctx.font = "800 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(31,51,71,0.35)";
  ctx.strokeText(opts.amount, 0, 0);
  ctx.fillStyle = opts.rewardTextColor;
  ctx.fillText(opts.amount, 0, 0);
  ctx.restore();
}
