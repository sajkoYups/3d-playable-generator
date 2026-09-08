import type { TopDownShooterConfig, TopDownShooterRound } from "@/types/project";

const ENEMIES = [3, 4, 5, 6, 7, 8, 9, 10, 12];
const HP = [1, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 2];
const SPEED = [0.9, 1, 1.1, 1.15, 1.25, 1.35, 1.45, 1.55, 1.7];
const COINS = [40, 45, 50, 55, 60, 70, 80, 90, 100];
const MAX = 9;

function coins(n: number | undefined) {
  if (!Number.isFinite(n)) return 40;
  return Math.min(9999, Math.max(0, Math.round(n as number)));
}

export function cloneShooterRound(src: TopDownShooterRound): TopDownShooterRound {
  return {
    enemyCount: Math.min(20, Math.max(1, Math.round(src.enemyCount || 4))),
    hpScale: Math.min(5, Math.max(0.4, src.hpScale || 1)),
    speedScale: Math.min(3, Math.max(0.4, src.speedScale || 1)),
    coins: coins(src.coins),
  };
}

export function defaultShooterRoundAt(index: number): TopDownShooterRound {
  const i = Math.max(0, Math.min(index, ENEMIES.length - 1));
  return { enemyCount: ENEMIES[i] ?? 4, hpScale: HP[i] ?? 1, speedScale: SPEED[i] ?? 1, coins: COINS[i] ?? 40 };
}

export function defaultShooterRoundsPack(): TopDownShooterRound[] {
  return ENEMIES.map((_, i) => defaultShooterRoundAt(i));
}

export function listShooterRounds(cfg: TopDownShooterConfig): TopDownShooterRound[] {
  if (cfg.rounds?.length) return cfg.rounds.slice(0, MAX).map(cloneShooterRound);
  return [defaultShooterRoundAt(0)];
}

export function ensureShooterRounds(cfg: TopDownShooterConfig) {
  setShooterRoundCount(cfg, cfg.rounds?.length || defaultShooterRoundsPack().length);
}

export function setShooterRoundCount(cfg: TopDownShooterConfig, count: number) {
  const pack = defaultShooterRoundsPack();
  const n = Math.min(MAX, Math.max(1, Math.round(count)));
  const prev = cfg.rounds ?? [];
  cfg.rounds = pack.slice(0, n).map((p, i) => (prev[i] ? cloneShooterRound(prev[i]) : cloneShooterRound(p)));
}
