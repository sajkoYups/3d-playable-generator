import {
  APP_BRAND_DISCLAIMER_IDS,
  APP_BRAND_HORIZONTAL_LOGO_ID,
  APP_BRAND_ICON_ID,
  APP_BRAND_VERTICAL_LOGO_ID,
  AppBrandDataSchema,
  BrandDataSchema,
  BRAND_LOGO_SLOT_IDS,
  ProjectDataSchema,
  UNLOCK_COIN_SLOT_ID,
  UNLOCK_END_BG_SLOT_ID,
  UNLOCK_LINKS_SLOT_ID,
  UNLOCK_START_BG_SLOT_ID,
  VariationOverridesSchema,
  type AppBrandData,
  type BrandData,
  type PlayableElement,
  type ProjectData,
  type VariationOverrides,
} from "@/types/project";
import { ensureAppBrandLayers, stampCoinImage } from "@/lib/project-defaults";

function upsertElements(
  target: PlayableElement[],
  incoming: PlayableElement[],
  skipIds: Set<string>,
) {
  const byId = new Map(target.map((el, index) => [el.id, index]));
  for (const next of incoming) {
    if (skipIds.has(next.id)) continue;
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

function applyOverrides(
  data: ProjectData,
  overrides: VariationOverrides | undefined,
  skipIds: Set<string>,
) {
  const elements = overrides?.elements;
  if (!elements) return;
  const stages: PlayableElement[][] = [
    data.startScreen.elements,
    data.endScreen.elements,
    data.gameplay.overlays,
  ];
  for (const list of stages) {
    for (const el of list) {
      if (skipIds.has(el.id)) continue;
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
  return ensureAppBrandLayers(ProjectDataSchema.parse(raw));
}

export function parseBrandData(raw: unknown): BrandData {
  return BrandDataSchema.parse(raw);
}

export function parseAppBrandData(raw: unknown): AppBrandData {
  return AppBrandDataSchema.parse(raw ?? {});
}

function readableTextOn(hex: string): string {
  const raw = hex.trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (full.length !== 6) return "#ffffff";
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return "#ffffff";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? "#12141a" : "#ffffff";
}

function allElements(data: ProjectData): PlayableElement[] {
  return [...data.startScreen.elements, ...data.endScreen.elements, ...data.gameplay.overlays];
}

function setImageSlot(
  data: ProjectData,
  id: string,
  url: string,
  visibility: { portrait: boolean; landscape: boolean },
) {
  for (const el of allElements(data)) {
    if (el.id !== id) continue;
    el.content.imageUrl = url;
    el.layout.portrait.visible = Boolean(url) && visibility.portrait;
    el.layout.landscape.visible = Boolean(url) && visibility.landscape;
  }
}

function applyAppBrandKit(data: ProjectData, kit: AppBrandData) {
  ensureAppBrandLayers(data);
  if (kit.appStoreUrl) data.links.appStoreUrl = kit.appStoreUrl;
  if (kit.googlePlayUrl) data.links.googlePlayUrl = kit.googlePlayUrl;
  if (kit.coinImageUrl) stampCoinImage(data, kit.coinImageUrl);

  setImageSlot(data, APP_BRAND_VERTICAL_LOGO_ID, kit.logoVerticalUrl, {
    portrait: true,
    landscape: false,
  });
  setImageSlot(data, APP_BRAND_HORIZONTAL_LOGO_ID, kit.logoHorizontalUrl, {
    portrait: false,
    landscape: true,
  });
  setImageSlot(data, APP_BRAND_ICON_ID, kit.appIconUrl, { portrait: true, landscape: true });

  if (kit.logoVerticalUrl || kit.logoHorizontalUrl) {
    for (const el of allElements(data)) {
      if (!BRAND_LOGO_SLOT_IDS.includes(el.id)) continue;
      el.layout.portrait.visible = false;
      el.layout.landscape.visible = false;
    }
  }

  const showDisclaimer = Boolean(kit.disclaimerText.trim());
  for (const el of allElements(data)) {
    if (!APP_BRAND_DISCLAIMER_IDS.includes(el.id)) continue;
    el.content.text = kit.disclaimerText;
    el.layout.portrait.visible = showDisclaimer;
    el.layout.landscape.visible = showDisclaimer;
  }

  const primary = kit.primaryColor || "#e07a3d";
  const secondary = kit.secondaryColor || "#1c1f2a";
  const primaryText = readableTextOn(primary);
  const secondaryText = readableTextOn(secondary);
  for (const el of allElements(data)) {
    if (el.id === "end-cta" || el.id === "cta-button") {
      el.style.backgroundColor = primary;
      el.style.textColor = primaryText;
    }
    if (
      el.id === "app-store-button" ||
      el.id === "google-play-button" ||
      el.id === "end-app-store" ||
      el.id === "end-google-play"
    ) {
      el.style.backgroundColor = secondary;
      el.style.textColor = secondaryText;
    }
  }
}

export function parseOverrides(raw: unknown): VariationOverrides {
  const parsed = VariationOverridesSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : { elements: {}, unlockedSlotIds: [] };
}

/**
 * Live-merge a personal template onto a variation's playable.
 * Gameplay 3D config always comes from the variation.
 * Template wins for locked slot layers + store links + coin; overrides win for copy and button colors.
 * Unlocked slots keep the variation's version.
 */
export function resolvePlayable(
  projectData: ProjectData,
  brand: BrandData | null | undefined,
  overrides?: VariationOverrides | null,
  appBrand?: AppBrandData | null,
) : ProjectData {
  const parsedOverrides = overrides ?? { elements: {}, unlockedSlotIds: [] };
  const unlocked = new Set(parsedOverrides.unlockedSlotIds ?? []);
  const result = ensureAppBrandLayers(structuredClone(projectData));
  if (brand) {
    if (!unlocked.has(UNLOCK_LINKS_SLOT_ID)) {
      result.links = { ...brand.links };
    }
    if (brand.coinImageUrl && !unlocked.has(UNLOCK_COIN_SLOT_ID)) {
      stampCoinImage(result, brand.coinImageUrl);
    }
    if (!unlocked.has(UNLOCK_START_BG_SLOT_ID)) {
      result.startScreen.background = structuredClone(brand.startScreen.background);
      result.startScreen.videoUrl = brand.startScreen.videoUrl;
      result.startScreen.startAfterVideo = brand.startScreen.startAfterVideo;
    }
    upsertElements(result.startScreen.elements, brand.startScreen.elements, unlocked);
    if (!unlocked.has(UNLOCK_END_BG_SLOT_ID)) {
      result.endScreen.background = structuredClone(brand.endScreen.background);
      result.endScreen.videoUrl = brand.endScreen.videoUrl;
      result.endScreen.startAfterVideo = brand.endScreen.startAfterVideo;
    }
    upsertElements(result.endScreen.elements, brand.endScreen.elements, unlocked);
    upsertElements(result.gameplay.overlays, brand.overlays, unlocked);
  }
  applyOverrides(result, parsedOverrides, unlocked);
  if (appBrand) applyAppBrandKit(result, appBrand);
  return result;
}

export function extractOverrides(
  merged: ProjectData,
  brand: BrandData | null | undefined,
  overridableIds: readonly string[],
  previous?: VariationOverrides | null,
): VariationOverrides {
  const unlockedSlotIds = [...(previous?.unlockedSlotIds ?? [])];
  const unlocked = new Set(unlockedSlotIds);
  if (!brand) return { elements: {}, unlockedSlotIds };
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
    if (unlocked.has(el.id)) continue;
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
  return { elements, unlockedSlotIds };
}
