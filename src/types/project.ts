import { z } from "zod";

export const OrientationSchema = z.enum(["portrait", "landscape"]);
export type Orientation = z.infer<typeof OrientationSchema>;

export const TemplateIdSchema = z.enum([
  "stack-tower",
  "triple-match",
  "lane-runner",
  "parking-jam",
]);
export type TemplateId = z.infer<typeof TemplateIdSchema>;

export const LayoutBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  rotation: z.number().default(0),
  visible: z.boolean().default(true),
  opacity: z.number().min(0).max(1).default(1),
  zIndex: z.number().int().default(0),
  locked: z.boolean().default(false),
});
export type LayoutBox = z.infer<typeof LayoutBoxSchema>;

export const DualLayoutSchema = z.object({
  portrait: LayoutBoxSchema,
  landscape: LayoutBoxSchema,
});
export type DualLayout = z.infer<typeof DualLayoutSchema>;

export const BackgroundSchema = z.object({
  type: z.enum(["solid", "gradient", "image", "transparent"]),
  color: z.string().default("#1a1a2e"),
  gradientFrom: z.string().default("#1a1a2e"),
  gradientTo: z.string().default("#16213e"),
  gradientAngle: z.number().default(180),
  portraitImageUrl: z.string().optional(),
  landscapeImageUrl: z.string().optional(),
  imageFit: z.enum(["cover", "contain", "stretch"]).default("cover"),
  imagePosition: z.string().default("center"),
  overlayColor: z.string().default("#000000"),
  overlayOpacity: z.number().min(0).max(1).default(0),
});
export type Background = z.infer<typeof BackgroundSchema>;

export const DualBackgroundSchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return val;
  const obj = val as Record<string, unknown>;
  if (obj.portrait || obj.landscape) {
    return {
      portrait: obj.portrait ?? obj.landscape,
      landscape: obj.landscape ?? obj.portrait,
    };
  }
  const bg = obj as Background;
  return {
    portrait: {
      ...bg,
      landscapeImageUrl: bg.portraitImageUrl ?? bg.landscapeImageUrl,
    },
    landscape: {
      ...bg,
      portraitImageUrl: bg.landscapeImageUrl ?? bg.portraitImageUrl,
    },
  };
}, z.object({
  portrait: BackgroundSchema,
  landscape: BackgroundSchema,
}));
export type DualBackground = {
  portrait: Background;
  landscape: Background;
};

export function resolveBackground(
  dual: DualBackground | Background | undefined | null,
  orientation: Orientation,
): Background | undefined {
  if (!dual) return undefined;
  if ("portrait" in dual && dual.portrait) {
    return orientation === "portrait" ? dual.portrait : dual.landscape;
  }
  return dual as Background;
}

export function backgroundImageUrl(
  background: Background | undefined | null,
  orientation: Orientation = "portrait",
): string | undefined {
  if (!background) return undefined;
  return orientation === "portrait"
    ? background.portraitImageUrl || background.landscapeImageUrl
    : background.landscapeImageUrl || background.portraitImageUrl;
}

export const ElementActionSchema = z.object({
  type: z.enum([
    "START_PLAYABLE",
    "OPEN_APP_STORE",
    "OPEN_GOOGLE_PLAY",
    "REPLAY",
    "MUTE",
    "NONE",
  ]),
});
export type ElementAction = z.infer<typeof ElementActionSchema>;

export const ButtonStyleSchema = z.object({
  backgroundColor: z.string().default("#e07a3d"),
  textColor: z.string().default("#ffffff"),
  borderColor: z.string().default("transparent"),
  borderWidth: z.number().default(0),
  borderRadius: z.number().default(16),
  shadow: z.string().default("0 8px 24px rgba(0,0,0,0.25)"),
  pressAnimation: z.enum(["scale", "none"]).default("scale"),
});

export const ElementTypeSchema = z.enum([
  "text",
  "button",
  "image",
  "storeButton",
  "muteButton",
  "starRating",
  "timer",
  "gameplayContainer",
]);
export type ElementType = z.infer<typeof ElementTypeSchema>;

