import {
  APP_BRAND_DISCLAIMER_ID,
  APP_BRAND_HORIZONTAL_LOGO_ID,
  APP_BRAND_ICON_ID,
  APP_BRAND_VERTICAL_LOGO_ID,
  DEFAULT_DRESS_UP_CONFIG,
  DEFAULT_MATCH3_CONFIG,
  DEFAULT_WATER_SORT_CONFIG,
  GAMEPLAY_DISCLAIMER_ID,
  START_DISCLAIMER_ID,
  layout,
  type Background,
  type PlayableElement,
  type ProjectData,
  type TemplateId,
} from "@/types/project";
import { DEFAULT_PARKING_CARS, defaultParkingRoundsPack } from "@/playable-runtime/engines/parking-jam/layout";
import { defaultMatchRoundsPack } from "@/playable-runtime/engines/triple-match/rounds";
import { defaultLaneRoundsPack } from "@/playable-runtime/engines/lane-runner/rounds";
import { defaultTdRoundsPack } from "@/playable-runtime/engines/tower-defense/rounds";
import { defaultStackRoundsPack } from "@/playable-runtime/engines/stack-tower/rounds";
import { defaultSolitaireRoundsPack } from "@/playable-runtime/engines/solitaire/rounds";
import { defaultDominoRoundsPack } from "@/playable-runtime/engines/domino/rounds";
import { defaultTappyRoundsPack } from "@/playable-runtime/engines/tappy-plane/rounds";
import { defaultRacingRoundsPack } from "@/playable-runtime/engines/racing-lap/rounds";
import { defaultShooterRoundsPack } from "@/playable-runtime/engines/top-down-shooter/rounds";

export const TEMPLATE_NAMES: Record<TemplateId, string> = {
  "stack-tower": "Stack Tower",
  "triple-match": "Triple Stack 3D",
  "lane-runner": "Endless Car Driving",
  "parking-jam": "Parking Jam",
  "parking-2d": "Parking Jam 2D",
  "tower-defense": "Tower Defense",
  "water-sort": "Water Sort",
  "match-3": "Match-3",
  solitaire: "Solitaire",
  domino: "Domino",
  "tappy-plane": "Tappy Plane",
  "racing-lap": "Racing Lap",
  "top-down-shooter": "Top-down Shooter",
  "dress-up": "Fashion Dress-Up",
};

export const TEMPLATE_BLURBS: Record<TemplateId, string> = {
  "stack-tower": "Drop and stack blocks. Collect coins across rounds.",
  "triple-match": "Tap matching snacks into a tray. Three of a kind clears.",
  "lane-runner": "Swipe lanes, dodge traffic, collect coins across rounds.",
  "parking-jam": "Slide cars out of a jammed lot. Grid puzzle with tinted vehicles.",
  "parking-2d": "Slide the red car out. Same jam, flat top-down lot.",
  "tower-defense": "Place towers, stop the goblins and zombies. Short wave defense.",
  "water-sort": "Pour matching colors into tubes. Classic 2D puzzle.",
  "match-3": "Swap gems, match three, chase a score across rounds.",
  solitaire: "Classic Klondike. Seven columns, four foundations. A helping hand points at moves.",
  domino: "Beat the computer — match pips, draw when stuck.",
  "tappy-plane": "Tap to flap. Thread the rocks. Beat the gaps.",
  "racing-lap": "Steer with the joystick. Stay on the oval. Finish the laps.",
  "top-down-shooter": "Move with the stick. Auto-fire clears each wave.",
  "dress-up": "Pick a dress, then shoes, then an accessory.",
};

export const MATCH3_PIECE_META = [
  { label: "Heart", color: "#f73778", url: "/demo-assets/new%20pieces/heart-pink.svg" },
  { label: "Diamond", color: "#11a9ed", url: "/demo-assets/new%20pieces/diamond-blue.svg" },
  { label: "Square", color: "#75cf18", url: "/demo-assets/new%20pieces/square-green.svg" },
  { label: "Star", color: "#ffa51d", url: "/demo-assets/new%20pieces/star-orange.svg" },
  { label: "Circle", color: "#9a48ed", url: "/demo-assets/new%20pieces/circle-purple.svg" },
] as const;

export function defaultPieceImages(): string[] {
  return MATCH3_PIECE_META.map((p) => p.url);
}

export const DEMO_URLS = {
  appLogo: "/demo-assets/app-logo.svg",
  decorative: "/demo-assets/decorative.svg",
  character: "/demo-assets/character.svg",
  bgStartPortrait: "/demo-assets/bg-start-portrait.svg",
  bgStartLandscape: "/demo-assets/bg-start-landscape.svg",
  bgEndPortrait: "/demo-assets/bg-end-portrait.svg",
  bgEndLandscape: "/demo-assets/bg-end-landscape.svg",
  hand: "/demo-assets/pointer-hand.svg",
} as const;

function textEl(
  id: string,
  name: string,
  text: string,
  portrait: ReturnType<typeof layout>,
  landscape: ReturnType<typeof layout>,
  extras: Partial<PlayableElement["content"]> = {},
): PlayableElement {
  return {
    id,
    type: "text",
    name,
    content: {
      text,
      fontFamily: "system-ui, sans-serif",
      fontSize: 28,
      fontWeight: 700,
      textAlign: "center",
      color: "#f3ede0",
      lineHeight: 1.2,
      letterSpacing: 0,
      ...extras,
    },
    style: {},
    layout: { portrait, landscape },
    action: { type: "NONE" },
    permanentlyLocked: false,
  };
}

function buttonEl(
  id: string,
  name: string,
  text: string,
  action: PlayableElement["action"]["type"],
  portrait: ReturnType<typeof layout>,
  landscape: ReturnType<typeof layout>,
  style: Partial<PlayableElement["style"]> = {},
): PlayableElement {
  return {
    id,
    type: "button",
    name,
    content: { text },
    style: {
      backgroundColor: "#e07a3d",
      textColor: "#ffffff",
      borderColor: "transparent",
      borderWidth: 0,
      borderRadius: 16,
      shadow: "0 8px 24px rgba(0,0,0,0.25)",
      pressAnimation: "scale",
      ...style,
    },
    layout: { portrait, landscape },
    action: { type: action },
    permanentlyLocked: false,
  };
}

