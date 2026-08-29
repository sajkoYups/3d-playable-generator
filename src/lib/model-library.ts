import type { TemplateId } from "@/types/project";

export type LibraryModel = {
  id: string;
  name: string;
  category: "match-item" | "character" | "obstacle" | "vehicle" | "td-prop";
  color: string;
  /** Public URL if a packed GLB exists; engines fall back to procedural geometry. */
  url: string;
};

export const MATCH_ITEMS: LibraryModel[] = [
  { id: "apple", name: "Apple", category: "match-item", color: "#e85d4c", url: "/models/kenney/food/apple.glb" },
  { id: "banana", name: "Banana", category: "match-item", color: "#f4c430", url: "/models/kenney/food/banana.glb" },
  { id: "strawberry", name: "Strawberry", category: "match-item", color: "#e23b4a", url: "/models/kenney/food/strawberry.glb" },
  { id: "orange", name: "Orange", category: "match-item", color: "#e07a3d", url: "/models/kenney/food/orange.glb" },
  { id: "lemon", name: "Lemon", category: "match-item", color: "#f4c430", url: "/models/kenney/food/lemon.glb" },
  { id: "pear", name: "Pear", category: "match-item", color: "#8fbf4a", url: "/models/kenney/food/pear.glb" },
  { id: "cherries", name: "Cherries", category: "match-item", color: "#c42b3a", url: "/models/kenney/food/cherries.glb" },
  { id: "donut", name: "Donut", category: "match-item", color: "#e07a3d", url: "/models/kenney/food/donut.glb" },
  { id: "croissant", name: "Croissant", category: "match-item", color: "#d4a017", url: "/models/kenney/food/croissant.glb" },
  { id: "cupcake", name: "Cupcake", category: "match-item", color: "#e85d4c", url: "/models/kenney/food/cupcake.glb" },
  { id: "cookie", name: "Cookie", category: "match-item", color: "#c4a574", url: "/models/kenney/food/cookie.glb" },
  { id: "taco", name: "Taco", category: "match-item", color: "#e0b04a", url: "/models/kenney/food/taco.glb" },
  { id: "bacon", name: "Bacon", category: "match-item", color: "#c45a3a", url: "/models/kenney/food/bacon.glb" },
  { id: "burger", name: "Burger", category: "match-item", color: "#8b5a2b", url: "/models/kenney/food/burger.glb" },
  { id: "soda-can", name: "Soda can", category: "match-item", color: "#e85d4c", url: "/models/kenney/food/soda-can.glb" },
  { id: "soda-bottle", name: "Soda bottle", category: "match-item", color: "#2bb5a0", url: "/models/kenney/food/soda-bottle.glb" },
  { id: "carrot", name: "Carrot", category: "match-item", color: "#e07a3d", url: "/models/kenney/food/carrot.glb" },
  { id: "tomato", name: "Tomato", category: "match-item", color: "#e85d4c", url: "/models/kenney/food/tomato.glb" },
  { id: "muffin", name: "Muffin", category: "match-item", color: "#c47a4a", url: "/models/kenney/food/muffin.glb" },
];

const FOOD_ALIASES: Record<string, string> = {
  bottle: "soda-bottle",
  can: "soda-can",
  coin: "cookie",
  gem: "lollypop",
  key: "honey",
  star: "cupcake",
  hammer: "carrot",
  potion: "soda",
  crown: "muffin",
};

export const CHARACTERS: LibraryModel[] = [
  { id: "runner", name: "Runner", category: "character", color: "#e07a3d", url: "/models/runner.glb" },
];

export const OBSTACLES: LibraryModel[] = [
  { id: "crate", name: "Crate", category: "obstacle", color: "#8b5a2b", url: "/models/crate.glb" },
  { id: "barrier", name: "Barrier", category: "obstacle", color: "#e85d4c", url: "/models/barrier.glb" },
  { id: "cone", name: "Cone", category: "obstacle", color: "#e07a3d", url: "/models/kenney/cone.glb" },
];

export const VEHICLES: LibraryModel[] = [
  { id: "sedan", name: "Sedan", category: "vehicle", color: "#e07a3d", url: "/models/kenney/sedan.glb" },
  { id: "suv", name: "SUV", category: "vehicle", color: "#2bb5a0", url: "/models/kenney/suv.glb" },
  { id: "van", name: "Van", category: "vehicle", color: "#7c5cff", url: "/models/kenney/van.glb" },
  { id: "taxi", name: "Taxi", category: "vehicle", color: "#e0b04a", url: "/models/kenney/taxi.glb" },
  { id: "police", name: "Police", category: "vehicle", color: "#3d7cff", url: "/models/kenney/police.glb" },
  { id: "truck", name: "Truck", category: "vehicle", color: "#e85d4c", url: "/models/kenney/truck.glb" },
];

