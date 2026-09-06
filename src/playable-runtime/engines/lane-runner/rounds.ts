import type { LaneRunnerConfig, LaneRunnerRound } from "@/types/project";

const DIST = [160, 100, 120, 140, 160, 180, 200, 220, 240];
const SPEED = [4, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12];
const RAMP = [0.5, 0.45, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1];
const COINS = [40, 45, 50, 55, 60, 70, 80, 90, 100];
const MAX_LANE_ROUNDS = 9;
export const DEFAULT_LANE_COINS = 40;

function roundCoins(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_LANE_COINS;
  return Math.min(9999, Math.max(0, Math.round(value as number)));
}

function clampDist(n: number | undefined, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(800, Math.max(40, n as number));
}

function clampSpeed(n: number | undefined, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(20, Math.max(4, n as number));
}

function clampRamp(n: number | undefined, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(4, Math.max(0, n as number));
}

export function cloneLaneRound(src: LaneRunnerRound): LaneRunnerRound {
  return {
    winDistance: clampDist(src.winDistance, 160),
    startSpeed: clampSpeed(src.startSpeed, 4),
    speedRamp: clampRamp(src.speedRamp, 0.5),
    coins: roundCoins(src.coins),
  };
}

export function defaultLaneRoundAt(index: number): LaneRunnerRound {
  const i = Math.max(0, Math.min(index, DIST.length - 1));
  return {
    winDistance: DIST[i] ?? 160,
    startSpeed: SPEED[i] ?? 4,
    speedRamp: RAMP[i] ?? 0.5,
    coins: COINS[i] ?? DEFAULT_LANE_COINS,
  };
}

export function defaultLaneRoundsPack(): LaneRunnerRound[] {
  return DIST.map((_, i) => defaultLaneRoundAt(i));
}

function fallbackRound(cfg: LaneRunnerConfig): LaneRunnerRound {
  return {
    winDistance: clampDist(cfg.winDistance, 160),
    startSpeed: clampSpeed(cfg.startSpeed, 4),
    speedRamp: clampRamp(cfg.speedRamp, 0.5),
    coins: DEFAULT_LANE_COINS,
  };
}

export function listLaneRounds(cfg: LaneRunnerConfig): LaneRunnerRound[] {
  if (cfg.rounds?.length) {
    return cfg.rounds.slice(0, MAX_LANE_ROUNDS).map(cloneLaneRound);
  }
  return [fallbackRound(cfg)];
}

export function laneCoinsTotal(cfg: LaneRunnerConfig) {
  return listLaneRounds(cfg).reduce((sum, r) => sum + r.coins, 0);
}

function applyLaneRoundCount(cfg: LaneRunnerConfig, count: number) {
  const pack = defaultLaneRoundsPack();
  const n = Math.min(MAX_LANE_ROUNDS, Math.max(1, Math.round(count)));
  const prev = cfg.rounds ?? [];
  // Existing packs unify to round 1; brand-new packs use cfg / factory default.
  const sharedDist = clampDist(
    prev.length ? (prev[0]?.winDistance ?? cfg.winDistance) : cfg.winDistance,
    160,
  );
  cfg.rounds = pack.slice(0, n).map((p, i) => {
    const existing = prev[i];
    if (existing) {
      const next = cloneLaneRound(existing);
      next.winDistance = sharedDist;
      return next;
    }
    const next = cloneLaneRound(p);
    next.winDistance = sharedDist;
    return next;
  });
  cfg.winDistance = sharedDist;
}

/** Keep the current round count (1–9). Empty lists hydrate to the full pack. */
export function ensureLaneRounds(cfg: LaneRunnerConfig) {
  const prev = cfg.rounds ?? [];
  applyLaneRoundCount(cfg, prev.length || defaultLaneRoundsPack().length);
}

/** Slice or grow the pack prefix so the playable has exactly `count` rounds. */
export function setLaneRoundCount(cfg: LaneRunnerConfig, count: number) {
  applyLaneRoundCount(cfg, count);
}

export function syncLaneRound(cfg: LaneRunnerConfig, index: number) {
  const round = cfg.rounds[Math.max(0, Math.min(index, cfg.rounds.length - 1))];
  if (!round) return;
  cfg.winDistance = round.winDistance;
  cfg.startSpeed = round.startSpeed;
  cfg.speedRamp = round.speedRamp;
}

/** Apply the same win distance to every round (shared length for the whole pack). */
export function propagateLaneWinDistance(cfg: LaneRunnerConfig, winDistance: number) {
  const dist = clampDist(winDistance, 160);
  ensureLaneRounds(cfg);
  for (const round of cfg.rounds) round.winDistance = dist;
  cfg.winDistance = dist;
}