function storeButton(
  id: string,
  store: "appStore" | "googlePlay",
  portrait: ReturnType<typeof layout>,
  landscape: ReturnType<typeof layout>,
): PlayableElement {
  return {
    id,
    type: "storeButton",
    name: store === "appStore" ? "App Store" : "Google Play",
    content: {
      text: store === "appStore" ? "Download on the App Store" : "Get it on Google Play",
      store,
    },
    style: {
      backgroundColor: "#1c1f2a",
      textColor: "#f3ede0",
      borderRadius: 12,
      borderWidth: 0,
      borderColor: "transparent",
      shadow: "0 4px 12px rgba(0,0,0,0.2)",
      pressAnimation: "scale",
    },
    layout: { portrait, landscape },
    action: {
      type: store === "appStore" ? "OPEN_APP_STORE" : "OPEN_GOOGLE_PLAY",
    },
    permanentlyLocked: false,
  };
}

function imageEl(
  id: string,
  name: string,
  portrait: ReturnType<typeof layout>,
  landscape: ReturnType<typeof layout>,
  imageUrl = "",
): PlayableElement {
  return {
    id,
    type: "image",
    name,
    content: { imageUrl },
    style: {},
    layout: { portrait, landscape },
    action: { type: "NONE" },
    permanentlyLocked: false,
  };
}

function imageBackground(
  portraitUrl: string,
  landscapeUrl: string,
  overlayOpacity = 0.35,
): Background {
  return {
    type: "image",
    color: "#12141a",
    gradientFrom: "#1c1f2a",
    gradientTo: "#12141a",
    gradientAngle: 180,
    portraitImageUrl: portraitUrl,
    landscapeImageUrl: landscapeUrl,
    portraitVideoUrl: "",
    landscapeVideoUrl: "",
    imageFit: "cover",
    imagePosition: "center",
    overlayColor: "#000000",
    overlayOpacity,
  };
}

function canvasBackground(
  type: Background["type"],
  color: string,
  gradientFrom: string,
  gradientTo: string,
): Background {
  return {
    type,
    color,
    gradientFrom,
    gradientTo,
    gradientAngle: 180,
    portraitVideoUrl: "",
    landscapeVideoUrl: "",
    imageFit: "cover",
    imagePosition: "center",
    overlayColor: "#000000",
    overlayOpacity: 0,
  };
}

function muteButton(
  portrait: ReturnType<typeof layout>,
  landscape: ReturnType<typeof layout>,
): PlayableElement {
  return {
    id: "mute-button",
    type: "muteButton",
    name: "Mute",
    content: { text: "🔊" },
    style: {
      backgroundColor: "rgba(0,0,0,0.45)",
      textColor: "#ffffff",
      borderRadius: 999,
    },
    layout: { portrait, landscape },
    action: { type: "MUTE" },
    permanentlyLocked: false,
  };
}

export function createEndPolicyElement(): PlayableElement {
  const el = textEl(
    "end-policy",
    "Privacy Policy",
    "Privacy Policy",
    layout({ x: 0.15, y: 0.91, width: 0.7, height: 0.04, zIndex: 6 }),
    layout({ x: 0.35, y: 0.93, width: 0.5, height: 0.05, zIndex: 6 }),
    { fontSize: 12, fontWeight: 500, color: "#c4bfb4" },
  );
  el.action = { type: "OPEN_POLICY" };
  return el;
}

function orientationLogo(
  id: string,
  name: string,
  portrait: ReturnType<typeof layout>,
  landscape: ReturnType<typeof layout>,
): PlayableElement {
  return imageEl(id, name, portrait, landscape, "");
}

export function createAppLogoVerticalElement(stage: "start" | "gameplay" | "end"): PlayableElement {
  if (stage === "gameplay") {
    return orientationLogo(
      APP_BRAND_VERTICAL_LOGO_ID,
      "App Logo Vertical",
      layout({ x: 0.35, y: 0.02, width: 0.3, height: 0.08, zIndex: 21, visible: false }),
      layout({ x: 0.02, y: 0.05, width: 0.12, height: 0.18, zIndex: 21, visible: false }),
    );
  }
  if (stage === "end") {
    return orientationLogo(
      APP_BRAND_VERTICAL_LOGO_ID,
      "App Logo Vertical",
      layout({ x: 0.35, y: 0.08, width: 0.3, height: 0.1, zIndex: 3, visible: false }),
      layout({ x: 0.08, y: 0.2, width: 0.16, height: 0.18, zIndex: 3, visible: false }),
    );
  }
  return orientationLogo(
    APP_BRAND_VERTICAL_LOGO_ID,
    "App Logo Vertical",
    layout({ x: 0.35, y: 0.08, width: 0.3, height: 0.12, zIndex: 3, visible: false }),
    layout({ x: 0.08, y: 0.15, width: 0.18, height: 0.2, zIndex: 3, visible: false }),
  );
}

export function createAppLogoHorizontalElement(stage: "start" | "gameplay" | "end"): PlayableElement {
  if (stage === "gameplay") {
    return orientationLogo(
      APP_BRAND_HORIZONTAL_LOGO_ID,
      "App Logo Horizontal",
      layout({ x: 0.28, y: 0.02, width: 0.44, height: 0.06, zIndex: 21, visible: false }),
      layout({ x: 0.02, y: 0.06, width: 0.2, height: 0.1, zIndex: 21, visible: false }),
    );
  }
  if (stage === "end") {
    return orientationLogo(
      APP_BRAND_HORIZONTAL_LOGO_ID,
      "App Logo Horizontal",
      layout({ x: 0.22, y: 0.08, width: 0.56, height: 0.08, zIndex: 3, visible: false }),
      layout({ x: 0.06, y: 0.22, width: 0.24, height: 0.12, zIndex: 3, visible: false }),
    );
  }
  return orientationLogo(
    APP_BRAND_HORIZONTAL_LOGO_ID,
    "App Logo Horizontal",
    layout({ x: 0.22, y: 0.08, width: 0.56, height: 0.1, zIndex: 3, visible: false }),
    layout({ x: 0.06, y: 0.16, width: 0.28, height: 0.14, zIndex: 3, visible: false }),
  );
}

