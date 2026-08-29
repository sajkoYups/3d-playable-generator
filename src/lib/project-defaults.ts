import {
  layout,
  type Background,
  type PlayableElement,
  type ProjectData,
  type TemplateId,
} from "@/types/project";
import { DEFAULT_PARKING_CARS, defaultParkingRoundsPack } from "@/playable-runtime/engines/parking-jam/layout";
import { defaultMatchRoundsPack } from "@/playable-runtime/engines/triple-match/rounds";
import { defaultLaneRoundsPack } from "@/playable-runtime/engines/lane-runner/rounds";

export const TEMPLATE_NAMES: Record<TemplateId, string> = {
  "stack-tower": "Stack Tower",
  "triple-match": "Triple Match 3D",
  "lane-runner": "Lane Runner",
  "parking-jam": "Parking Jam",
};

export const TEMPLATE_BLURBS: Record<TemplateId, string> = {
  "stack-tower": "Drop and stack blocks. Perfect for logo-on-block campaigns.",
  "triple-match": "Tap matching snacks into a tray. Three of a kind clears.",
  "lane-runner": "Swipe lanes, dodge traffic, collect coins across rounds.",
  "parking-jam": "Slide cars out of a jammed lot. Grid puzzle with tinted vehicles.",
};

export const DEMO_URLS = {
  appLogo: "/demo-assets/app-logo.svg",
  decorative: "/demo-assets/decorative.svg",
  character: "/demo-assets/character.svg",
  bgStartPortrait: "/demo-assets/bg-start-portrait.svg",
  bgStartLandscape: "/demo-assets/bg-start-landscape.svg",
  bgEndPortrait: "/demo-assets/bg-end-portrait.svg",
  bgEndLandscape: "/demo-assets/bg-end-landscape.svg",
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
    imageFit: "cover",
    imagePosition: "center",
    overlayColor: "#000000",
    overlayOpacity,
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
    elements: [
      imageEl(
        "app-logo",
        "App Logo",
        layout({ x: 0.35, y: 0.08, width: 0.3, height: 0.12, zIndex: 2 }),
        layout({ x: 0.08, y: 0.15, width: 0.18, height: 0.2, zIndex: 2 }),
        DEMO_URLS.appLogo,
      ),
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
        "Tap to start. One round. Install at the end.",
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
    ],
  };
}

function createEndScreen(): ProjectData["endScreen"] {
  return {
    background: imageBackground(DEMO_URLS.bgEndPortrait, DEMO_URLS.bgEndLandscape, 0.4),
    videoUrl: "",
    elements: [
      imageEl(
        "end-app-logo",
        "App Logo",
        layout({ x: 0.35, y: 0.08, width: 0.3, height: 0.1, zIndex: 2 }),
        layout({ x: 0.08, y: 0.2, width: 0.16, height: 0.18, zIndex: 2 }),
        DEMO_URLS.appLogo,
      ),
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
    ],
  };
}

