import { z } from "zod";

export const OrientationSchema = z.enum(["portrait", "landscape"]);
export type Orientation = z.infer<typeof OrientationSchema>;

export const TemplateIdSchema = z.enum([
  "stack-tower",
  "triple-match",
  "lane-runner",
  "parking-jam",
  "tower-defense",
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
  type: z.enum(["solid", "gradient", "image", "transparent", "video"]),
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
    "OPEN_POLICY",
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
  startAfterVideo: z.boolean().default(false),
  elements: z.array(PlayableElementSchema),
});
export type ScreenData = z.infer<typeof ScreenSchema>;

const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const CAMERA_FOV_MIN = 10;
export const CAMERA_FOV_MAX = 90;

export const CameraConfigSchema = z.object({
  fov: z.number().min(CAMERA_FOV_MIN).max(CAMERA_FOV_MAX).default(50),
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
  playFromStart: z.boolean().default(false),
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

const DefaultMatchItems = ["apple", "donut", "taco", "burger"];

export const TripleMatchRoundSchema = z.object({
  itemSlots: z.array(z.string()).default(DefaultMatchItems),
  trayColor: z.string().default("#c4a574"),
  barSlots: z.number().int().min(5).max(10).default(7),
  triplesToWin: z.number().int().min(1).max(30).default(4),
  coins: z.number().int().min(0).max(9999).default(50),
});
export type TripleMatchRound = z.infer<typeof TripleMatchRoundSchema>;

export const TripleMatchConfigSchema = z.object({
  itemSlots: z.array(z.string()).default(DefaultMatchItems),
  trayColor: z.string().default("#c4a574"),
  barSlots: z.number().int().min(5).max(10).default(7),
  triplesToWin: z.number().int().min(1).max(30).default(4),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  rounds: z.array(TripleMatchRoundSchema).max(9).default([]),
  coinImageUrl: z.string().default(""),
});
export type TripleMatchConfig = z.infer<typeof TripleMatchConfigSchema>;

export const LaneRunnerRoundSchema = z.object({
  winDistance: z.number().min(40).max(800).default(180),
  startSpeed: z.number().min(4).max(20).default(8),
  speedRamp: z.number().min(0).max(4).default(0.6),
  coins: z.number().int().min(0).max(9999).default(50),
});
export type LaneRunnerRound = z.infer<typeof LaneRunnerRoundSchema>;

export const LaneRunnerConfigSchema = z.object({
  characterModelUrl: z.string().default("sedan"),
  obstacleSet: z.array(z.string()).default(["suv", "taxi", "truck", "cone"]),
  environmentTheme: z.enum(["desert", "city", "neon"]).default("city"),
  laneCount: z.number().int().min(3).max(5).default(3),
  startSpeed: z.number().min(4).max(20).default(8),
  speedRamp: z.number().min(0).max(4).default(0.6),
  /** How fast the car slides between lanes when swiping (higher = snappier). */
  laneSwitchSpeed: z.number().min(4).max(24).default(10),
  winDistance: z.number().min(40).max(800).default(180),
  roadTextureUrl: z.string().default(""),
  grassTextureUrl: z.string().default(""),
  coinImageUrl: z.string().default(""),
  rounds: z.array(LaneRunnerRoundSchema).max(9).default([]),
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

const DefaultParkingCars: ParkingCar[] = [
  { id: "hero", col: 0, row: 2, length: 2, axis: "h", color: "#e07a3d", isHero: true },
  { id: "c1", col: 3, row: 0, length: 3, axis: "v", color: "#2bb5a0", isHero: false },
  { id: "c2", col: 0, row: 5, length: 2, axis: "h", color: "#7c5cff", isHero: false },
  { id: "c3", col: 4, row: 4, length: 2, axis: "v", color: "#e85d4c", isHero: false },
];

export const ParkingRoundSchema = z.object({
  gridCols: z.number().int().min(4).max(8).default(6),
  gridRows: z.number().int().min(4).max(8).default(6),
  movesLimit: z.number().int().min(8).max(80).default(24),
  coins: z.number().int().min(0).max(9999).default(50),
  cars: z.array(ParkingCarSchema).default(DefaultParkingCars),
});
export type ParkingRound = z.infer<typeof ParkingRoundSchema>;

export const ParkingJamConfigSchema = z.object({
  lotTextureUrl: z.string().default(""),
  grassTextureUrl: z.string().default(""),
  pavementTextureUrl: z.string().default(""),
  carModelUrl: z.string().default("sedan"),
  carColors: z.array(z.string()).default(["#e07a3d", "#2bb5a0", "#7c5cff", "#e85d4c", "#f3ede0"]),
  movesLimit: z.number().int().min(8).max(80).default(24),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  gridCols: z.number().int().min(4).max(8).default(6),
  gridRows: z.number().int().min(4).max(8).default(6),
  cars: z.array(ParkingCarSchema).default(DefaultParkingCars),
  rounds: z.array(ParkingRoundSchema).max(9).default([]),
  coinImageUrl: z.string().default(""),
});
export type ParkingJamConfig = z.infer<typeof ParkingJamConfigSchema>;

export const TowerDefenseTowerStatsSchema = z.object({
  cost: z.number().int().min(1).max(999).default(50),
  damage: z.number().min(0.5).max(100).default(8),
  range: z.number().min(1).max(20).default(1.8),
  fireRate: z.number().min(0.2).max(20).default(1.5),
});
export type TowerDefenseTowerStats = z.infer<typeof TowerDefenseTowerStatsSchema>;

export const TowerDefenseSoundsSchema = z.object({
  arrowFireUrl: z.string().default(""),
  cannonFireUrl: z.string().default(""),
  turretFireUrl: z.string().default(""),
  hitUrl: z.string().default(""),
  deathUrl: z.string().default(""),
  leakUrl: z.string().default(""),
  placeUrl: z.string().default(""),
  waveUrl: z.string().default(""),
});
export type TowerDefenseSounds = z.infer<typeof TowerDefenseSoundsSchema>;

export const TowerDefenseRoundSchema = z.object({
  impCount: z.number().int().min(0).max(40).default(6),
  puglinCount: z.number().int().min(0).max(20).default(0),
  spawnInterval: z.number().min(0.2).max(5).default(1.1),
  hpScale: z.number().min(0.4).max(5).default(1),
  speedScale: z.number().min(0.4).max(3).default(1),
  coins: z.number().int().min(0).max(9999).default(50),
  goldBonus: z.number().int().min(0).max(999).default(0),
});
export type TowerDefenseRound = z.infer<typeof TowerDefenseRoundSchema>;

export const TowerDefenseConfigSchema = z.object({
  lives: z.number().int().min(1).max(30).default(8),
  startingGold: z.number().int().min(0).max(9999).default(80),
  coinImageUrl: z.string().default(""),
  towers: z
    .object({
      arrow: TowerDefenseTowerStatsSchema.prefault({
        cost: 50,
        damage: 8,
        range: 1.8,
        fireRate: 1.5,
      }),
      cannon: TowerDefenseTowerStatsSchema.prefault({
        cost: 80,
        damage: 20,
        range: 1.7,
        fireRate: 0.65,
      }),
      turret: TowerDefenseTowerStatsSchema.prefault({
        cost: 110,
        damage: 4,
        range: 1.4,
        fireRate: 5,
      }),
    })
    .prefault({}),
  sounds: TowerDefenseSoundsSchema.prefault({}),
  rounds: z.array(TowerDefenseRoundSchema).max(9).default([]),
});
export type TowerDefenseConfig = z.infer<typeof TowerDefenseConfigSchema>;

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
  towerDefense: TowerDefenseConfigSchema.prefault({}),
});
export type GameplayData = z.infer<typeof GameplaySchema>;

export const ProjectLinksSchema = z.object({
  appStoreUrl: z.string().default(""),
  googlePlayUrl: z.string().default(""),
  policyUrl: z.string().default(""),
});
export type ProjectLinks = z.infer<typeof ProjectLinksSchema>;

export const ProjectDataSchema = z.object({
  links: ProjectLinksSchema,
  coinImageUrl: z.string().default(""),
  startScreen: ScreenSchema,
  gameplay: GameplaySchema,
  endScreen: ScreenSchema,
});
export type ProjectData = z.infer<typeof ProjectDataSchema>;

/** Overlay ids the Brand kit owns and live-merges onto variations. */
export const BRAND_SLOT_IDS = {
  start: ["app-logo", "app-store-button", "google-play-button"],
  end: ["end-app-logo", "end-cta", "end-app-store", "end-google-play"],
  gameplay: ["gameplay-logo"],
} as const;

/** Optional brand layers; saved only after they are added in Brand studio. */
export const END_POLICY_SLOT_ID = "end-policy";
export const OPTIONAL_BRAND_END_SLOT_IDS: readonly string[] = [END_POLICY_SLOT_ID];

export const ALL_BRAND_SLOT_IDS: readonly string[] = [
  ...BRAND_SLOT_IDS.start,
  ...BRAND_SLOT_IDS.end,
  ...BRAND_SLOT_IDS.gameplay,
  ...OPTIONAL_BRAND_END_SLOT_IDS,
];

export const BRAND_LOGO_SLOT_IDS: readonly string[] = ["app-logo", "end-app-logo", "gameplay-logo"];

/** Copy the variation can change without unlinking the Brand. */
export const OVERRIDABLE_SLOT_IDS: readonly string[] = [
  "headline",
  "subtitle",
  "end-headline",
  "end-subtitle",
  "gameplay-label",
  "end-cta",
  "app-store-button",
  "google-play-button",
  "end-app-store",
  "end-google-play",
  END_POLICY_SLOT_ID,
];

export function isBrandSlotId(id: string): boolean {
  return ALL_BRAND_SLOT_IDS.includes(id);
}

export function isOverridableSlotId(id: string): boolean {
  return OVERRIDABLE_SLOT_IDS.includes(id);
}

export const BrandDataSchema = z.object({
  links: ProjectLinksSchema,
  coinImageUrl: z.string().default(""),
  startScreen: ScreenSchema,
  endScreen: ScreenSchema,
  overlays: z.array(PlayableElementSchema).default([]),
});
export type BrandData = z.infer<typeof BrandDataSchema>;

export const ElementContentOverrideSchema = z
  .object({
    text: z.string().optional(),
    imageUrl: z.string().optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
  })
  .prefault({});
export type ElementContentOverride = z.infer<typeof ElementContentOverrideSchema>;

export const VariationOverridesSchema = z
  .object({
    elements: z.record(z.string(), ElementContentOverrideSchema).default({}),
  })
  .prefault({});
export type VariationOverrides = z.infer<typeof VariationOverridesSchema>;

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