export function createAppIconElement(_stage: "start" | "end"): PlayableElement {
  return imageEl(
    APP_BRAND_ICON_ID,
    "App Icon",
    layout({ x: 0.03, y: 0.03, width: 0.1, height: 0.06, zIndex: 12, visible: false }),
    layout({ x: 0.02, y: 0.04, width: 0.06, height: 0.1, zIndex: 12, visible: false }),
    "",
  );
}

function createDisclaimerElement(id: string, zIndex = 6): PlayableElement {
  return textEl(
    id,
    "Disclaimer",
    "",
    layout({ x: 0.08, y: 0.945, width: 0.84, height: 0.04, zIndex, visible: false }),
    layout({ x: 0.22, y: 0.94, width: 0.56, height: 0.05, zIndex, visible: false }),
    { fontSize: 10, fontWeight: 500, color: "#8a8494" },
  );
}

export function createStartDisclaimerElement(): PlayableElement {
  return createDisclaimerElement(START_DISCLAIMER_ID);
}

export function createEndDisclaimerElement(): PlayableElement {
  return createDisclaimerElement(APP_BRAND_DISCLAIMER_ID);
}

export function createGameplayDisclaimerElement(): PlayableElement {
  return createDisclaimerElement(GAMEPLAY_DISCLAIMER_ID, 23);
}

function insertIfMissing(list: PlayableElement[], el: PlayableElement, afterId?: string) {
  if (list.some((item) => item.id === el.id)) return;
  const after = afterId ? list.findIndex((item) => item.id === afterId) : -1;
  if (after >= 0) {
    list.splice(after + 1, 0, el);
    return;
  }
  list.unshift(el);
}

/** Add identity-kit layers to stored playables that predate them. */
export function ensureAppBrandLayers(data: ProjectData): ProjectData {
  insertIfMissing(data.startScreen.elements, createAppLogoVerticalElement("start"), "app-logo");
  insertIfMissing(data.startScreen.elements, createAppLogoHorizontalElement("start"), APP_BRAND_VERTICAL_LOGO_ID);
  insertIfMissing(data.startScreen.elements, createAppIconElement("start"));
  insertIfMissing(data.startScreen.elements, createStartDisclaimerElement());
  insertIfMissing(data.endScreen.elements, createAppLogoVerticalElement("end"), "end-app-logo");
  insertIfMissing(data.endScreen.elements, createAppLogoHorizontalElement("end"), APP_BRAND_VERTICAL_LOGO_ID);
  insertIfMissing(data.endScreen.elements, createAppIconElement("end"));
  insertIfMissing(data.endScreen.elements, createEndDisclaimerElement());
  insertIfMissing(data.gameplay.overlays, createAppLogoVerticalElement("gameplay"), "gameplay-logo");
  insertIfMissing(data.gameplay.overlays, createAppLogoHorizontalElement("gameplay"), APP_BRAND_VERTICAL_LOGO_ID);
  insertIfMissing(data.gameplay.overlays, createGameplayDisclaimerElement());
  return data;
}

/** Keep project-level coin and every template slot in sync. */
export function stampCoinImage(data: ProjectData, url: string) {
  data.coinImageUrl = url;
  data.gameplay.tripleMatch.coinImageUrl = url;
  data.gameplay.laneRunner.coinImageUrl = url;
  data.gameplay.parkingJam.coinImageUrl = url;
  data.gameplay.parking2d.coinImageUrl = url;
  data.gameplay.towerDefense.coinImageUrl = url;
  data.gameplay.stackTower.coinImageUrl = url;
  data.gameplay.match3.coinImageUrl = url;
  data.gameplay.waterSort.coinImageUrl = url;
  data.gameplay.solitaire.coinImageUrl = url;
  data.gameplay.domino.coinImageUrl = url;
  data.gameplay.tappyPlane.coinImageUrl = url;
  data.gameplay.racingLap.coinImageUrl = url;
  data.gameplay.topDownShooter.coinImageUrl = url;
}

const KITCHEN_CREAM = "#f4ead8";
const KITCHEN_INK = "#3a2a18";
const KITCHEN_SHADOW = "0 2px 8px rgba(58,42,24,0.18)";

export function applyTripleMatchKitchenChrome(gameplay: ProjectData["gameplay"]): void {
  gameplay.stageBackground = {
    portrait: canvasBackground("solid", "#f3ead8", "#f3ead8", "#e8dcc8"),
    landscape: canvasBackground("solid", "#f3ead8", "#f3ead8", "#e8dcc8"),
  };

  const hide = (id: string) => {
    const el = gameplay.overlays.find((item) => item.id === id);
    if (!el) return;
    el.layout.portrait.visible = false;
    el.layout.landscape.visible = false;
  };
  hide("gameplay-logo");
  hide("gameplay-label");

  const timer = gameplay.overlays.find((el) => el.id === "gameplay-timer");
  if (timer) {
    timer.content.color = KITCHEN_INK;
    timer.content.warningColor = "#c45a3a";
    timer.content.fontSize = 15;
    timer.style.backgroundColor = KITCHEN_CREAM;
    timer.style.shadow = KITCHEN_SHADOW;
    timer.style.borderRadius = 999;
    timer.layout.portrait = layout({ x: 0.36, y: 0.014, width: 0.28, height: 0.048, zIndex: 23 });
    timer.layout.landscape = layout({ x: 0.4, y: 0.035, width: 0.2, height: 0.1, zIndex: 23 });
  }

  const mute = gameplay.overlays.find((el) => el.id === "mute-button");
  if (mute) {
    mute.style.backgroundColor = KITCHEN_CREAM;
    mute.style.textColor = KITCHEN_INK;
    mute.style.shadow = KITCHEN_SHADOW;
    mute.layout.portrait = layout({ x: 0.875, y: 0.014, width: 0.1, height: 0.048, zIndex: 22 });
    mute.layout.landscape = layout({ x: 0.91, y: 0.035, width: 0.065, height: 0.1, zIndex: 22 });
  }

  const box = gameplay.overlays.find((el) => el.id === "gameplay-container");
  if (box) {
    box.layout.portrait = layout({
      x: 0.01,
      y: 0,
      width: 0.98,
      height: 1,
      zIndex: 1,
      locked: true,
    });
    box.layout.landscape = layout({
      x: 0.02,
      y: 0,
      width: 0.96,
      height: 1,
      zIndex: 1,
      locked: true,
    });
  }

  gameplay.camera.portrait.fov = 48;
  gameplay.camera.landscape.fov = 40;
}

