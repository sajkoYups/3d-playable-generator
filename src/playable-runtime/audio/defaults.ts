/** Curated, 5MB-safe clips. Empty override fields fall back to these. */

export const PLAYABLE_SOUNDS = {
  restaurantAmbience: "/sounds/playable/restaurant-ambience.mp3",
  trafficAmbience: "/sounds/playable/traffic-ambience.mp3",
  swoosh: "/sounds/playable/swoosh.mp3",
  matchWin: "/sounds/playable/match-win.mp3",
  payout: "/sounds/playable/payout.mp3",
} as const;

export function pickSoundUrl(override: string | undefined, fallback: string) {
  const trimmed = override?.trim();
  return trimmed || fallback;
}
