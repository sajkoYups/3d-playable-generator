/** Curated, 5MB-safe clips. Empty override fields fall back to these. */

export const PLAYABLE_SOUNDS = {
  restaurantAmbience: "/sounds/playable/restaurant-ambience.mp3",
  trafficAmbience: "/sounds/playable/traffic-ambience.mp3",
  swoosh: "/sounds/playable/swoosh.mp3",
  matchWin: "/sounds/playable/match-win.mp3",
  payout: "/sounds/playable/payout.mp3",
  dominoRefill: "/sounds/playable/domino-refill.mp3",
  dominoPlace: "/sounds/playable/domino-place.mp3",
  dominoTurn: "/sounds/playable/domino-turn.mp3",
  pour: "/sounds/playable/pour.mp3",
  cardFlip: "/sounds/playable/card-flip.mp3",
  cardPlace: "/sounds/playable/card-place.mp3",
  match3Match: "/sounds/playable/match-3-match.mp3",
  coin: "/sounds/playable/coin.mp3",
  crash: "/sounds/playable/crash.mp3",
  planeLoop: "/sounds/playable/plane-loop.mp3",
  wow: "/sounds/playable/wow.mp3",
  /** Arrow.wav by EverHeat, CC BY 3.0 — https://freesound.org/people/EverHeat/sounds/205563/ */
  arrowFire: "/sounds/playable/td-arrow.mp3",
  /** Little Cannon by vulkanbruder, CC0 — https://freesound.org/people/vulkanbruder/sounds/850499/ */
  cannonFire: "/sounds/playable/td-cannon.mp3",
  /** Lazer shot - 2 by colorsCrimsonTears, CC0 — https://freesound.org/people/colorsCrimsonTears/sounds/580308/ */
  turretFire: "/sounds/playable/td-turret.mp3",
} as const;

export function pickSoundUrl(override: string | undefined, fallback: string) {
  const trimmed = override?.trim();
  return trimmed || fallback;
}
