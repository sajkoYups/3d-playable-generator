import type { WaterSortConfig, WaterSortRound } from "@/types/project";

const MAX = 9;
const COLORS = [3, 4, 5, 5, 5, 5, 5, 5, 5];
const COINS = [5, 5, 5, 8, 8, 10, 10, 12, 15];
const MOVES = [40, 40, 40, 45, 45, 50, 50, 55, 60];

function clampInt(n: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n as number)));
}

export function cloneWaterSortRound(src: WaterSortRound): WaterSortRound {
  return {
    maxMoves: clampInt(src.maxMoves, 8, 99, 40),
    coins: clampInt(src.coins, 0, 9999, 5),
    colorCount: clampInt(src.colorCount, 2, 5, 5),
  };
}

export function defaultWaterSortRoundAt(index: number): WaterSortRound {
  const i = Math.max(0, Math.min(index, COLORS.length - 1));
  return { maxMoves: MOVES[i] ?? 40, coins: COINS[i] ?? 5, colorCount: COLORS[i] ?? 5 };
}

export function defaultWaterSortRoundsPack(): WaterSortRound[] {
  return [0, 1, 2].map((i) => defaultWaterSortRoundAt(i));
}

export function listWaterSortRounds(cfg: WaterSortConfig): WaterSortRound[] {
  if (cfg.rounds?.length) return cfg.rounds.slice(0, MAX).map(cloneWaterSortRound);
  const n = clampInt(cfg.roundsToWin, 1, MAX, 3);
  const moves = clampInt(cfg.maxMoves, 8, 99, 40);
  const coins = clampInt(cfg.rewardPerRound, 0, 9999, 5);
  const colors = clampInt(cfg.colors?.length, 2, 5, 5);
  return Array.from({ length: n }, () => ({ maxMoves: moves, coins, colorCount: colors }));
}

export function setWaterSortRoundCount(cfg: WaterSortConfig, count: number) {
  const pack = Array.from({ length: MAX }, (_, i) => defaultWaterSortRoundAt(i));
  const n = clampInt(count, 1, MAX, 3);
  const prev = listWaterSortRounds(cfg);
  cfg.rounds = pack.slice(0, n).map((p, i) => (prev[i] ? cloneWaterSortRound(prev[i]) : cloneWaterSortRound(p)));
  cfg.roundsToWin = n;
}

export function ensureWaterSortRounds(cfg: WaterSortConfig) {
  setWaterSortRoundCount(cfg, cfg.rounds?.length || listWaterSortRounds(cfg).length);
}