export const TD_MODELS: LibraryModel[] = [
  { id: "tile", name: "Grass tile", category: "td-prop", color: "#5a8f3a", url: "/models/kenney/td/tile.glb" },
  { id: "imp", name: "Imp", category: "character", color: "#c45a3a", url: "/models/bestiary/imp.glb" },
  { id: "puglin", name: "Puglin", category: "character", color: "#5cbf5a", url: "/models/bestiary/puglin.glb" },
];

export const TD_MODEL_URLS = [
  "/models/kenney/td/colormap.png",
  "/models/kenney/td/tile.glb",
  "/models/kenney/td/tile-straight.glb",
  "/models/kenney/td/tile-corner-round.glb",
  "/models/kenney/td/tile-spawn.glb",
  "/models/kenney/td/tile-end.glb",
  "/models/kenney/td/tile-crystal.glb",
  "/models/kenney/td/tile-tree.glb",
  "/models/kenney/td/tile-rock.glb",
  "/models/kenney/td/detail-tree.glb",
  "/models/kenney/td/detail-rocks.glb",
  "/models/kenney/td/selection-a.glb",
  "/models/kenney/td/spawn-round.glb",
  "/models/kenney/td/tower-round-base.glb",
  "/models/kenney/td/tower-round-bottom-a.glb",
  "/models/kenney/td/tower-round-middle-a.glb",
  "/models/kenney/td/tower-round-top-a.glb",
  "/models/kenney/td/tower-square-bottom-a.glb",
  "/models/kenney/td/tower-square-middle-a.glb",
  "/models/kenney/td/tower-square-top-a.glb",
  "/models/kenney/td/weapon-ballista.glb",
  "/models/kenney/td/weapon-cannon.glb",
  "/models/kenney/td/weapon-turret.glb",
  "/models/kenney/td/weapon-ammo-arrow.glb",
  "/models/kenney/td/weapon-ammo-cannonball.glb",
  "/models/kenney/td/weapon-ammo-bullet.glb",
  "/models/bestiary/imp.glb",
  "/models/bestiary/puglin.glb",
] as const;

export const ALL_LIBRARY_MODELS: LibraryModel[] = [
  ...MATCH_ITEMS,
  ...CHARACTERS,
  ...OBSTACLES,
  ...VEHICLES,
  ...TD_MODELS,
];

export function getLibraryModel(id: string): LibraryModel | undefined {
  return ALL_LIBRARY_MODELS.find((m) => m.id === id);
}

export function resolveModelRef(ref: string): { libraryId?: string; url: string } {
  if (!ref) return { url: "" };
  const aliased = FOOD_ALIASES[ref] || ref;
  const kenneyCar = aliased.match(/kenney_car-kit\/Models\/GLB format\/([a-z0-9-]+)\.glb/i);
  if (kenneyCar) {
    const lib = getLibraryModel(kenneyCar[1].toLowerCase());
    if (lib) return { libraryId: lib.id, url: lib.url };
  }
  const kenneyFood = aliased.match(/kenney_food-kit\/Models\/GLB format\/([a-z0-9-]+)\.glb/i);
  if (kenneyFood) {
    const lib = getLibraryModel(kenneyFood[1].toLowerCase());
    if (lib) return { libraryId: lib.id, url: lib.url };
    return { libraryId: kenneyFood[1].toLowerCase(), url: `/models/kenney/food/${kenneyFood[1].toLowerCase()}.glb` };
  }
  if (aliased.startsWith("/") || aliased.startsWith("http") || aliased.startsWith("data:")) {
    return { url: aliased };
  }
  const lib = getLibraryModel(aliased);
  if (lib) return { libraryId: aliased, url: lib.url };
  if (FOOD_ALIASES[ref]) return { libraryId: aliased, url: `/models/kenney/food/${aliased}.glb` };
  return { libraryId: aliased, url: "" };
}

export function modelsForTemplate(templateId: TemplateId): LibraryModel[] {
  if (templateId === "triple-match") return MATCH_ITEMS;
  if (templateId === "lane-runner") {
    const cone = OBSTACLES.find((o) => o.id === "cone");
    return cone ? [...VEHICLES, cone] : [...VEHICLES];
  }
  if (templateId === "parking-jam") return VEHICLES;
  if (templateId === "tower-defense") return TD_MODELS;
  return [];
}
