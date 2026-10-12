/** Built-in lot art. The painted 1536 background is intentionally absent so exports stay under 5 MB. */
export const PARKING_2D_SPRITES = {
  hero: "/forge-2d-parking-assets/hero-car.png",
  short: "/forge-2d-parking-assets/short-car.png",
  long: "/forge-2d-parking-assets/long-car.png",
  arrow: "/forge-2d-parking-assets/exit-arrow.png",
  asphalt: "/forge-2d-parking-assets/asphalt-tile.png",
  grass: "/forge-2d-parking-assets/grass-tile.png",
} as const;

export function parking2dSpriteUrls(overrides?: {
  heroCarUrl?: string;
  shortCarUrl?: string;
  longCarUrl?: string;
  exitArrowUrl?: string;
  asphaltUrl?: string;
  grassUrl?: string;
}) {
  return [
    overrides?.heroCarUrl?.trim() || PARKING_2D_SPRITES.hero,
    overrides?.shortCarUrl?.trim() || PARKING_2D_SPRITES.short,
    overrides?.longCarUrl?.trim() || PARKING_2D_SPRITES.long,
    overrides?.exitArrowUrl?.trim() || PARKING_2D_SPRITES.arrow,
    overrides?.asphaltUrl?.trim() || PARKING_2D_SPRITES.asphalt,
    overrides?.grassUrl?.trim() || PARKING_2D_SPRITES.grass,
  ];
}