function createGameplayOverlays(templateId: TemplateId): ProjectData["gameplay"] {
  return {
    allowBackgroundReplace: true,
    background: {
      portrait: {
        type: "gradient",
        color: "#12141a",
        gradientFrom: "#1c1f2a",
        gradientTo: "#12141a",
        gradientAngle: 180,
        imageFit: "cover",
        imagePosition: "center",
        overlayColor: "#000000",
        overlayOpacity: 0,
      },
      landscape: {
        type: "gradient",
        color: "#12141a",
        gradientFrom: "#1c1f2a",
        gradientTo: "#12141a",
        gradientAngle: 180,
        imageFit: "cover",
        imagePosition: "center",
        overlayColor: "#000000",
        overlayOpacity: 0,
      },
    },
    stageBackground:
      templateId === "parking-jam"
        ? {
            portrait: {
              type: "gradient",
              color: "#1c2430",
              gradientFrom: "#9aafc2",
              gradientTo: "#1a2230",
              gradientAngle: 180,
              imageFit: "cover",
              imagePosition: "center",
              overlayColor: "#000000",
              overlayOpacity: 0,
            },
            landscape: {
              type: "gradient",
              color: "#1c2430",
              gradientFrom: "#9aafc2",
              gradientTo: "#1a2230",
              gradientAngle: 180,
              imageFit: "cover",
              imagePosition: "center",
              overlayColor: "#000000",
              overlayOpacity: 0,
            },
          }
        : templateId === "triple-match"
          ? {
              portrait: {
                type: "solid",
                color: "#6b3fa0",
                gradientFrom: "#6b3fa0",
                gradientTo: "#3d2466",
                gradientAngle: 180,
                imageFit: "cover",
                imagePosition: "center",
                overlayColor: "#000000",
                overlayOpacity: 0,
              },
              landscape: {
                type: "solid",
                color: "#6b3fa0",
                gradientFrom: "#6b3fa0",
                gradientTo: "#3d2466",
                gradientAngle: 180,
                imageFit: "cover",
                imagePosition: "center",
                overlayColor: "#000000",
                overlayOpacity: 0,
              },
            }
          : templateId === "lane-runner"
            ? {
                portrait: {
                  type: "gradient",
                  color: "#1c2430",
                  gradientFrom: "#9aafc2",
                  gradientTo: "#1a2230",
                  gradientAngle: 180,
                  imageFit: "cover",
                  imagePosition: "center",
                  overlayColor: "#000000",
                  overlayOpacity: 0,
                },
                landscape: {
                  type: "gradient",
                  color: "#1c2430",
                  gradientFrom: "#9aafc2",
                  gradientTo: "#1a2230",
                  gradientAngle: 180,
                  imageFit: "cover",
                  imagePosition: "center",
                  overlayColor: "#000000",
                  overlayOpacity: 0,
                },
              }
          : {
            portrait: {
              type: "solid",
              color: "#12141a",
              gradientFrom: "#12141a",
              gradientTo: "#0a0b10",
              gradientAngle: 180,
              imageFit: "cover",
              imagePosition: "center",
              overlayColor: "#000000",
              overlayOpacity: 0,
            },
            landscape: {
              type: "solid",
              color: "#12141a",
              gradientFrom: "#12141a",
              gradientTo: "#0a0b10",
              gradientAngle: 180,
              imageFit: "cover",
              imagePosition: "center",
              overlayColor: "#000000",
              overlayOpacity: 0,
            },
          },
    camera:
      templateId === "parking-jam"
        ? {
            portrait: { fov: 46, position: { x: 0, y: 11, z: 8 }, target: { x: 0, y: 0, z: 0 } },
            landscape: { fov: 40, position: { x: 0, y: 9, z: 7 }, target: { x: 0, y: 0, z: 0 } },
          }
        : templateId === "triple-match"
          ? {
              portrait: { fov: 32, position: { x: 0, y: 3.4, z: 3.6 }, target: { x: 0, y: 0.2, z: 0.35 } },
              landscape: { fov: 28, position: { x: 0, y: 2.8, z: 3.2 }, target: { x: 0, y: 0.15, z: 0.3 } },
            }
          : templateId === "lane-runner"
            ? {
                portrait: { fov: 48, position: { x: 0, y: 5.2, z: 8.5 }, target: { x: 0, y: 0.4, z: -6 } },
                landscape: { fov: 42, position: { x: 0, y: 4.2, z: 8 }, target: { x: 0, y: 0.3, z: -6 } },
              }
            : {
                portrait: { fov: 50, position: { x: 0, y: 8, z: 12 }, target: { x: 0, y: 2, z: 0 } },
                landscape: { fov: 42, position: { x: 0, y: 6, z: 10 }, target: { x: 0, y: 1.6, z: 0 } },
              },
    lighting: templateId === "lane-runner" ? "overcast" : "studio",
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
    },
    tripleMatch: {
      itemSlots: ["apple", "donut", "taco", "burger"],
      trayColor: "#c4a574",
      barSlots: 7,
      triplesToWin: 4,
      difficulty: "medium",
      rounds: defaultMatchRoundsPack(),
      coinImageUrl: "",
    },
    laneRunner: {
      characterModelUrl: "sedan",
      obstacleSet: ["suv", "taxi", "truck", "cone"],
      environmentTheme: "city",
      laneCount: 3,
      startSpeed: 8,
      speedRamp: 0.6,
      winDistance: 180,
      roadTextureUrl: "",
      grassTextureUrl: "",
      coinImageUrl: "",
      rounds: defaultLaneRoundsPack(),
    },
    parkingJam: {
      lotTextureUrl: "",
      grassTextureUrl: "",
      pavementTextureUrl: "",
      carModelUrl: "sedan",
      carColors: ["#e07a3d", "#2bb5a0", "#7c5cff", "#e85d4c", "#f3ede0"],
      movesLimit: 24,
      difficulty: "medium",
      gridCols: 6,
      gridRows: 6,
      cars: DEFAULT_PARKING_CARS.map((c) => ({ ...c })),
      rounds: defaultParkingRoundsPack(),
      coinImageUrl: "",
    },
    overlays: [
      imageEl(
        "gameplay-logo",
        "Logo",
        layout({ x: 0.35, y: 0.02, width: 0.3, height: 0.08, zIndex: 20 }),
        layout({ x: 0.02, y: 0.05, width: 0.15, height: 0.15, zIndex: 20 }),
        DEMO_URLS.appLogo,
      ),
      buttonEl(
        "gameplay-cta",
        "CTA Button",
        "Download",
        "OPEN_APP_STORE",
        layout({ x: 0.7, y: 0.02, width: 0.26, height: 0.06, zIndex: 21 }),
        layout({ x: 0.8, y: 0.05, width: 0.18, height: 0.1, zIndex: 21 }),
        { backgroundColor: "#e85d4c", borderRadius: 12 },
      ),
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
      createGameplayTimerOverlay(),
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
}

export function createDefaultProjectData(templateId: TemplateId): ProjectData {
  return {
    links: {
      appStoreUrl: "",
      googlePlayUrl: "",
    },
    startScreen: createStartScreen(templateId),
    gameplay: createGameplayOverlays(templateId),
    endScreen: createEndScreen(),
  };
}