export const PlayableElementSchema = z.object({
  id: z.string(),
  type: ElementTypeSchema,
  name: z.string(),
  content: z
    .object({
      text: z.string().optional(),
      imageUrl: z.string().optional(),
      videoUrl: z.string().optional(),
      fontFamily: z.string().optional(),
      fontSize: z.number().optional(),
      fontWeight: z.union([z.number(), z.string()]).optional(),
      textAlign: z.enum(["left", "center", "right"]).optional(),
      color: z.string().optional(),
      lineHeight: z.number().optional(),
      letterSpacing: z.number().optional(),
      maxWidth: z.number().optional(),
      store: z.enum(["appStore", "googlePlay"]).optional(),
      stars: z.number().optional(),
      durationSeconds: z.number().optional(),
      warningSeconds: z.number().optional(),
      warningColor: z.string().optional(),
    })
    .prefault({}),
  style: ButtonStyleSchema.partial().prefault({}),
  layout: DualLayoutSchema,
  action: ElementActionSchema.prefault({ type: "NONE" }),
  permanentlyLocked: z.boolean().default(false),
});
export type PlayableElement = z.infer<typeof PlayableElementSchema>;

export const ScreenSchema = z.object({
  background: BackgroundSchema,
  videoUrl: z.string().default(""),
  elements: z.array(PlayableElementSchema),
});
export type ScreenData = z.infer<typeof ScreenSchema>;

const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const CameraConfigSchema = z.object({
  fov: z.number().min(20).max(90).default(50),
  position: Vec3Schema.prefault({ x: 0, y: 8, z: 12 }),
  target: Vec3Schema.prefault({ x: 0, y: 2, z: 0 }),
});
export type CameraConfig = z.infer<typeof CameraConfigSchema>;

export const DualCameraSchema = z.object({
  portrait: CameraConfigSchema,
  landscape: CameraConfigSchema,
});
export type DualCamera = z.infer<typeof DualCameraSchema>;

export const LightingPresetSchema = z.enum(["studio", "sunset", "overcast", "neon"]);
export type LightingPreset = z.infer<typeof LightingPresetSchema>;

export const EnvironmentSchema = z.enum(["solid", "gradient-sky", "warehouse", "city-night"]);
export type EnvironmentId = z.infer<typeof EnvironmentSchema>;

export const AudioSlotsSchema = z.object({
  musicUrl: z.string().default(""),
  tapUrl: z.string().default(""),
  winUrl: z.string().default(""),
  loseUrl: z.string().default(""),
});
export type AudioSlots = z.infer<typeof AudioSlotsSchema>;

export const StackTowerConfigSchema = z.object({
  palette: z
    .array(z.string())
    .default(["#e07a3d", "#2bb5a0", "#f3ede0", "#7c5cff", "#e85d4c"]),
  materialFinish: z.enum(["matte", "glossy", "metallic"]).default("glossy"),
  faceTextureUrl: z.string().default(""),
  speed: z.number().min(0.4).max(4).default(1.4),
  speedRamp: z.number().min(0).max(0.4).default(0.08),
  blocksToWin: z.number().int().min(3).max(40).default(10),
  missLimit: z.number().int().min(1).max(8).default(3),
});
export type StackTowerConfig = z.infer<typeof StackTowerConfigSchema>;

export const TripleMatchConfigSchema = z.object({
  itemSlots: z.array(z.string()).default([
    "apple",
    "banana",
    "bottle",
    "can",
    "coin",
    "gem",
    "key",
    "star",
    "donut",
    "hammer",
    "potion",
    "crown",
  ]),
  trayColor: z.string().default("#c4a574"),
  barSlots: z.number().int().min(5).max(10).default(7),
  triplesToWin: z.number().int().min(1).max(30).default(6),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});
export type TripleMatchConfig = z.infer<typeof TripleMatchConfigSchema>;

export const LaneRunnerConfigSchema = z.object({
  characterModelUrl: z.string().default("runner"),
  obstacleSet: z.array(z.string()).default(["crate", "barrier", "cone"]),
  environmentTheme: z.enum(["desert", "city", "neon"]).default("city"),
  laneCount: z.number().int().min(3).max(5).default(3),
  startSpeed: z.number().min(4).max(20).default(8),
  speedRamp: z.number().min(0).max(4).default(0.6),
  winDistance: z.number().min(40).max(800).default(180),
});
export type LaneRunnerConfig = z.infer<typeof LaneRunnerConfigSchema>;

export const ParkingCarSchema = z.object({
  id: z.string(),
  col: z.number().int(),
  row: z.number().int(),
  length: z.number().int().min(2).max(4).default(2),
  axis: z.enum(["h", "v"]).default("h"),
  color: z.string(),
  isHero: z.boolean().default(false),
});
export type ParkingCar = z.infer<typeof ParkingCarSchema>;

