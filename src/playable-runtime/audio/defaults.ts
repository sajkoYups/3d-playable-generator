/** Curated, 5MB-safe clips. Empty override fields fall back to these. */

export const PLAYABLE_SOUNDS = {
  restaurantAmbience: "/sounds/playable/restaurant-ambience.mp3",
  trafficAmbience: "/sounds/playable/traffic-ambience.mp3",
  swoosh: "/sounds/playable/swoosh.mp3",
  matchWin: "/sounds/playable/match-win.mp3",
  payout: "/sounds/playable/payout.mp3",
  pour: "/sounds/playable/pour.mp3",
  cardFlip: "/sounds/playable/card-flip.mp3",
  cardPlace: "/sounds/playable/card-place.mp3",
  match3Match: "/sounds/playable/match-3-match.mp3",
  coin: "/sounds/playable/coin.mp3",
  crash: "/sounds/playable/crash.mp3",
  planeLoop: "/sounds/playable/plane-loop.mp3",
  wow: "/sounds/playable/wow.mp3",
} as const;

export function pickSoundUrl(override: string | undefined, fallback: string) {
  const trimmed = override?.trim();
  return trimmed || fallback;
}