export function ensureTripleMatchKitchenChrome(data: ProjectData): void {
  applyTripleMatchKitchenChrome(data.gameplay);
}

const WATER_SORT_SKY = "#d7eaf7";
const WATER_SORT_CREAM = "#f7f1e4";
const WATER_SORT_INK = "#1f3347";
const WATER_SORT_CHIP = "#fffaf3";
const WATER_SORT_SHADOW = "0 2px 8px rgba(31,51,71,0.14)";

export function applyWaterSortChrome(gameplay: ProjectData["gameplay"]): void {
  gameplay.background = {
    portrait: canvasBackground("gradient", "#eaf4fb", WATER_SORT_SKY, WATER_SORT_CREAM),
    landscape: canvasBackground("gradient", "#eaf4fb", WATER_SORT_SKY, WATER_SORT_CREAM),
  };
  gameplay.stageBackground = {
    portrait: canvasBackground("gradient", "#eaf4fb", WATER_SORT_SKY, WATER_SORT_CREAM),
    landscape: canvasBackground("gradient", "#eaf4fb", WATER_SORT_SKY, WATER_SORT_CREAM),
  };

  const hide = (id: string) => {
    const el = gameplay.overlays.find((item) => item.id === id);
    if (!el) return;
    el.layout.portrait.visible = false;
    el.layout.landscape.visible = false;
  };
  hide("gameplay-logo");
  hide("gameplay-label");

  const timer = gameplay.overlays.find((el) => el.id === "gameplay-timer");
  if (timer) {
    const portraitVisible = timer.layout.portrait.visible;
    const landscapeVisible = timer.layout.landscape.visible;
    timer.content.color = WATER_SORT_INK;
    timer.content.warningColor = "#c45a3a";
    timer.content.fontSize = 15;
    timer.style.backgroundColor = WATER_SORT_CHIP;
    timer.style.shadow = WATER_SORT_SHADOW;
    timer.style.borderRadius = 999;
    timer.layout.portrait = layout({
      x: 0.36,
      y: 0.016,
      width: 0.28,
      height: 0.052,
      zIndex: 23,
      visible: portraitVisible,
    });
    timer.layout.landscape = layout({
      x: 0.4,
      y: 0.03,
      width: 0.2,
      height: 0.1,
      zIndex: 23,
      visible: landscapeVisible,
    });
  }

  const mute = gameplay.overlays.find((el) => el.id === "mute-button");
  if (mute) {
    const portraitVisible = mute.layout.portrait.visible;
    const landscapeVisible = mute.layout.landscape.visible;
    mute.style.backgroundColor = WATER_SORT_CHIP;
    mute.style.textColor = WATER_SORT_INK;
    mute.style.shadow = WATER_SORT_SHADOW;
    mute.layout.portrait = layout({
      x: 0.86,
      y: 0.016,
      width: 0.11,
      height: 0.052,
      zIndex: 22,
      visible: portraitVisible,
    });
    mute.layout.landscape = layout({
      x: 0.92,
      y: 0.03,
      width: 0.06,
      height: 0.1,
      zIndex: 22,
      visible: landscapeVisible,
    });
  }

  const box = gameplay.overlays.find((el) => el.id === "gameplay-container");
  if (box) {
    box.layout.portrait = layout({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      zIndex: 1,
      locked: true,
    });
    box.layout.landscape = layout({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      zIndex: 1,
      locked: true,
    });
  }
}

export function ensureWaterSortChrome(data: ProjectData): void {
  applyWaterSortChrome(data.gameplay);
}

const PARKING_2D_GRASS = "#4f8f38";

/** Drop the shared sky-and-trees scene and let the lot fill the phone. */
export function applyParking2DChrome(gameplay: ProjectData["gameplay"]): void {
  const full = gameplay.fullBackground;
  const portrait = full.portraitImageUrl || "";
  const landscape = full.landscapeImageUrl || "";
  if (portrait.includes("bg-gameplay") || landscape.includes("bg-gameplay")) {
    full.enabled = false;
    full.portraitImageUrl = "";
    full.landscapeImageUrl = "";
  }
  gameplay.stageBackground = {
    portrait: canvasBackground("solid", PARKING_2D_GRASS, PARKING_2D_GRASS, "#3d7330"),
    landscape: canvasBackground("solid", PARKING_2D_GRASS, PARKING_2D_GRASS, "#3d7330"),
  };
  const box = gameplay.overlays.find((el) => el.id === "gameplay-container");
  if (box) {
    box.layout.portrait = layout({ x: 0, y: 0.1, width: 1, height: 0.9, zIndex: 1, locked: true });
    box.layout.landscape = layout({ x: 0, y: 0, width: 1, height: 1, zIndex: 1, locked: true });
  }
}

export function ensureParking2DChrome(data: ProjectData): void {
  applyParking2DChrome(data.gameplay);
}

export function createGameplayTimerOverlay(): PlayableElement {
  return {
    id: "gameplay-timer",
    type: "timer",
    name: "Timer",
    content: {
      durationSeconds: 30,
      warningSeconds: 10,
      warningColor: "#e85d4c",
      color: "#f3ede0",
      fontSize: 16,
      fontWeight: 800,
      textAlign: "center",
      fontFamily: "system-ui, sans-serif",
    },
    style: {
      backgroundColor: "#1c1f2a",
      borderRadius: 999,
    },
    layout: {
      portrait: layout({ x: 0.38, y: 0.105, width: 0.24, height: 0.048, zIndex: 23 }),
      landscape: layout({ x: 0.41, y: 0.02, width: 0.16, height: 0.08, zIndex: 23 }),
    },
    action: { type: "NONE" },
    permanentlyLocked: false,
  };
}

