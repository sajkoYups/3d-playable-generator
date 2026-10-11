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
  { id: "goblin-male", name: "Goblin", category: "character", color: "#6a8f32", url: "/models/characters/goblin-male.gltf" },
  { id: "goblin-female", name: "Goblin", category: "character", color: "#7a9a3a", url: "/models/characters/goblin-female.gltf" },
  { id: "zombie-male", name: "Zombie", category: "character", color: "#6a8f62", url: "/models/characters/zombie-male.gltf" },
  { id: "zombie-female", name: "Zombie", category: "character", color: "#5a7a58", url: "/models/characters/zombie-female.gltf" },
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
  "/models/kenney/td/tile-hill.glb",
  "/models/kenney/td/tile-slope.glb",
  "/models/kenney/td/tile-dirt.glb",
  "/models/kenney/td/tile-river-bridge.glb",
  "/models/kenney/td/tile-tree-double.glb",
  "/models/kenney/td/tile-tree-quad.glb",
  "/models/kenney/td/detail-tree.glb",
  "/models/kenney/td/detail-tree-large.glb",
  "/models/kenney/td/detail-rocks.glb",
  "/models/kenney/td/wood-structure.glb",
  "/models/kenney/td/wood-structure-high.glb",
  "/models/kenney/td/wood-structure-part.glb",
  "/models/kenney/td/tower-square-roof-a.glb",
  "/models/kenney/td/tower-square-roof-b.glb",
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
  "/models/characters/goblin-male.gltf",
  "/models/characters/goblin-female.gltf",
  "/models/characters/zombie-male.gltf",
  "/models/characters/zombie-female.gltf",
  "/models/kenney/nature/ground_grass.glb",
  "/models/kenney/nature/ground_pathStraight.glb",
  "/models/kenney/nature/ground_pathCorner.glb",
  "/models/kenney/nature/ground_pathBend.glb",
  "/models/kenney/nature/ground_pathEnd.glb",
  "/models/kenney/nature/ground_riverStraight.glb",
  "/models/kenney/nature/ground_riverCorner.glb",
  "/models/kenney/nature/ground_riverBend.glb",
  "/models/kenney/nature/ground_riverEnd.glb",
  "/models/kenney/nature/bridge_woodNarrow.glb",
  "/models/kenney/nature/tree_pineSmallA.glb",
  "/models/kenney/nature/tree_pineDefaultA.glb",
  "/models/kenney/nature/tree_oak.glb",
  "/models/kenney/nature/tree_default.glb",
  "/models/kenney/nature/tent_smallOpen.glb",
  "/models/kenney/nature/tent_detailedOpen.glb",
  "/models/kenney/nature/tent_smallClosed.glb",
  "/models/kenney/nature/rock_smallA.glb",
  "/models/kenney/nature/rock_largeA.glb",
  "/models/kenney/nature/campfire_logs.glb",
  "/models/kenney/nature/stump_round.glb",
  "/models/kenney/nature/mushroom_red.glb",
  "/models/kenney/nature/flower_redA.glb",
  "/models/kenney/nature/flower_yellowA.glb",
  "/models/kenney/nature/lily_small.glb",
  "/models/kenney/nature/sign.glb",
  "/models/kenney/nature/cliff_block_rock.glb",
  "/models/kenney/nature/cliff_block_stone.glb",
  "/models/kenney/nature/cliff_large_rock.glb",
  "/models/kenney/nature/cliff_rock.glb",
  "/models/kenney/nature/cliff_corner_rock.glb",
  "/models/kenney/nature/cliff_blockSlope_rock.glb",
  "/models/kenney/nature/cliff_steps_rock.glb",
  "/models/kenney/nature/cliff_waterfall_rock.glb",
  "/models/kenney/nature/cliff_waterfallTop_rock.glb",
  "/models/kenney/nature/fence_simple.glb",
  "/models/kenney/nature/fence_planks.glb",
  "/models/kenney/nature/fence_corner.glb",
  "/models/kenney/nature/fence_gate.glb",
  "/models/kenney/nature/cactus_tall.glb",
  "/models/kenney/nature/cactus_short.glb",
  "/models/kenney/nature/tree_palm.glb",
  "/models/kenney/nature/tree_palmShort.glb",
  "/models/kenney/nature/plant_bush.glb",
  "/models/kenney/nature/plant_bushLarge.glb",
  "/models/kenney/nature/log.glb",
  "/models/kenney/nature/log_stack.glb",
  "/models/kenney/nature/mushroom_redGroup.glb",
  "/models/kenney/nature/mushroom_tanGroup.glb",
  "/models/kenney/nature/flower_purpleA.glb",
  "/models/kenney/nature/crops_wheatStageB.glb",
  "/models/kenney/nature/statue_obelisk.glb",
  "/models/kenney/nature/rock_tallA.glb",
  "/models/kenney/nature/rock_tallB.glb",
  "/models/kenney/nature/stump_old.glb",
  "/models/kenney/nature/campfire_stones.glb",
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
