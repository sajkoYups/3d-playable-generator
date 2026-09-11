const PLAYABLE_ROOT = "/playforge-dressup-playable";

export const FITTED_CANVAS = { width: 640, height: 960 } as const;

export type DressUpCategory = "model" | "dress" | "shoes" | "accessory" | "look";

export type CropBox = { x: number; y: number; w: number; h: number };

export type DressUpItem = {
  id: string;
  name: string;
  category: DressUpCategory;
  url: string;
  crop: CropBox;
};

function item(
  id: string,
  name: string,
  category: DressUpCategory,
  file: string,
  x: number,
  y: number,
  w: number,
  h: number,
): DressUpItem {
  return {
    id,
    name,
    category,
    url: encodeURI(`${PLAYABLE_ROOT}/${file}`),
    crop: { x, y, w, h },
  };
}

const DRESS_STEM: Record<string, string> = {
  "dress-red": "red",
  "dress-black": "black",
  "dress-floral": "floral",
};

const SHOES_STEM: Record<string, string> = {
  "shoes-black": "black",
  "shoes-white": "white",
};

const ACCESSORY_STEM: Record<string, string> = {
  "acc-sunglasses": "sunglasses",
  "acc-pearls": "pearls",
};

export const DRESS_UP_MODELS: DressUpItem[] = [
  item("model-01", "Brunette", "model", "model-base.webp", 0, 0, 640, 960),
];

export const DRESS_UP_DRESSES: DressUpItem[] = [
  item("dress-red", "Red satin", "dress", "dress-red.webp", 99, 38, 449, 856),
  item("dress-black", "Black lace", "dress", "dress-black.webp", 106, 59, 432, 839),
  item("dress-floral", "Floral", "dress", "dress-floral.webp", 83, 16, 480, 888),
];

export const DRESS_UP_SHOES: DressUpItem[] = [
  item("shoes-black", "Black pumps", "shoes", "shoes-black.webp", 87, 69, 463, 511),
  item("shoes-white", "White sneakers", "shoes", "shoes-white.webp", 69, 69, 502, 372),
];

export const DRESS_UP_ACCESSORIES: DressUpItem[] = [
  item("acc-sunglasses", "Sunglasses", "accessory", "accessory-sunglasses.webp", 24, 74, 592, 180),
  item("acc-pearls", "Pearls", "accessory", "accessory-pearls.webp", 65, 35, 510, 355),
];

const LOOK_DRESSES = ["red", "black", "floral"] as const;
const LOOK_SHOES = ["black", "white"] as const;
const LOOK_ACCESSORIES = ["sunglasses", "pearls"] as const;

export function lookItemId(
  dressId: string | null,
  shoesId: string | null,
  accessoryId: string | null,
): string | null {
  const dress = dressId ? DRESS_STEM[dressId] : null;
  if (!dress) return null;
  const shoes = shoesId ? SHOES_STEM[shoesId] ?? null : "none";
  const accessory = accessoryId ? ACCESSORY_STEM[accessoryId] ?? null : "none";
  if (!shoes || !accessory) return null;
  return `look-${dress}-${shoes}-${accessory}`;
}

export const DRESS_UP_LOOKS: DressUpItem[] = LOOK_DRESSES.flatMap((dress) => {
  const dressOnly = item(
    `look-${dress}-none-none`,
    `${dress} only`,
    "look",
    `woman-${dress}-none-none.webp`,
    0,
    0,
    640,
    960,
  );
  const withShoes = LOOK_SHOES.flatMap((shoes) => {
    const shoesOnly = item(
      `look-${dress}-${shoes}-none`,
      `${dress} ${shoes}`,
      "look",
      `woman-${dress}-${shoes}-none.webp`,
      0,
      0,
      640,
      960,
    );
    const full = LOOK_ACCESSORIES.map((accessory) =>
      item(
        `look-${dress}-${shoes}-${accessory}`,
        `${dress} ${shoes} ${accessory}`,
        "look",
        `woman-${dress}-${shoes}-${accessory}.webp`,
        0,
        0,
        640,
        960,
      ),
    );
    return [shoesOnly, ...full];
  });
  return [dressOnly, ...withShoes];
});


export const DRESS_UP_ITEMS: DressUpItem[] = [
  ...DRESS_UP_MODELS,
  ...DRESS_UP_DRESSES,
  ...DRESS_UP_SHOES,
  ...DRESS_UP_ACCESSORIES,
  ...DRESS_UP_LOOKS,
];

const ITEM_BY_ID = new Map(DRESS_UP_ITEMS.map((entry) => [entry.id, entry]));

export function dressUpItem(id: string): DressUpItem | undefined {
  return ITEM_BY_ID.get(id);
}

export function dressUpAssetUrls(): string[] {
  return DRESS_UP_ITEMS.map((entry) => entry.url);
}