function createStartScreen(templateId: TemplateId): ProjectData["startScreen"] {
  const templateName = TEMPLATE_NAMES[templateId];
  return {
    background: imageBackground(DEMO_URLS.bgStartPortrait, DEMO_URLS.bgStartLandscape, 0.28),
    videoUrl: "",
    startAfterVideo: false,
    hidden: false,
    elements: [
      imageEl(
        "app-logo",
        "App Logo",
        layout({ x: 0.35, y: 0.08, width: 0.3, height: 0.12, zIndex: 2 }),
        layout({ x: 0.08, y: 0.15, width: 0.18, height: 0.2, zIndex: 2 }),
        DEMO_URLS.appLogo,
      ),
      createAppLogoVerticalElement("start"),
      createAppLogoHorizontalElement("start"),
      createAppIconElement("start"),
      textEl(
        "headline",
        "Headline",
        `Play ${templateName}`,
        layout({ x: 0.08, y: 0.32, width: 0.84, height: 0.1, zIndex: 4 }),
        layout({ x: 0.4, y: 0.18, width: 0.52, height: 0.14, zIndex: 4 }),
        { fontSize: 34 },
      ),
      textEl(
        "subtitle",
        "Subtitle",
        templateId === "tower-defense"
          ? "Pick a tower, tap a glowing pad. Stop the monsters."
          : templateId === "parking-2d"
            ? "Slide cars. Free the red one."
          : templateId === "water-sort"
            ? "Pour matching colors. Fill every tube."
            : templateId === "match-3"
              ? "Swap gems. Match three. Beat the rounds."
              : templateId === "solitaire"
                ? "Tap cards onto foundations. The hand shows a move."
                : templateId === "domino"
                  ? "Match the chain. Three of a kind? No — matching pips."
                  : templateId === "tappy-plane"
                    ? "Tap to flap. Slip between the rocks."
                    : templateId === "racing-lap"
                      ? "Steer the oval. Finish the laps."
                      : templateId === "top-down-shooter"
                        ? "Move with the stick. Survive the waves."
                        : templateId === "dress-up"
                          ? "Pick a dress, then shoes, then an accessory."
              : templateId === "stack-tower"
                ? "Tap to drop blocks. Stack them. Beat the rounds."
                : "Tap to start. One round. Install at the end.",
        layout({ x: 0.1, y: 0.44, width: 0.8, height: 0.06, zIndex: 4 }),
        layout({ x: 0.4, y: 0.34, width: 0.52, height: 0.1, zIndex: 4 }),
        { fontSize: 16, fontWeight: 500, color: "#c4bfb4" },
      ),
      buttonEl(
        "cta-button",
        "CTA Button",
        "Play Now",
        "START_PLAYABLE",
        layout({ x: 0.2, y: 0.62, width: 0.6, height: 0.08, zIndex: 5 }),
        layout({ x: 0.48, y: 0.52, width: 0.36, height: 0.12, zIndex: 5 }),
      ),
      storeButton(
        "app-store-button",
        "appStore",
        layout({ x: 0.1, y: 0.76, width: 0.38, height: 0.06, zIndex: 5 }),
        layout({ x: 0.42, y: 0.7, width: 0.22, height: 0.1, zIndex: 5 }),
      ),
      storeButton(
        "google-play-button",
        "googlePlay",
        layout({ x: 0.52, y: 0.76, width: 0.38, height: 0.06, zIndex: 5 }),
        layout({ x: 0.68, y: 0.7, width: 0.22, height: 0.1, zIndex: 5 }),
      ),
      imageEl(
        "decorative-image",
        "Decorative Image",
        layout({ x: 0.05, y: 0.05, width: 0.18, height: 0.12, zIndex: 1 }),
        layout({ x: 0.05, y: 0.7, width: 0.14, height: 0.2, zIndex: 1 }),
        DEMO_URLS.decorative,
      ),
      muteButton(
        layout({ x: 0.88, y: 0.03, width: 0.09, height: 0.05, zIndex: 10 }),
        layout({ x: 0.93, y: 0.04, width: 0.05, height: 0.08, zIndex: 10 }),
      ),
      createStartDisclaimerElement(),
    ],
  };
}

function createEndScreen(): ProjectData["endScreen"] {
  return {
    background: imageBackground(DEMO_URLS.bgEndPortrait, DEMO_URLS.bgEndLandscape, 0.4),
    videoUrl: "",
    startAfterVideo: false,
    hidden: false,
    elements: [
      imageEl(
        "end-app-logo",
        "App Logo",
        layout({ x: 0.35, y: 0.08, width: 0.3, height: 0.1, zIndex: 2 }),
        layout({ x: 0.08, y: 0.2, width: 0.16, height: 0.18, zIndex: 2 }),
        DEMO_URLS.appLogo,
      ),
      createAppLogoVerticalElement("end"),
      createAppLogoHorizontalElement("end"),
      createAppIconElement("end"),
      textEl(
        "end-headline",
        "Headline",
        "Great Job!",
        layout({ x: 0.1, y: 0.28, width: 0.8, height: 0.08, zIndex: 4 }),
        layout({ x: 0.42, y: 0.16, width: 0.5, height: 0.12, zIndex: 4 }),
        { fontSize: 34 },
      ),
      textEl(
        "end-subtitle",
        "Subtitle",
        "Download now and keep playing",
        layout({ x: 0.1, y: 0.38, width: 0.8, height: 0.06, zIndex: 4 }),
        layout({ x: 0.42, y: 0.3, width: 0.5, height: 0.1, zIndex: 4 }),
        { fontSize: 16, fontWeight: 500, color: "#c4bfb4" },
      ),
      {
        id: "star-rating",
        type: "starRating" as const,
        name: "Star Rating",
        content: { stars: 5, text: "★★★★★", color: "#e0b04a", fontSize: 28, textAlign: "center" as const },
        style: {},
        layout: {
          portrait: layout({ x: 0.25, y: 0.46, width: 0.5, height: 0.05, zIndex: 4 }),
          landscape: layout({ x: 0.5, y: 0.4, width: 0.32, height: 0.08, zIndex: 4 }),
        },
        action: { type: "NONE" as const },
        permanentlyLocked: false,
      },
      buttonEl(
        "end-cta",
        "CTA Button",
        "Download Now",
        "OPEN_APP_STORE",
        layout({ x: 0.2, y: 0.56, width: 0.6, height: 0.08, zIndex: 5 }),
        layout({ x: 0.48, y: 0.52, width: 0.36, height: 0.12, zIndex: 5 }),
      ),
      storeButton(
        "end-app-store",
        "appStore",
        layout({ x: 0.1, y: 0.7, width: 0.38, height: 0.06, zIndex: 5 }),
        layout({ x: 0.42, y: 0.7, width: 0.22, height: 0.1, zIndex: 5 }),
      ),
      storeButton(
        "end-google-play",
        "googlePlay",
        layout({ x: 0.52, y: 0.7, width: 0.38, height: 0.06, zIndex: 5 }),
        layout({ x: 0.68, y: 0.7, width: 0.22, height: 0.1, zIndex: 5 }),
      ),
      buttonEl(
        "replay-button",
        "Replay",
        "Play Again",
        "REPLAY",
        layout({ x: 0.25, y: 0.82, width: 0.5, height: 0.06, zIndex: 5 }),
        layout({ x: 0.5, y: 0.84, width: 0.3, height: 0.08, zIndex: 5 }),
        { backgroundColor: "#2a2e3a" },
      ),
      muteButton(
        layout({ x: 0.88, y: 0.03, width: 0.09, height: 0.05, zIndex: 10 }),
        layout({ x: 0.93, y: 0.04, width: 0.05, height: 0.08, zIndex: 10 }),
      ),
      createEndDisclaimerElement(),
    ],
  };
}

