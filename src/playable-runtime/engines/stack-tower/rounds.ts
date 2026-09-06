import type { StackTowerConfig, StackTowerRound } from "@/types/project";

const BLOCKS = [8, 10, 12, 14, 16, 18, 20, 22, 24];
const SPEED = [1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8];
const RAMP = [0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2, 0.22];
const MISS = [3, 3, 3, 3, 2, 2, 2, 2, 2];
const COINS = [40, 45, 50, 55, 60, 70, 80, 90, 100];
const MAX_STACK_ROUNDS = 9;
export const DEFAULT_STACK_COINS = 40;

function roundCoins(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_STACK_COINS;
  return Math.min(9999, Math.max(0, Math.round(value as number)));
}

function clampBlocks(n: number | undefined, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(3, Math.round(n as number)));
}

function clampSpeed(n: number | undefined, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(4, Math.max(0.4, n as number));
}

function clampRamp(n: number | undefined, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(0.4, Math.max(0, n as number));
}

function clampMiss(n: number | undefined, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(8, Math.max(1, Math.round(n as number)));
}

export function cloneStackRound(src: StackTowerRound): StackTowerRound {
  return {
    blocksToWin: clampBlocks(src.blocksToWin, 10),
    speed: clampSpeed(src.speed, 1.4),
    speedRamp: clampRamp(src.speedRamp, 0.08),
    missLimit: clampMiss(src.missLimit, 3),
    coins: roundCoins(src.coins),
  };
}

export function defaultStackRoundAt(index: number): StackTowerRound {
  const i = Math.max(0, Math.min(index, BLOCKS.length - 1));
  return {
    blocksToWin: BLOCKS[i] ?? 10,
    speed: SPEED[i] ?? 1.4,
    speedRamp: RAMP[i] ?? 0.08,
    missLimit: MISS[i] ?? 3,
    coins: COINS[i] ?? DEFAULT_STACK_COINS,
  };
}

export function defaultStackRoundsPack(): StackTowerRound[] {
  return BLOCKS.map((_, i) => defaultStackRoundAt(i));
}

function fallbackRound(cfg: StackTowerConfig): StackTowerRound {
  return {
    blocksToWin: clampBlocks(cfg.blocksToWin, 10),
    speed: clampSpeed(cfg.speed, 1.4),
    speedRamp: clampRamp(cfg.speedRamp, 0.08),
    missLimit: clampMiss(cfg.missLimit, 3),
    coins: DEFAULT_STACK_COINS,
  };
}

export function listStackRounds(cfg: StackTowerConfig): StackTowerRound[] {
  if (cfg.rounds?.length) {
    return cfg.rounds.slice(0, MAX_STACK_ROUNDS).map(cloneStackRound);
  }
  return [fallbackRound(cfg)];
}

export function stackCoinsTotal(cfg: StackTowerConfig) {
  return listStackRounds(cfg).reduce((sum, r) => sum + r.coins, 0);
}

function applyStackRoundCount(cfg: StackTowerConfig, count: number) {
  const pack = defaultStackRoundsPack();
  const n = Math.min(MAX_STACK_ROUNDS, Math.max(1, Math.round(count)));
  const prev = cfg.rounds ?? [];
  cfg.rounds = pack.slice(0, n).map((p, i) => {
    const existing = prev[i];
    return existing ? cloneStackRound(existing) : cloneStackRound(p);
  });
}

export function ensureStackRounds(cfg: StackTowerConfig) {
  const prev = cfg.rounds ?? [];
  applyStackRoundCount(cfg, prev.length || defaultStackRoundsPack().length);
}

export function setStackRoundCount(cfg: StackTowerConfig, count: number) {
  applyStackRoundCount(cfg, count);
}

export function syncStackRound(cfg: StackTowerConfig, index: number) {
  const round = cfg.rounds[Math.max(0, Math.min(index, cfg.rounds.length - 1))];
  if (!round) return;
  cfg.blocksToWin = round.blocksToWin;
  cfg.speed = round.speed;
  cfg.speedRamp = round.speedRamp;
  cfg.missLimit = round.missLimit;
}
