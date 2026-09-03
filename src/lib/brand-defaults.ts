import { createDefaultProjectData, stampCoinImage } from "@/lib/project-defaults";
import {
  BRAND_SLOT_IDS,
  OPTIONAL_BRAND_END_SLOT_IDS,
  type BrandData,
  type PlayableElement,
  type ProjectData,
} from "@/types/project";

function pickSlots(elements: PlayableElement[], ids: readonly string[]): PlayableElement[] {
  const idSet = new Set(ids);
  return elements.filter((el) => idSet.has(el.id)).map((el) => structuredClone(el));
}

function pickEndSlots(elements: PlayableElement[]): PlayableElement[] {
  const presentOptional = OPTIONAL_BRAND_END_SLOT_IDS.filter((id) =>
    elements.some((el) => el.id === id),
  );
  return pickSlots(elements, [...BRAND_SLOT_IDS.end, ...presentOptional]);
}

export function createDefaultBrandData(): BrandData {
  const base = createDefaultProjectData("stack-tower");
  return {
    links: {
      appStoreUrl: "",
      googlePlayUrl: "",
      policyUrl: "",
    },
    coinImageUrl: "",
    startScreen: {
      ...structuredClone(base.startScreen),
      elements: pickSlots(base.startScreen.elements, BRAND_SLOT_IDS.start),
    },
    endScreen: {
      ...structuredClone(base.endScreen),
      elements: pickEndSlots(base.endScreen.elements),
    },
    overlays: pickSlots(base.gameplay.overlays, BRAND_SLOT_IDS.gameplay),
  };
}

export function brandDataToProjectData(brand: BrandData): ProjectData {
  const base = createDefaultProjectData("stack-tower");
  const data: ProjectData = {
    links: structuredClone(brand.links),
    coinImageUrl: brand.coinImageUrl || "",
    startScreen: structuredClone(brand.startScreen),
    endScreen: structuredClone(brand.endScreen),
    gameplay: {
      ...base.gameplay,
      overlays: structuredClone(brand.overlays),
    },
  };
  if (brand.coinImageUrl) stampCoinImage(data, brand.coinImageUrl);
  return data;
}

export function projectDataToBrandData(data: ProjectData): BrandData {
  return {
    links: structuredClone(data.links),
    coinImageUrl: data.coinImageUrl || "",
    startScreen: {
      ...structuredClone(data.startScreen),
      elements: pickSlots(data.startScreen.elements, BRAND_SLOT_IDS.start),
    },
    endScreen: {
      ...structuredClone(data.endScreen),
      elements: pickEndSlots(data.endScreen.elements),
    },
    overlays: pickSlots(data.gameplay.overlays, BRAND_SLOT_IDS.gameplay),
  };
}