function createGameplayOverlays(templateId: TemplateId): ProjectData["gameplay"] {
  const gameplay: ProjectData["gameplay"] = {
    allowBackgroundReplace: true,
    fullBackground: {
      enabled: true,
      portraitImageUrl: "/demo-assets/bg-gameplay.webp",
      landscapeImageUrl: "/demo-assets/bg-gameplay.webp",
      imageFit: "cover" as const,
    },
    background:
      templateId === "match-3"
        ? {
            portrait: canvasBackground("gradient", "#12143a", "#1e2470", "#0e1028"),
            landscape: canvasBackground("gradient", "#12143a", "#1e2470", "#0e1028"),
          }
        : templateId === "solitaire"
          ? {
              portrait: canvasBackground("gradient", "#14532d", "#166534", "#052e16"),
              landscape: canvasBackground("gradient", "#14532d", "#166534", "#052e16"),
            }
          : templateId === "domino"
            ? {
                portrait: canvasBackground("gradient", "#1e293b", "#334155", "#0f172a"),
                landscape: canvasBackground("gradient", "#1e293b", "#334155", "#0f172a"),
              }
            : templateId === "tappy-plane"
              ? {
                  portrait: canvasBackground("gradient", "#38bdf8", "#7dd3fc", "#0ea5e9"),
                  landscape: canvasBackground("gradient", "#38bdf8", "#7dd3fc", "#0ea5e9"),
                }
              : templateId === "racing-lap"
                ? {
                    portrait: canvasBackground("gradient", "#3f6212", "#4d7c0f", "#1a2e05"),
                    landscape: canvasBackground("gradient", "#3f6212", "#4d7c0f", "#1a2e05"),
                  }
                : templateId === "top-down-shooter"
                  ? {
                      portrait: canvasBackground("gradient", "#3f6212", "#4d7c0f", "#1a2e05"),
                      landscape: canvasBackground("gradient", "#3f6212", "#4d7c0f", "#1a2e05"),
                    }
                  : templateId === "dress-up"
                    ? {
                        portrait: imageBackground(
                          "/playforge-dressup-playable/runway-portrait-882x1920.png",
                          "/playforge-dressup-playable/runway-landscape-1920x882.png",
                          0.12,
                        ),
                        landscape: imageBackground(
                          "/playforge-dressup-playable/runway-portrait-882x1920.png",
                          "/playforge-dressup-playable/runway-landscape-1920x882.png",
                          0.12,
                        ),
                      }
                  : templateId === "water-sort"
                    ? {
                        portrait: canvasBackground("gradient", "#eaf4fb", "#d7eaf7", "#f7f1e4"),
                        landscape: canvasBackground("gradient", "#eaf4fb", "#d7eaf7", "#f7f1e4"),
                      }
        : {
            portrait: canvasBackground("gradient", "#12141a", "#1c1f2a", "#12141a"),
            landscape: canvasBackground("gradient", "#12141a", "#1c1f2a", "#12141a"),
          },
    stageBackground:
      templateId === "parking-2d"
        ? {
            portrait: canvasBackground("solid", "#4f8f38", "#4f8f38", "#3d7330"),
            landscape: canvasBackground("solid", "#4f8f38", "#4f8f38", "#3d7330"),
          }
        : templateId === "parking-jam" || templateId === "tower-defense"
        ? {
            portrait: canvasBackground("gradient", "#1c2430", "#9aafc2", "#1a2230"),
            landscape: canvasBackground("gradient", "#1c2430", "#9aafc2", "#1a2230"),
          }
        : templateId === "triple-match"
          ? {
              portrait: canvasBackground("solid", "#f3ead8", "#f3ead8", "#e8dcc8"),
              landscape: canvasBackground("solid", "#f3ead8", "#f3ead8", "#e8dcc8"),
            }
          : templateId === "lane-runner"
            ? {
                portrait: canvasBackground("gradient", "#1c2430", "#9aafc2", "#1a2230"),
                landscape: canvasBackground("gradient", "#1c2430", "#9aafc2", "#1a2230"),
              }
          : templateId === "match-3"
            ? {
                portrait: canvasBackground("gradient", "#12143a", "#1e2470", "#0e1028"),
                landscape: canvasBackground("gradient", "#12143a", "#1e2470", "#0e1028"),
              }
            : templateId === "water-sort"
              ? {
                  portrait: canvasBackground("gradient", "#eaf4fb", "#d7eaf7", "#f7f1e4"),
                  landscape: canvasBackground("gradient", "#eaf4fb", "#d7eaf7", "#f7f1e4"),
                }
            : {
                portrait: canvasBackground("solid", "#12141a", "#12141a", "#0a0b10"),
                landscape: canvasBackground("solid", "#12141a", "#12141a", "#0a0b10"),
              },
    camera:
      templateId === "tower-defense"
        ? {
            portrait: { fov: 40, position: { x: 0, y: 14.6, z: 12.6 }, target: { x: 0, y: 0.2, z: 0.3 } },
            landscape: { fov: 18, position: { x: 0, y: 6, z: 6 }, target: { x: 0, y: 0.2, z: 0.3 } },
          }
        : templateId === "parking-jam"
        ? {
            portrait: { fov: 46, position: { x: 0, y: 11, z: 8 }, target: { x: 0, y: 0, z: 0 } },
            landscape: { fov: 40, position: { x: 0, y: 9, z: 7 }, target: { x: 0, y: 0, z: 0 } },
          }
        : templateId === "triple-match"
          ? {
              portrait: { fov: 48, position: { x: 0, y: 7.6, z: 6.8 }, target: { x: 0, y: 0.06, z: -0.2 } },
              landscape: { fov: 40, position: { x: 0, y: 6.8, z: 7.6 }, target: { x: 0, y: 0.06, z: -0.2 } },
            }
          : templateId === "lane-runner"
            ? {
                portrait: { fov: 90, position: { x: 0, y: 5.2, z: 8.5 }, target: { x: 0, y: 0.4, z: -6 } },
                landscape: { fov: 90, position: { x: 0, y: 5.2, z: 8.5 }, target: { x: 0, y: 0.4, z: -6 } },
              }
            : templateId === "stack-tower"
              ? {
                  portrait: { ...STACK_TOWER_CAMERA.portrait, position: { ...STACK_TOWER_CAMERA.portrait.position }, target: { ...STACK_TOWER_CAMERA.portrait.target } },
                  landscape: { ...STACK_TOWER_CAMERA.landscape, position: { ...STACK_TOWER_CAMERA.landscape.position }, target: { ...STACK_TOWER_CAMERA.landscape.target } },
                }
              : {
                  portrait: { fov: 50, position: { x: 0, y: 8, z: 12 }, target: { x: 0, y: 2, z: 0 } },
                  landscape: { fov: 42, position: { x: 0, y: 6, z: 10 }, target: { x: 0, y: 1.6, z: 0 } },
                },
    lighting: templateId === "lane-runner" ? "sunset" : "studio",
    environment: "gradient-sky",
    audio: { musicUrl: "", tapUrl: "", winUrl: "", loseUrl: "", playFromStart: false },
    stackTower: {
      palette: ["#e07a3d", "#2bb5a0", "#f3ede0", "#7c5cff", "#e85d4c"],
      materialFinish: "glossy",
      faceTextureUrl: "",
      speed: 1.4,
      speedRamp: 0.08,
      blocksToWin: 10,
      missLimit: 3,
      rounds: defaultStackRoundsPack(),
      coinImageUrl: "",
      sounds: { moveUrl: "" },
    },
    tripleMatch: {
      itemSlots: ["apple", "donut", "taco", "burger"],
      trayColor: "#b87914",
      barSlots: 7,
      triplesToWin: 4,
      difficulty: "medium",
      rounds: defaultMatchRoundsPack(),
      coinImageUrl: "",
      sounds: { ambienceUrl: "", moveUrl: "", matchUrl: "", payoutUrl: "" },
    },
    laneRunner: {
      characterModelUrl: "sedan",
      obstacleSet: ["suv", "taxi", "truck", "cone"],
      environmentTheme: "city",
      laneCount: 3,
      startSpeed: 4,
      speedRamp: 0.5,
      laneSwitchSpeed: 10,
      winDistance: 160,
      roadTextureUrl: "",
      grassTextureUrl: "",
      coinImageUrl: "",
      rounds: defaultLaneRoundsPack(),
      sounds: { ambienceUrl: "", moveUrl: "" },
    },
    parkingJam: {
      lotTextureUrl: "",
      grassTextureUrl: "",
      pavementTextureUrl: "",
      carModelUrl: "sedan",
      carColors: ["#ff3b30", "#2bb5a0", "#7c5cff", "#e85d4c", "#f3ede0"],
      movesLimit: 24,
      difficulty: "medium",
      gridCols: 6,
      gridRows: 6,
      cars: DEFAULT_PARKING_CARS.map((c) => ({ ...c })),
      rounds: defaultParkingRoundsPack(),
      coinImageUrl: "",
      sounds: { ambienceUrl: "", moveUrl: "", payoutUrl: "" },
    },
    parking2d: {
      heroCarUrl: "",
      shortCarUrl: "",
      longCarUrl: "",
      exitArrowUrl: "",
      asphaltUrl: "",
      grassUrl: "",
      movesLimit: 24,
      gridCols: 6,
      gridRows: 6,
      cars: DEFAULT_PARKING_CARS.map((c) => ({ ...c })),
      rounds: defaultParkingRoundsPack(),
      coinImageUrl: "",
      sounds: { ambienceUrl: "", moveUrl: "", coinUrl: "", payoutUrl: "" },
    },
    towerDefense: {
      lives: 8,
      startingGold: 80,
      coinImageUrl: "",
      towers: {
        arrow: { cost: 50, damage: 8, range: 1.8, fireRate: 1.5 },
        cannon: { cost: 80, damage: 20, range: 1.7, fireRate: 0.65 },
        turret: { cost: 110, damage: 4, range: 1.4, fireRate: 5 },
      },
      rounds: defaultTdRoundsPack(),
      sounds: {
        arrowFireUrl: "",
        cannonFireUrl: "",
        turretFireUrl: "",
        hitUrl: "",
        deathUrl: "",
        leakUrl: "",
        placeUrl: "",
        waveUrl: "",
      },
    },
    pieceImages: templateId === "match-3" ? defaultPieceImages() : ["", "", "", "", ""],
    match3: { ...DEFAULT_MATCH3_CONFIG },
    waterSort: { ...DEFAULT_WATER_SORT_CONFIG },
    solitaire: {
      failEnabled: true,
      hintHandEnabled: true,
      hintDelayMs: 2500,
      coinImageUrl: "/demo-assets/coin.svg",
      hudTransparent: false,
      rounds: defaultSolitaireRoundsPack(),
      sounds: { flipUrl: "", moveUrl: "", placeUrl: "", payoutUrl: "" },
    },
    domino: {
      failEnabled: true,
      hintHandEnabled: true,
      hintDelayMs: 2500,
      coinImageUrl: "/demo-assets/coin.svg",
      hudTransparent: false,
      yourTurnMessage: "Your turn — select a tile",
      passMessage: "Turn passed",
      turnSpeed: 1,
      rounds: defaultDominoRoundsPack(),
    },
    tappyPlane: {
      failEnabled: true,
      hintHandEnabled: true,
      hintDelayMs: 1800,
      coinImageUrl: "/demo-assets/coin.svg",
      hudTransparent: false,
      endless: true,
      rounds: defaultTappyRoundsPack(),
      sounds: { engineUrl: "", flapUrl: "", coinUrl: "", crashUrl: "" },
    },
    racingLap: {
      failEnabled: true,
      coinImageUrl: "/demo-assets/coin.svg",
      hudTransparent: false,
      rounds: defaultRacingRoundsPack(),
    },
    topDownShooter: {
      lives: 3,
      failEnabled: true,
      coinImageUrl: "/demo-assets/coin.svg",
      hudTransparent: false,
      rounds: defaultShooterRoundsPack(),
    },
    dressUp: { ...DEFAULT_DRESS_UP_CONFIG },
    overlays: [
      imageEl(
        "gameplay-logo",
        "Logo",
        layout({ x: 0.35, y: 0.02, width: 0.3, height: 0.08, zIndex: 20 }),
        layout({ x: 0.02, y: 0.05, width: 0.15, height: 0.15, zIndex: 20 }),
        DEMO_URLS.appLogo,
      ),
      createAppLogoVerticalElement("gameplay"),
      createAppLogoHorizontalElement("gameplay"),
      textEl(
        "gameplay-label",
        "Label",
        TEMPLATE_NAMES[templateId],
        layout({ x: 0.05, y: 0.03, width: 0.25, height: 0.05, zIndex: 20 }),
        layout({ x: 0.02, y: 0.85, width: 0.2, height: 0.08, zIndex: 20 }),
        { fontSize: 14, fontWeight: 600 },
      ),
      muteButton(
        layout({ x: 0.88, y: 0.02, width: 0.09, height: 0.05, zIndex: 22 }),
        layout({ x: 0.93, y: 0.05, width: 0.05, height: 0.08, zIndex: 22 }),
      ),
      createGameplayDisclaimerElement(),
      createGameplayTimerOverlay(),
      ...(templateId === "match-3" ||
      templateId === "solitaire" ||
      templateId === "domino" ||
      templateId === "tappy-plane" ||
      templateId === "dress-up"
        ? [
            imageEl(
              "gameplay-hand",
              "Tutorial Hand",
              layout({ x: 0.38, y: 0.55, width: 0.18, height: 0.14, zIndex: 25 }),
              layout({ x: 0.42, y: 0.48, width: 0.12, height: 0.18, zIndex: 25 }),
              DEMO_URLS.hand,
            ),
          ]
        : []),
      {
        id: "gameplay-container",
        type: "gameplayContainer" as const,
        name: "Gameplay Area",
        content: {},
        style: {},
        layout: {
          portrait: layout({
            x: 0.04,
            y: 0.12,
            width: 0.92,
            height: 0.82,
            zIndex: 1,
            locked: true,
          }),
          landscape: layout({
            x: 0.18,
            y: 0.06,
            width: 0.64,
            height: 0.88,
            zIndex: 1,
            locked: true,
          }),
        },
        action: { type: "NONE" as const },
        permanentlyLocked: true,
      },
    ],
  };
  if (templateId === "triple-match") applyTripleMatchKitchenChrome(gameplay);
  if (templateId === "water-sort") applyWaterSortChrome(gameplay);
  if (templateId === "parking-2d") applyParking2DChrome(gameplay);
  if (templateId === "domino") {
    gameplay.fullBackground = {
      enabled: true,
      portraitImageUrl: "/demo-assets/bg-domino.webp",
      landscapeImageUrl: "/demo-assets/bg-domino.webp",
      imageFit: "cover",
    };
  }
  return gameplay;
}

