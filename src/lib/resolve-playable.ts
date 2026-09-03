import {
  BrandDataSchema,
  ProjectDataSchema,
  VariationOverridesSchema,
  type BrandData,
  type PlayableElement,
  type ProjectData,
  type VariationOverrides,
} from "@/types/project";
import { stampCoinImage } from "@/lib/project-defaults";

function upsertElements(target: PlayableElement[], incoming: PlayableElement[]) {
  const byId = new Map(target.map((el, index) => [el.id, index]));
  for (const next of incoming) {
    const index = byId.get(next.id);
    const clone = structuredClone(next);
    if (index === undefined) {
      byId.set(next.id, target.length);
      target.push(clone);
    } else {
      target[index] = clone;
    }
  }
}

function applyOverrides(data: ProjectData, overrides: VariationOverrides | undefined) {
  const elements = overrides?.elements;
  if (!elements) return;
  const stages: PlayableElement[][] = [
    data.startScreen.elements,
    data.endScreen.elements,
    data.gameplay.overlays,
  ];
  for (const list of stages) {
    for (const el of list) {
      const patch = elements[el.id];
      if (!patch) continue;
      if (patch.text !== undefined) el.content.text = patch.text;
      if (patch.imageUrl !== undefined) el.content.imageUrl = patch.imageUrl;
      if (patch.color !== undefined) el.content.color = patch.color;
      if (patch.backgroundColor !== undefined) el.style.backgroundColor = patch.backgroundColor;
      if (patch.textColor !== undefined) el.style.textColor = patch.textColor;
    }
  }
}

export function parseProjectData(raw: unknown): ProjectData {
  return ProjectDataSchema.parse(raw);
}

export function parseBrandData(raw: unknown): BrandData {
  return BrandDataSchema.parse(raw);
}

export function parseOverrides(raw: unknown): VariationOverrides {
  const parsed = VariationOverridesSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : { elements: {} };
}

/**
 * Live-merge a Brand kit onto a variation's playable.
 * Gameplay 3D config always comes from the variation.
 * Brand wins for slot layers + store links + coin; overrides win for copy and button colors.
 */
export function resolvePlayable(
  projectData: ProjectData,
  brand: BrandData | null | undefined,
  overrides?: VariationOverrides | null,
): ProjectData {
  const result = structuredClone(projectData);
  if (brand) {
    result.links = { ...brand.links };
    if (brand.coinImageUrl) stampCoinImage(result, brand.coinImageUrl);
    result.startScreen.background = structuredClone(brand.startScreen.background);
    result.startScreen.videoUrl = brand.startScreen.videoUrl;
    result.startScreen.startAfterVideo = brand.startScreen.startAfterVideo;
    upsertElements(result.startScreen.elements, brand.startScreen.elements);
    result.endScreen.background = structuredClone(brand.endScreen.background);
    result.endScreen.videoUrl = brand.endScreen.videoUrl;
    result.endScreen.startAfterVideo = brand.endScreen.startAfterVideo;
    upsertElements(result.endScreen.elements, brand.endScreen.elements);
    upsertElements(result.gameplay.overlays, brand.overlays);
  }
  applyOverrides(result, overrides ?? undefined);
  return result;
}

export function extractOverrides(
  merged: ProjectData,
  brand: BrandData | null | undefined,
  overridableIds: readonly string[],
): VariationOverrides {
  if (!brand) return { elements: {} };
  const brandEls = new Map<string, PlayableElement>();
  for (const el of [
    ...brand.startScreen.elements,
    ...brand.endScreen.elements,
    ...brand.overlays,
  ]) {
    brandEls.set(el.id, el);
  }
  const mergedEls = [
    ...merged.startScreen.elements,
    ...merged.endScreen.elements,
    ...merged.gameplay.overlays,
  ];
  const elements: VariationOverrides["elements"] = {};
  for (const el of mergedEls) {
    if (!overridableIds.includes(el.id)) continue;
    const fromBrand = brandEls.get(el.id);
    if (!fromBrand) continue;
    const patch: VariationOverrides["elements"][string] = {};
    if (el.content.text !== fromBrand.content.text) patch.text = el.content.text;
    if (el.content.imageUrl !== fromBrand.content.imageUrl) patch.imageUrl = el.content.imageUrl;
    if (el.content.color !== fromBrand.content.color) patch.color = el.content.color;
    if (el.style.backgroundColor !== fromBrand.style.backgroundColor) {
      patch.backgroundColor = el.style.backgroundColor;
    }
    if (el.style.textColor !== fromBrand.style.textColor) {
      patch.textColor = el.style.textColor;
    }
    if (Object.keys(patch).length) elements[el.id] = patch;
  }
  return { elements };
}
