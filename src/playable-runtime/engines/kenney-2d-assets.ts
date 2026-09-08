const CARD_DIR = "/kenney_playing-cards-pack/PNG/Cards%20(large)";
const DOMINO_DIR = "/kenney_domino-pack/PNG/Light";
const SHOOTER = "/kenney_top-down-shooter/PNG";
const RACING = "/kenney_racing-pack/PNG";
const TAPPY = "/kenney_tappy-plane/PNG";

const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
const RANKS = ["A", "02", "03", "04", "05", "06", "07", "08", "09", "10", "J", "Q", "K"] as const;

export function cardRankFile(rank: number) {
  return RANKS[Math.max(1, Math.min(13, rank)) - 1];
}

export function cardUrl(suit: number, rank: number) {
  return `${CARD_DIR}/card_${SUITS[suit]}_${cardRankFile(rank)}.png`;
}

export const CARD_BACK_URL = `${CARD_DIR}/card_back.png`;

/** Opaque art inside Kenney large 64×64 sprites (transparent L/R gutters). */
export const KENNEY_CARD_SRC = { sx: 11, sy: 2, sw: 42, sh: 60 } as const;
export const KENNEY_CARD_ASPECT = KENNEY_CARD_SRC.sh / KENNEY_CARD_SRC.sw;

export function solitaireSpriteUrls() {
  const urls = [CARD_BACK_URL];
  for (let s = 0; s < 4; s++) {
    for (let r = 1; r <= 13; r++) urls.push(cardUrl(s, r));
  }
  return urls;
}

export function dominoUrl(a: number, b: number) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${DOMINO_DIR}/tile_${lo}_${hi}.png`;
}

export function dominoSpriteUrls() {
  const urls: string[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) urls.push(dominoUrl(a, b));
  }
  return urls;
}

export const SHOOTER_SPRITES = {
  player: `${SHOOTER}/Hitman%201/hitman1_gun.png`,
  zombie: `${SHOOTER}/Zombie%201/zoimbie1_hold.png`,
  soldier: `${SHOOTER}/Soldier%201/soldier1_hold.png`,
  floor: `${SHOOTER}/Tiles/tile_01.png`,
  wall: `${SHOOTER}/Tiles/tile_05.png`,
} as const;

export function shooterSpriteUrls() {
  return Object.values(SHOOTER_SPRITES);
}

export const RACING_SPRITES = {
  car: `${RACING}/Cars/car_red_1.png`,
  grass: `${RACING}/Tiles/Grass/land_grass04.png`,
  road: `${RACING}/Tiles/Asphalt%20road/road_asphalt01.png`,
} as const;

export function racingSpriteUrls() {
  return Object.values(RACING_SPRITES);
}

export const TAPPY_SPRITES = {
  plane1: `${TAPPY}/Planes/planeBlue1.png`,
  plane2: `${TAPPY}/Planes/planeBlue2.png`,
  plane3: `${TAPPY}/Planes/planeBlue3.png`,
  rock: `${TAPPY}/rock.png`,
  rockDown: `${TAPPY}/rockDown.png`,
  ground: `${TAPPY}/groundGrass.png`,
  background: `${TAPPY}/background.png`,
} as const;

export function tappySpriteUrls() {
  return Object.values(TAPPY_SPRITES);
}
