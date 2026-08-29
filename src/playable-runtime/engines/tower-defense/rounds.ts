import type { TowerDefenseConfig, TowerDefenseRound } from "@/types/project";

const IMP = [6, 8, 10, 12, 8, 14, 16, 12, 10];
const PUG = [0, 1, 2, 3, 5, 4, 6, 8, 10];
const INTERVAL = [1.25, 1.1, 0.95, 0.85, 0.75, 0.7, 0.65, 0.6, 0.55];
const HP = [1, 1.1, 1.25, 1.4, 1.6, 1.8, 2, 2.2, 2.5];
const SPD = [0.9, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35];
const COINS = [40, 50, 60, 70, 90, 80, 90, 100, 120];
const GOLD = [0, 15, 15, 20, 25, 20, 25, 30, 40];

const MAX_TD_ROUNDS = 9;
export const DEFAULT_TD_COINS = 50;
export const DEFAULT_TD_ROUND_COUNT = 5;

function clampInt(n: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n as number)));
}

function clampNum(n: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n as number));
}

export function cloneTdRound(src: TowerDefenseRound): TowerDefenseRound {
  return {
    impCount: clampInt(src.impCount, 0, 40, 6),
    puglinCount: clampInt(src.puglinCount, 0, 20, 0),
    spawnInterval: clampNum(src.spawnInterval, 0.2, 5, 1.1),
    hpScale: clampNum(src.hpScale, 0.4, 5, 1),
    speedScale: clampNum(src.speedScale, 0.4, 3, 1),
    coins: clampInt(src.coins, 0, 9999, DEFAULT_TD_COINS),
    goldBonus: clampInt(src.goldBonus, 0, 999, 0),
  };
}

export function defaultTdRoundAt(index: number): TowerDefenseRound {
  const i = Math.max(0, Math.min(index, IMP.length - 1));
  return {
    impCount: IMP[i] ?? 6,
    puglinCount: PUG[i] ?? 0,
    spawnInterval: INTERVAL[i] ?? 1.1,
    hpScale: HP[i] ?? 1,
    speedScale: SPD[i] ?? 1,
    coins: COINS[i] ?? DEFAULT_TD_COINS,
    goldBonus: GOLD[i] ?? 0,
  };
}

export function defaultTdRoundsPack(): TowerDefenseRound[] {
  return Array.from({ length: DEFAULT_TD_ROUND_COUNT }, (_, i) => defaultTdRoundAt(i));
}

export function listTdRounds(cfg: TowerDefenseConfig): TowerDefenseRound[] {
  if (cfg.rounds?.length) {
    return cfg.rounds.slice(0, MAX_TD_ROUNDS).map(cloneTdRound);
  }
  return [defaultTdRoundAt(0)];
}

export function tdCoinsTotal(cfg: TowerDefenseConfig) {
  return listTdRounds(cfg).reduce((sum, r) => sum + r.coins, 0);
}

function applyTdRoundCount(cfg: TowerDefenseConfig, count: number) {
  const pack = Array.from({ length: MAX_TD_ROUNDS }, (_, i) => defaultTdRoundAt(i));
  const n = Math.min(MAX_TD_ROUNDS, Math.max(1, Math.round(count)));
  const prev = cfg.rounds ?? [];
  cfg.rounds = pack.slice(0, n).map((p, i) => {
    const existing = prev[i];
    return existing ? cloneTdRound(existing) : cloneTdRound(p);
  });
}

export function ensureTdRounds(cfg: TowerDefenseConfig) {
  const prev = cfg.rounds ?? [];
  applyTdRoundCount(cfg, prev.length || DEFAULT_TD_ROUND_COUNT);
  if (!cfg.sounds) {
    cfg.sounds = {
      arrowFireUrl: "",
      cannonFireUrl: "",
      turretFireUrl: "",
      hitUrl: "",
      deathUrl: "",
      leakUrl: "",
      placeUrl: "",
      waveUrl: "",
    };
  }
}

export function setTdRoundCount(cfg: TowerDefenseConfig, count: number) {
  applyTdRoundCount(cfg, count);
}

export function syncTdRound(_cfg: TowerDefenseConfig, _index: number) {
  // Wave fields live on the round; nothing to copy to top-level config.
}