export const ParkingJamConfigSchema = z.object({
  lotTextureUrl: z.string().default(""),
  carColors: z.array(z.string()).default(["#e07a3d", "#2bb5a0", "#7c5cff", "#e85d4c", "#f3ede0"]),
  movesLimit: z.number().int().min(8).max(80).default(24),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  gridCols: z.number().int().min(4).max(8).default(6),
  gridRows: z.number().int().min(4).max(8).default(6),
  cars: z.array(ParkingCarSchema).default([
    { id: "hero", col: 0, row: 2, length: 2, axis: "h", color: "#e07a3d", isHero: true },
    { id: "c1", col: 2, row: 0, length: 3, axis: "v", color: "#2bb5a0", isHero: false },
    { id: "c2", col: 3, row: 1, length: 2, axis: "h", color: "#7c5cff", isHero: false },
    { id: "c3", col: 4, row: 3, length: 3, axis: "v", color: "#e85d4c", isHero: false },
    { id: "c4", col: 0, row: 4, length: 2, axis: "h", color: "#f3ede0", isHero: false },
    { id: "c5", col: 1, row: 3, length: 2, axis: "v", color: "#3d7cff", isHero: false },
  ]),
});
export type ParkingJamConfig = z.infer<typeof ParkingJamConfigSchema>;

const DefaultGameplayBackground: Background = {
  type: "gradient",
  color: "#12141a",
  gradientFrom: "#1c1f2a",
  gradientTo: "#12141a",
  gradientAngle: 180,
  imageFit: "cover",
  imagePosition: "center",
  overlayColor: "#000000",
  overlayOpacity: 0,
};

const DefaultStageBackground: Background = {
  type: "solid",
  color: "#12141a",
  gradientFrom: "#12141a",
  gradientTo: "#0a0b10",
  gradientAngle: 180,
  imageFit: "cover",
  imagePosition: "center",
  overlayColor: "#000000",
  overlayOpacity: 0,
};

const DefaultDualGameplayBackground = {
  portrait: DefaultGameplayBackground,
  landscape: DefaultGameplayBackground,
};

const DefaultDualStageBackground = {
  portrait: DefaultStageBackground,
  landscape: DefaultStageBackground,
};

const DefaultCamera: CameraConfig = {
  fov: 50,
  position: { x: 0, y: 8, z: 12 },
  target: { x: 0, y: 2, z: 0 },
};

export const GameplaySchema = z.object({
  allowBackgroundReplace: z.boolean().default(true),
  background: DualBackgroundSchema.default(DefaultDualGameplayBackground),
  stageBackground: DualBackgroundSchema.default(DefaultDualStageBackground),
  camera: DualCameraSchema.prefault({
    portrait: DefaultCamera,
    landscape: { fov: 45, position: { x: 0, y: 6, z: 10 }, target: { x: 0, y: 1.5, z: 0 } },
  }),
  lighting: LightingPresetSchema.default("studio"),
  environment: EnvironmentSchema.default("gradient-sky"),
  audio: AudioSlotsSchema.prefault({}),
  overlays: z.array(PlayableElementSchema),
  stackTower: StackTowerConfigSchema.prefault({}),
  tripleMatch: TripleMatchConfigSchema.prefault({}),
  laneRunner: LaneRunnerConfigSchema.prefault({}),
  parkingJam: ParkingJamConfigSchema.prefault({}),
});
export type GameplayData = z.infer<typeof GameplaySchema>;

export const ProjectLinksSchema = z.object({
  appStoreUrl: z.string().default(""),
  googlePlayUrl: z.string().default(""),
});
export type ProjectLinks = z.infer<typeof ProjectLinksSchema>;

export const ProjectDataSchema = z.object({
  links: ProjectLinksSchema,
  startScreen: ScreenSchema,
  gameplay: GameplaySchema,
  endScreen: ScreenSchema,
});
export type ProjectData = z.infer<typeof ProjectDataSchema>;

export function layout(
  partial: Partial<LayoutBox> & Pick<LayoutBox, "x" | "y" | "width" | "height">,
): LayoutBox {
  return {
    rotation: 0,
    visible: true,
    opacity: 1,
    zIndex: 0,
    locked: false,
    ...partial,
  };
}

export const NETWORK_IDS = [
  "generic",
  "google",
  "meta",
  "applovin",
  "unity",
  "ironsource",
  "mintegral",
  "tiktok",
] as const;
export const NetworkIdSchema = z.enum(NETWORK_IDS);
export type NetworkId = z.infer<typeof NetworkIdSchema>;
