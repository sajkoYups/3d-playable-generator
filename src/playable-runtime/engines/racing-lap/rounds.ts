import type { RacingLapConfig, RacingLapRound } from "@/types/project";

const LAPS = [1, 1, 2, 2, 2, 3, 3, 3, 4];
const SPEED = [1.2, 1.35, 1.5, 1.65, 1.8, 1.95, 2.1, 2.25, 2.4];
const COINS = [40, 45, 50, 55, 60, 70, 80, 90, 100];
const MAX = 9;

function coins(n: number | undefined) {
  if (!Number.isFinite(n)) return 40;
  return Math.min(9999, Math.max(0, Math.round(n as number)));
}

export function cloneRacingRound(src: RacingLapRound): RacingLapRound {
  return {
    lapsToWin: Math.min(5, Math.max(1, Math.round(src.lapsToWin || 1))),
    speed: Math.min(4, Math.max(0.6, src.speed || 1.4)),
    coins: coins(src.coins),
  };
}

export function defaultRacingRoundAt(index: number): RacingLapRound {
  const i = Math.max(0, Math.min(index, LAPS.length - 1));
  return { lapsToWin: LAPS[i] ?? 1, speed: SPEED[i] ?? 1.4, coins: COINS[i] ?? 40 };
}

export function defaultRacingRoundsPack(): RacingLapRound[] {
  return LAPS.map((_, i) => defaultRacingRoundAt(i));
}

export function listRacingRounds(cfg: RacingLapConfig): RacingLapRound[] {
  if (cfg.rounds?.length) return cfg.rounds.slice(0, MAX).map(cloneRacingRound);
  return [defaultRacingRoundAt(0)];
}

export function ensureRacingRounds(cfg: RacingLapConfig) {
  setRacingRoundCount(cfg, cfg.rounds?.length || defaultRacingRoundsPack().length);
}

export function setRacingRoundCount(cfg: RacingLapConfig, count: number) {
  const pack = defaultRacingRoundsPack();
  const n = Math.min(MAX, Math.max(1, Math.round(count)));
  const prev = cfg.rounds ?? [];
  cfg.rounds = pack.slice(0, n).map((p, i) => (prev[i] ? cloneRacingRound(prev[i]) : cloneRacingRound(p)));
}
