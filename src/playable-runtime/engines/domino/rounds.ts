import type { DominoConfig, DominoRound } from "@/types/project";

const HAND = [7, 7, 6, 6, 5, 5, 5, 4, 4];
const PLAYS = [6, 7, 8, 8, 9, 10, 11, 12, 13];
const COINS = [40, 45, 50, 55, 60, 70, 80, 90, 100];
const MAX = 9;

function coins(n: number | undefined) {
  if (!Number.isFinite(n)) return 40;
  return Math.min(9999, Math.max(0, Math.round(n as number)));
}

export function cloneDominoRound(src: DominoRound): DominoRound {
  return {
    handSize: Math.min(10, Math.max(3, Math.round(src.handSize || 7))),
    playsToWin: Math.min(28, Math.max(3, Math.round(src.playsToWin || 7))),
    coins: coins(src.coins),
  };
}

export function defaultDominoRoundAt(index: number): DominoRound {
  const i = Math.max(0, Math.min(index, HAND.length - 1));
  return { handSize: HAND[i] ?? 7, playsToWin: PLAYS[i] ?? 7, coins: COINS[i] ?? 40 };
}

export function defaultDominoRoundsPack(): DominoRound[] {
  return HAND.map((_, i) => defaultDominoRoundAt(i));
}

export function listDominoRounds(cfg: DominoConfig): DominoRound[] {
  if (cfg.rounds?.length) return cfg.rounds.slice(0, MAX).map(cloneDominoRound);
  return [defaultDominoRoundAt(0)];
}

export function ensureDominoRounds(cfg: DominoConfig) {
  setDominoRoundCount(cfg, cfg.rounds?.length || defaultDominoRoundsPack().length);
}

export function setDominoRoundCount(cfg: DominoConfig, count: number) {
  const pack = defaultDominoRoundsPack();
  const n = Math.min(MAX, Math.max(1, Math.round(count)));
  const prev = cfg.rounds ?? [];
  cfg.rounds = pack.slice(0, n).map((p, i) => (prev[i] ? cloneDominoRound(prev[i]) : cloneDominoRound(p)));
}
