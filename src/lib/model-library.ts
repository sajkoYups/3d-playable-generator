import type { TemplateId } from "@/types/project";

export type LibraryModel = {
  id: string;
  name: string;
  category: "match-item" | "character" | "obstacle" | "vehicle";
  color: string;
  /** Public URL if a packed GLB exists; engines fall back to procedural geometry. */
  url: string;
};

export const MATCH_ITEMS: LibraryModel[] = [
  { id: "apple", name: "Apple", category: "match-item", color: "#e85d4c", url: "/models/apple.glb" },
  { id: "banana", name: "Banana", category: "match-item", color: "#f4c430", url: "/models/banana.glb" },
  { id: "bottle", name: "Bottle", category: "match-item", color: "#2bb5a0", url: "/models/bottle.glb" },
  { id: "can", name: "Can", category: "match-item", color: "#8a8494", url: "/models/can.glb" },
  { id: "coin", name: "Coin", category: "match-item", color: "#e0b04a", url: "/models/coin.glb" },
  { id: "gem", name: "Gem", category: "match-item", color: "#7c5cff", url: "/models/gem.glb" },
  { id: "key", name: "Key", category: "match-item", color: "#d4a017", url: "/models/key.glb" },
  { id: "star", name: "Star", category: "match-item", color: "#f3ede0", url: "/models/star.glb" },
  { id: "donut", name: "Donut", category: "match-item", color: "#e07a3d", url: "/models/donut.glb" },
  { id: "hammer", name: "Hammer", category: "match-item", color: "#6b4f3a", url: "/models/hammer.glb" },
  { id: "potion", name: "Potion", category: "match-item", color: "#3d7cff", url: "/models/potion.glb" },
  { id: "crown", name: "Crown", category: "match-item", color: "#e0b04a", url: "/models/crown.glb" },
];

export const CHARACTERS: LibraryModel[] = [
  { id: "runner", name: "Runner", category: "character", color: "#e07a3d", url: "/models/runner.glb" },
];

export const OBSTACLES: LibraryModel[] = [
  { id: "crate", name: "Crate", category: "obstacle", color: "#8b5a2b", url: "/models/crate.glb" },
  { id: "barrier", name: "Barrier", category: "obstacle", color: "#e85d4c", url: "/models/barrier.glb" },
  { id: "cone", name: "Cone", category: "obstacle", color: "#e07a3d", url: "/models/cone.glb" },
];

export const VEHICLES: LibraryModel[] = [
  { id: "sedan", name: "Sedan", category: "vehicle", color: "#e07a3d", url: "/models/sedan.glb" },
  { id: "suv", name: "SUV", category: "vehicle", color: "#2bb5a0", url: "/models/suv.glb" },
  { id: "van", name: "Van", category: "vehicle", color: "#7c5cff", url: "/models/van.glb" },
];

export const ALL_LIBRARY_MODELS: LibraryModel[] = [
  ...MATCH_ITEMS,
  ...CHARACTERS,
  ...OBSTACLES,
  ...VEHICLES,
];

export function getLibraryModel(id: string): LibraryModel | undefined {
  return ALL_LIBRARY_MODELS.find((m) => m.id === id);
}

export function resolveModelRef(ref: string): { libraryId?: string; url: string } {
  if (!ref) return { url: "" };
  if (ref.startsWith("/") || ref.startsWith("http") || ref.startsWith("data:")) {
    return { url: ref };
  }
  const lib = getLibraryModel(ref);
  return { libraryId: ref, url: lib?.url ?? "" };
}

export function modelsForTemplate(templateId: TemplateId): LibraryModel[] {
  if (templateId === "triple-match") return MATCH_ITEMS;
  if (templateId === "lane-runner") return [...CHARACTERS, ...OBSTACLES];
  if (templateId === "parking-jam") return VEHICLES;
  return [];
}