export function createDefaultProjectData(templateId: TemplateId): ProjectData {
  return {
    links: {
      appStoreUrl: "",
      googlePlayUrl: "",
      policyUrl: "",
    },
    coinImageUrl: "",
    startScreen: createStartScreen(templateId),
    gameplay: createGameplayOverlays(templateId),
    endScreen: createEndScreen(),
  };
}

export const STACK_TOWER_CAMERA = {
  portrait: { fov: 38, position: { x: 4.4, y: 5.6, z: 4.8 }, target: { x: 0, y: 0.55, z: 0 } },
  landscape: { fov: 32, position: { x: 5.2, y: 4.6, z: 4.4 }, target: { x: 0, y: 0.5, z: 0 } },
} as const;

export const PARKING_JAM_BIRDS_EYE_CAMERA = {
  portrait: { fov: 14, position: { x: 0, y: 50.7, z: 17 }, target: { x: 0, y: 1.5, z: 0.8 } },
  landscape: { fov: 16, position: { x: 0, y: 50.7, z: 14 }, target: { x: 0, y: 1.5, z: 0.8 } },
} as const;

export const PARKING_JAM_BIRDS_EYE_VARIATION_NAME = "Bird's eye";

export function createParkingJamBirdsEyeProjectData(): ProjectData {
  const data = createDefaultProjectData("parking-jam");
  data.gameplay.camera = {
    portrait: { ...PARKING_JAM_BIRDS_EYE_CAMERA.portrait, position: { ...PARKING_JAM_BIRDS_EYE_CAMERA.portrait.position }, target: { ...PARKING_JAM_BIRDS_EYE_CAMERA.portrait.target } },
    landscape: { ...PARKING_JAM_BIRDS_EYE_CAMERA.landscape, position: { ...PARKING_JAM_BIRDS_EYE_CAMERA.landscape.position }, target: { ...PARKING_JAM_BIRDS_EYE_CAMERA.landscape.target } },
  };
  data.gameplay.lighting = "studio";
  return data;
}

export function defaultStarterVariations(templateId: TemplateId): { name: string; projectData: ProjectData }[] {
  const variations = [{ name: "Default", projectData: createDefaultProjectData(templateId) }];
  if (templateId === "parking-jam") {
    variations.push({
      name: PARKING_JAM_BIRDS_EYE_VARIATION_NAME,
      projectData: createParkingJamBirdsEyeProjectData(),
    });
  }
  return variations;
}
