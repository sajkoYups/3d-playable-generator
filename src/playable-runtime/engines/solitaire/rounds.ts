import type { SolitaireConfig, SolitaireRound } from "@/types/project";

const CARDS = [13, 13, 26, 26, 39, 39, 52, 52, 52];
const COINS = [40, 45, 50, 55, 60, 70, 80, 90, 100];
const MAX = 9;

function coins(n: number | undefined) {
  if (!Number.isFinite(n)) return 40;
  return Math.min(9999, Math.max(0, Math.round(n as number)));
}

/** Classic Klondike always uses 7 columns; old projects stored 3–6 and get upgraded here. */
export const SOLITAIRE_TABLEAU_PILES = 7;

export function cloneSolitaireRound(src: SolitaireRound): SolitaireRound {
  return {
    cardsToWin: Math.min(52, Math.max(4, Math.round(src.cardsToWin || 13))),
    tableauPiles: SOLITAIRE_TABLEAU_PILES,
    coins: coins(src.coins),
  };
}

export function defaultSolitaireRoundAt(index: number): SolitaireRound {
  const i = Math.max(0, Math.min(index, CARDS.length - 1));
  return { cardsToWin: CARDS[i] ?? 13, tableauPiles: SOLITAIRE_TABLEAU_PILES, coins: COINS[i] ?? 40 };
}

export function defaultSolitaireRoundsPack(): SolitaireRound[] {
  return CARDS.map((_, i) => defaultSolitaireRoundAt(i));
}

export function listSolitaireRounds(cfg: SolitaireConfig): SolitaireRound[] {
  if (cfg.rounds?.length) return cfg.rounds.slice(0, MAX).map(cloneSolitaireRound);
  return [defaultSolitaireRoundAt(0)];
}

export function ensureSolitaireRounds(cfg: SolitaireConfig) {
  setSolitaireRoundCount(cfg, cfg.rounds?.length || defaultSolitaireRoundsPack().length);
}

export function setSolitaireRoundCount(cfg: SolitaireConfig, count: number) {
  const pack = defaultSolitaireRoundsPack();
  const n = Math.min(MAX, Math.max(1, Math.round(count)));
  const prev = cfg.rounds ?? [];
  cfg.rounds = pack.slice(0, n).map((p, i) => (prev[i] ? cloneSolitaireRound(prev[i]) : cloneSolitaireRound(p)));
}
