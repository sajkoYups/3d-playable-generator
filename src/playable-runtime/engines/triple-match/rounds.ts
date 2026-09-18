import type { TripleMatchConfig, TripleMatchRound } from "@/types/project";

const FOODS = ["apple", "donut", "taco", "burger"];
const TRIPLES = [3, 4, 4, 5, 5, 6, 6, 7, 8];
const COINS = [40, 45, 50, 55, 60, 70, 80, 90, 100];
const BARS = [7, 7, 7, 7, 7, 7, 8, 8, 8];
const MAX_MATCH_ROUNDS = 9;
export const DEFAULT_MATCH_COINS = 50;

function roundCoins(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_MATCH_COINS;
  return Math.min(9999, Math.max(0, Math.round(value as number)));
}

function cloneSlots(slots: string[] | undefined): string[] {
  const next = (slots ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 4);
  while (next.length < 4) next.push(FOODS[next.length] ?? "apple");
  return next;
}

function sameSlots(a: string[], b: string[]) {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

/** Foods are shared by the playable. Prefer top-level, then the first customized round. */
export function sharedMatchSlots(cfg: TripleMatchConfig): string[] {
  const top = cloneSlots(cfg.itemSlots);
  if (!sameSlots(top, FOODS)) return top;
  for (const round of cfg.rounds ?? []) {
    const slots = cloneSlots(round.itemSlots);
    if (!sameSlots(slots, FOODS)) return slots;
  }
  return top;
}

export function propagateMatchFoods(cfg: TripleMatchConfig) {
  const slots = sharedMatchSlots(cfg);
  cfg.itemSlots = [...slots];
  for (const round of cfg.rounds ?? []) round.itemSlots = [...slots];
}

export function cloneMatchRound(src: TripleMatchRound): TripleMatchRound {
  return {
    itemSlots: cloneSlots(src.itemSlots),
    trayColor: src.trayColor || "#b87914",
    barSlots: src.barSlots,
    triplesToWin: src.triplesToWin,
    coins: roundCoins(src.coins),
  };
}

export function defaultMatchRoundAt(index: number): TripleMatchRound {
  const i = Math.max(0, Math.min(index, TRIPLES.length - 1));
  return {
    itemSlots: [...FOODS],
    trayColor: "#b87914",
    barSlots: BARS[i] ?? 7,
    triplesToWin: TRIPLES[i] ?? 4,
    coins: COINS[i] ?? DEFAULT_MATCH_COINS,
  };
}

export function defaultMatchRoundsPack(): TripleMatchRound[] {
  return TRIPLES.map((_, i) => defaultMatchRoundAt(i));
}

function fallbackRound(cfg: TripleMatchConfig): TripleMatchRound {
  return {
    itemSlots: cloneSlots(cfg.itemSlots),
    trayColor: cfg.trayColor || "#b87914",
    barSlots: cfg.barSlots,
    triplesToWin: cfg.triplesToWin,
    coins: DEFAULT_MATCH_COINS,
  };
}

export function listMatchRounds(cfg: TripleMatchConfig): TripleMatchRound[] {
  const foods = sharedMatchSlots(cfg);
  if (cfg.rounds?.length) {
    return cfg.rounds.slice(0, MAX_MATCH_ROUNDS).map((r) => ({
      ...cloneMatchRound(r),
      itemSlots: [...foods],
    }));
  }
  return [{ ...fallbackRound(cfg), itemSlots: foods }];
}

export function matchCoinsTotal(cfg: TripleMatchConfig) {
  return listMatchRounds(cfg).reduce((sum, r) => sum + r.coins, 0);
}

function applyMatchRoundCount(cfg: TripleMatchConfig, count: number) {
  const pack = defaultMatchRoundsPack();
  const n = Math.min(MAX_MATCH_ROUNDS, Math.max(1, Math.round(count)));
  const prev = cfg.rounds ?? [];
  const foods = sharedMatchSlots(cfg);
  cfg.rounds = pack.slice(0, n).map((p, i) => {
    const existing = prev[i];
    const round = existing ? cloneMatchRound(existing) : cloneMatchRound(p);
    round.itemSlots = [...foods];
    return round;
  });
  cfg.itemSlots = [...foods];
}

/** Keep the current round count (1–9). Empty lists hydrate to the full pack. */
export function ensureMatchRounds(cfg: TripleMatchConfig) {
  const prev = cfg.rounds ?? [];
  applyMatchRoundCount(cfg, prev.length || defaultMatchRoundsPack().length);
}

/** Slice or grow the pack prefix so the playable has exactly `count` rounds. */
export function setMatchRoundCount(cfg: TripleMatchConfig, count: number) {
  applyMatchRoundCount(cfg, count);
}

export function syncMatchRound(cfg: TripleMatchConfig, index: number) {
  const round = cfg.rounds[Math.max(0, Math.min(index, cfg.rounds.length - 1))];
  if (!round) return;
  cfg.trayColor = round.trayColor;
  cfg.barSlots = round.barSlots;
  cfg.triplesToWin = round.triplesToWin;
  propagateMatchFoods(cfg);
}
