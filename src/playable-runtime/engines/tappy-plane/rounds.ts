import type { TappyPlaneConfig, TappyPlaneRound } from "@/types/project";

const GAPS = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const SPEED = [1.5, 1.65, 1.8, 1.95, 2.1, 2.25, 2.4, 2.55, 2.7];
const GAP = [0.48, 0.44, 0.42, 0.4, 0.38, 0.36, 0.34, 0.32, 0.3];
const COINS = [40, 45, 50, 55, 60, 70, 80, 90, 100];
const MAX = 9;

function coins(n: number | undefined) {
  if (!Number.isFinite(n)) return 40;
  return Math.min(9999, Math.max(0, Math.round(n as number)));
}

export function cloneTappyRound(src: TappyPlaneRound): TappyPlaneRound {
  return {
    gapsToWin: Math.min(20, Math.max(2, Math.round(src.gapsToWin || 5))),
    speed: Math.min(4, Math.max(0.6, src.speed || 1.5)),
    gapSize: Math.min(0.7, Math.max(0.22, src.gapSize || 0.42)),
    coins: coins(src.coins),
  };
}

export function defaultTappyRoundAt(index: number): TappyPlaneRound {
  const i = Math.max(0, Math.min(index, GAPS.length - 1));
  return { gapsToWin: GAPS[i] ?? 5, speed: SPEED[i] ?? 1.5, gapSize: GAP[i] ?? 0.42, coins: COINS[i] ?? 40 };
}

export function defaultTappyRoundsPack(): TappyPlaneRound[] {
  return GAPS.map((_, i) => defaultTappyRoundAt(i));
}

export function listTappyRounds(cfg: TappyPlaneConfig): TappyPlaneRound[] {
  if (cfg.rounds?.length) return cfg.rounds.slice(0, MAX).map(cloneTappyRound);
  return [defaultTappyRoundAt(0)];
}

export function ensureTappyRounds(cfg: TappyPlaneConfig) {
  setTappyRoundCount(cfg, cfg.rounds?.length || defaultTappyRoundsPack().length);
}

export function setTappyRoundCount(cfg: TappyPlaneConfig, count: number) {
  const pack = defaultTappyRoundsPack();
  const n = Math.min(MAX, Math.max(1, Math.round(count)));
  const prev = cfg.rounds ?? [];
  cfg.rounds = pack.slice(0, n).map((p, i) => (prev[i] ? cloneTappyRound(prev[i]) : cloneTappyRound(p)));
}
