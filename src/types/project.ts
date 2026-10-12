import { z } from "zod";

export const OrientationSchema = z.enum(["portrait", "landscape"]);
export type Orientation = z.infer<typeof OrientationSchema>;

export const TemplateIdSchema = z.enum([
  "stack-tower",
  "triple-match",
  "lane-runner",
  "parking-jam",
  "parking-2d",
  "tower-defense",
  "water-sort",
  "match-3",
  "solitaire",
  "domino",
  "top-down-shooter",
  "racing-lap",
  "tappy-plane",
  "dress-up",
]);
export type TemplateId = z.infer<typeof TemplateIdSchema>;

export const TEMPLATE_2D_IDS = [
  "parking-2d",
  "water-sort",
  "match-3",
  "solitaire",
  "domino",
  "top-down-shooter",
  "racing-lap",
  "tappy-plane",
  "dress-up",
] as const;
export type Template2DId = (typeof TEMPLATE_2D_IDS)[number];

export function is2DTemplate(id: TemplateId | string): boolean {
  return (TEMPLATE_2D_IDS as readonly string[]).includes(id);
}

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
  portraitVideoUrl: z.string().default(""),
  landscapeVideoUrl: z.string().default(""),
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
      landscapeVideoUrl: bg.portraitVideoUrl || bg.landscapeVideoUrl,
    },
    landscape: {
      ...bg,
      portraitImageUrl: bg.landscapeImageUrl ?? bg.portraitImageUrl,
      portraitVideoUrl: bg.landscapeVideoUrl || bg.portraitVideoUrl,
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

export function backgroundVideoUrl(
  background: Background | undefined | null,
  orientation: Orientation = "portrait",
): string {
  if (!background) return "";
  return orientation === "portrait"
    ? background.portraitVideoUrl || background.landscapeVideoUrl || ""
    : background.landscapeVideoUrl || background.portraitVideoUrl || "";
}

export function screenVideoUrl(
  screen: { videoUrl?: string; background: Background } | undefined | null,
  orientation: Orientation = "portrait",
): string {
  if (!screen) return "";
  return backgroundVideoUrl(screen.background, orientation) || screen.videoUrl || "";
}

export const FullBackgroundSchema = z.object({
  enabled: z.boolean().default(false),
  portraitImageUrl: z.string().default(""),
  landscapeImageUrl: z.string().default(""),
  imageFit: z.enum(["cover", "contain", "stretch"]).default("cover"),
});
export type FullBackground = z.infer<typeof FullBackgroundSchema>;

export function isFullBackgroundActive(
  fb: FullBackground | undefined | null,
): boolean {
  return Boolean(fb?.enabled);
}

export function fullBackgroundImageUrl(
  fb: FullBackground | undefined | null,
  orientation: Orientation = "portrait",
): string {
  if (!fb) return "";
  return orientation === "portrait"
    ? fb.portraitImageUrl || fb.landscapeImageUrl || ""
    : fb.landscapeImageUrl || fb.portraitImageUrl || "";
}

export function boardBackgroundForPlay(
  background: Background,
  fullBackground: FullBackground | undefined | null,
): Background {
  if (!isFullBackgroundActive(fullBackground)) return background;
  return { ...background, type: "transparent" };
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

export const ScreenSchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return val;
  const obj = { ...(val as Record<string, unknown>) };
  const bg =
    obj.background && typeof obj.background === "object"
      ? { ...(obj.background as Record<string, unknown>) }
      : {};
  const legacy = typeof obj.videoUrl === "string" ? obj.videoUrl : "";
  if (legacy && !bg.portraitVideoUrl && !bg.landscapeVideoUrl) {
    bg.portraitVideoUrl = legacy;
    bg.landscapeVideoUrl = legacy;
  }
  obj.background = bg;
  return obj;
}, z.object({
  background: BackgroundSchema,
  videoUrl: z.string().default(""),
  startAfterVideo: z.boolean().default(false),
  hidden: z.boolean().default(false),
  elements: z.array(PlayableElementSchema),
}));
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

export const StackTowerRoundSchema = z.object({
  blocksToWin: z.number().int().min(3).max(40).default(10),
  speed: z.number().min(0.4).max(4).default(1.4),
  speedRamp: z.number().min(0).max(0.4).default(0.08),
  missLimit: z.number().int().min(1).max(8).default(3),
  coins: z.number().int().min(0).max(9999).default(40),
});
export type StackTowerRound = z.infer<typeof StackTowerRoundSchema>;

export const StackTowerSoundsSchema = z.object({
  moveUrl: z.string().default(""),
});
export type StackTowerSounds = z.infer<typeof StackTowerSoundsSchema>;

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
  rounds: z.array(StackTowerRoundSchema).max(9).default([]),
  coinImageUrl: z.string().default(""),
  sounds: StackTowerSoundsSchema.prefault({}),
});
export type StackTowerConfig = z.infer<typeof StackTowerConfigSchema>;

const DefaultMatchItems = ["apple", "donut", "taco", "burger"];

export const TripleMatchRoundSchema = z.object({
  itemSlots: z.array(z.string()).default(DefaultMatchItems),
  trayColor: z.string().default("#b87914"),
  barSlots: z.number().int().min(5).max(10).default(7),
  triplesToWin: z.number().int().min(1).max(30).default(4),
  coins: z.number().int().min(0).max(9999).default(50),
});
export type TripleMatchRound = z.infer<typeof TripleMatchRoundSchema>;

export const TripleMatchSoundsSchema = z.object({
  ambienceUrl: z.string().default(""),
  moveUrl: z.string().default(""),
  matchUrl: z.string().default(""),
  payoutUrl: z.string().default(""),
});
export type TripleMatchSounds = z.infer<typeof TripleMatchSoundsSchema>;

export const TripleMatchConfigSchema = z.object({
  itemSlots: z.array(z.string()).default(DefaultMatchItems),
  trayColor: z.string().default("#b87914"),
  barSlots: z.number().int().min(5).max(10).default(7),
  triplesToWin: z.number().int().min(1).max(30).default(4),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  rounds: z.array(TripleMatchRoundSchema).max(9).default([]),
  coinImageUrl: z.string().default(""),
  sounds: TripleMatchSoundsSchema.prefault({}),
});
export type TripleMatchConfig = z.infer<typeof TripleMatchConfigSchema>;

export const LaneRunnerRoundSchema = z.object({
  winDistance: z.number().min(40).max(800).default(160),
  startSpeed: z.number().min(4).max(20).default(4),
  speedRamp: z.number().min(0).max(4).default(0.5),
  coins: z.number().int().min(0).max(9999).default(40),
});
export type LaneRunnerRound = z.infer<typeof LaneRunnerRoundSchema>;

export const LaneRunnerSoundsSchema = z.object({
  ambienceUrl: z.string().default(""),
  moveUrl: z.string().default(""),
});
export type LaneRunnerSounds = z.infer<typeof LaneRunnerSoundsSchema>;

export const LaneRunnerConfigSchema = z.object({
  characterModelUrl: z.string().default("sedan"),
  obstacleSet: z.array(z.string()).default(["suv", "taxi", "truck", "cone"]),
  environmentTheme: z.enum(["desert", "city", "neon"]).default("city"),
  laneCount: z.number().int().min(3).max(5).default(3),
  startSpeed: z.number().min(4).max(20).default(4),
  speedRamp: z.number().min(0).max(4).default(0.5),
  /** How fast the car slides between lanes when swiping (higher = snappier). */
  laneSwitchSpeed: z.number().min(4).max(24).default(10),
  winDistance: z.number().min(40).max(800).default(160),
  roadTextureUrl: z.string().default(""),
  grassTextureUrl: z.string().default(""),
  coinImageUrl: z.string().default(""),
  rounds: z.array(LaneRunnerRoundSchema).max(9).default([]),
  sounds: LaneRunnerSoundsSchema.prefault({}),
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
  { id: "hero", col: 0, row: 2, length: 2, axis: "h", color: "#ff3b30", isHero: true },
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

export const ParkingJamSoundsSchema = z.object({
  ambienceUrl: z.string().default(""),
  moveUrl: z.string().default(""),
  payoutUrl: z.string().default(""),
});
export type ParkingJamSounds = z.infer<typeof ParkingJamSoundsSchema>;

export const ParkingJamConfigSchema = z.object({
  lotTextureUrl: z.string().default(""),
  grassTextureUrl: z.string().default(""),
  pavementTextureUrl: z.string().default(""),
  carModelUrl: z.string().default("sedan"),
  carColors: z.array(z.string()).default(["#ff3b30", "#2bb5a0", "#7c5cff", "#e85d4c", "#f3ede0"]),
  movesLimit: z.number().int().min(8).max(80).default(24),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  gridCols: z.number().int().min(4).max(8).default(6),
  gridRows: z.number().int().min(4).max(8).default(6),
  cars: z.array(ParkingCarSchema).default(DefaultParkingCars),
  rounds: z.array(ParkingRoundSchema).max(9).default([]),
  coinImageUrl: z.string().default(""),
  sounds: ParkingJamSoundsSchema.prefault({}),
});
export type ParkingJamConfig = z.infer<typeof ParkingJamConfigSchema>;

export const Parking2DSoundsSchema = z.object({
  ambienceUrl: z.string().default(""),
  moveUrl: z.string().default(""),
  coinUrl: z.string().default(""),
  payoutUrl: z.string().default(""),
});
export type Parking2DSounds = z.infer<typeof Parking2DSoundsSchema>;

export const Parking2DConfigSchema = z.object({
  heroCarUrl: z.string().default(""),
  shortCarUrl: z.string().default(""),
  longCarUrl: z.string().default(""),
  exitArrowUrl: z.string().default(""),
  asphaltUrl: z.string().default(""),
  grassUrl: z.string().default(""),
  movesLimit: z.number().int().min(8).max(80).default(24),
  gridCols: z.number().int().min(4).max(8).default(6),
  gridRows: z.number().int().min(4).max(8).default(6),
  cars: z.array(ParkingCarSchema).default(DefaultParkingCars),
  rounds: z.array(ParkingRoundSchema).max(9).default([]),
  coinImageUrl: z.string().default(""),
  sounds: Parking2DSoundsSchema.prefault({}),
});
export type Parking2DConfig = z.infer<typeof Parking2DConfigSchema>;

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

export const MATCH3_PIECE_COUNT = 5;

export const Match3SoundsSchema = z.object({
  moveUrl: z.string().default(""),
  matchUrl: z.string().default(""),
  denyUrl: z.string().default(""),
  payoutUrl: z.string().default(""),
});
export type Match3Sounds = z.infer<typeof Match3SoundsSchema>;

export const Match3ConfigSchema = z.object({
  movesPerRound: z.number().int().min(1).max(99).default(15),
  scoreTarget: z.number().int().min(1).max(9999).default(80),
  roundsToWin: z.number().int().min(1).max(20).default(3),
  rewardPerRound: z.number().min(0).max(9999).default(5),
  rewardPrefix: z.string().default("$"),
  failEnabled: z.boolean().default(true),
  hintHandEnabled: z.boolean().default(true),
  hintDelayMs: z.number().int().min(500).max(15000).default(2500),
  scoreLabel: z.string().default("Score"),
  scoreChipBg: z.string().default("#1e293b"),
  scoreChipText: z.string().default("#f8fafc"),
  rewardTextColor: z.string().default("#fbbf24"),
  coinImageUrl: z.string().default("/demo-assets/coin.svg"),
  hudDisplay: z.enum(["both", "score", "coins"]).default("both"),
  hudTransparent: z.boolean().default(false),
  sounds: Match3SoundsSchema.prefault({}),
});
export type Match3Config = z.infer<typeof Match3ConfigSchema>;

export const DEFAULT_MATCH3_CONFIG: Match3Config = {
  movesPerRound: 15,
  scoreTarget: 80,
  roundsToWin: 3,
  rewardPerRound: 5,
  rewardPrefix: "$",
  failEnabled: true,
  hintHandEnabled: true,
  hintDelayMs: 2500,
  scoreLabel: "Score",
  scoreChipBg: "#1e293b",
  scoreChipText: "#f8fafc",
  rewardTextColor: "#fbbf24",
  coinImageUrl: "/demo-assets/coin.svg",
  hudDisplay: "both",
  hudTransparent: false,
  sounds: { moveUrl: "", matchUrl: "", denyUrl: "", payoutUrl: "" },
};

export const WaterSortRoundSchema = z.object({
  maxMoves: z.number().int().min(8).max(99).default(40),
  coins: z.number().int().min(0).max(9999).default(5),
  colorCount: z.number().int().min(2).max(5).default(5),
});
export type WaterSortRound = z.infer<typeof WaterSortRoundSchema>;

export const WaterSortSoundsSchema = z.object({
  pourUrl: z.string().default(""),
  denyUrl: z.string().default(""),
  payoutUrl: z.string().default(""),
});
export type WaterSortSounds = z.infer<typeof WaterSortSoundsSchema>;

export const WaterSortConfigSchema = z.object({
  maxMoves: z.number().int().min(8).max(99).default(40),
  colors: z
    .array(z.string())
    .default(["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"]),
  roundsToWin: z.number().int().min(1).max(20).default(3),
  rewardPerRound: z.number().min(0).max(9999).default(5),
  rewardPrefix: z.string().default("$"),
  failEnabled: z.boolean().default(true),
  coinImageUrl: z.string().default("/demo-assets/coin.svg"),
  rewardTextColor: z.string().default("#c48a1a"),
  hudDisplay: z.enum(["both", "score", "coins"]).default("both"),
  rounds: z.array(WaterSortRoundSchema).max(9).default([]),
  sounds: WaterSortSoundsSchema.prefault({}),
});
export type WaterSortConfig = z.infer<typeof WaterSortConfigSchema>;

export const DEFAULT_WATER_SORT_CONFIG: WaterSortConfig = {
  maxMoves: 40,
  colors: ["#e23d3d", "#2b6fdb", "#1aa35a", "#f0b429", "#9b4de0"],
  roundsToWin: 3,
  rewardPerRound: 5,
  rewardPrefix: "$",
  failEnabled: true,
  coinImageUrl: "/demo-assets/coin.svg",
  rewardTextColor: "#c48a1a",
  hudDisplay: "both",
  rounds: [
    { maxMoves: 40, coins: 5, colorCount: 3 },
    { maxMoves: 40, coins: 5, colorCount: 4 },
    { maxMoves: 40, coins: 5, colorCount: 5 },
  ],
  sounds: { pourUrl: "", denyUrl: "", payoutUrl: "" },
};

export const SolitaireRoundSchema = z.object({
  cardsToWin: z.number().int().min(4).max(52).default(13),
  tableauPiles: z.number().int().min(3).max(7).default(7),
  coins: z.number().int().min(0).max(9999).default(40),
});
export type SolitaireRound = z.infer<typeof SolitaireRoundSchema>;

export const SolitaireSoundsSchema = z.object({
  flipUrl: z.string().default(""),
  moveUrl: z.string().default(""),
  placeUrl: z.string().default(""),
  payoutUrl: z.string().default(""),
});
export type SolitaireSounds = z.infer<typeof SolitaireSoundsSchema>;

export const SolitaireConfigSchema = z.object({
  failEnabled: z.boolean().default(true),
  hintHandEnabled: z.boolean().default(true),
  hintDelayMs: z.number().int().min(500).max(15000).default(2500),
  coinImageUrl: z.string().default("/demo-assets/coin.svg"),
  hudTransparent: z.boolean().default(false),
  rounds: z.array(SolitaireRoundSchema).max(9).default([]),
  sounds: SolitaireSoundsSchema.prefault({}),
});
export type SolitaireConfig = z.infer<typeof SolitaireConfigSchema>;

export const DominoRoundSchema = z.object({
  handSize: z.number().int().min(3).max(10).default(7),
  playsToWin: z.number().int().min(3).max(28).default(7),
  coins: z.number().int().min(0).max(9999).default(40),
});
export type DominoRound = z.infer<typeof DominoRoundSchema>;

export const DominoConfigSchema = z.object({
  failEnabled: z.boolean().default(true),
  hintHandEnabled: z.boolean().default(true),
  hintDelayMs: z.number().int().min(500).max(15000).default(2500),
  coinImageUrl: z.string().default("/demo-assets/coin.svg"),
  hudTransparent: z.boolean().default(false),
  yourTurnMessage: z.string().max(80).default("Your turn — select a tile"),
  passMessage: z.string().max(80).default("Turn passed"),
  /** Higher is a faster opponent turn. 1 is about two seconds of thinking and two seconds with the tile showing. */
  turnSpeed: z.number().min(0.5).max(3).default(1),
  rounds: z.array(DominoRoundSchema).max(9).default([]),
});
export type DominoConfig = z.infer<typeof DominoConfigSchema>;

export const TappyPlaneRoundSchema = z.object({
  gapsToWin: z.number().int().min(2).max(20).default(5),
  speed: z.number().min(0.6).max(4).default(1.5),
  gapSize: z.number().min(0.22).max(0.7).default(0.42),
  coins: z.number().int().min(0).max(9999).default(40),
});
export type TappyPlaneRound = z.infer<typeof TappyPlaneRoundSchema>;

export const TappyPlaneSoundsSchema = z.object({
  engineUrl: z.string().default(""),
  flapUrl: z.string().default(""),
  coinUrl: z.string().default(""),
  crashUrl: z.string().default(""),
});
export type TappyPlaneSounds = z.infer<typeof TappyPlaneSoundsSchema>;

export const TappyPlaneConfigSchema = z.object({
  failEnabled: z.boolean().default(true),
  hintHandEnabled: z.boolean().default(true),
  hintDelayMs: z.number().int().min(500).max(15000).default(1800),
  coinImageUrl: z.string().default("/demo-assets/coin.svg"),
  hudTransparent: z.boolean().default(false),
  endless: z.boolean().default(true),
  rounds: z.array(TappyPlaneRoundSchema).max(9).default([]),
  sounds: TappyPlaneSoundsSchema.prefault({}),
});
export type TappyPlaneConfig = z.infer<typeof TappyPlaneConfigSchema>;

export const RacingLapRoundSchema = z.object({
  lapsToWin: z.number().int().min(1).max(5).default(1),
  speed: z.number().min(0.6).max(4).default(1.4),
  coins: z.number().int().min(0).max(9999).default(40),
});
export type RacingLapRound = z.infer<typeof RacingLapRoundSchema>;

export const RacingLapConfigSchema = z.object({
  failEnabled: z.boolean().default(true),
  coinImageUrl: z.string().default("/demo-assets/coin.svg"),
  hudTransparent: z.boolean().default(false),
  rounds: z.array(RacingLapRoundSchema).max(9).default([]),
});
export type RacingLapConfig = z.infer<typeof RacingLapConfigSchema>;

export const TopDownShooterRoundSchema = z.object({
  enemyCount: z.number().int().min(1).max(20).default(4),
  hpScale: z.number().min(0.4).max(5).default(1),
  speedScale: z.number().min(0.4).max(3).default(1),
  coins: z.number().int().min(0).max(9999).default(40),
});
export type TopDownShooterRound = z.infer<typeof TopDownShooterRoundSchema>;

export const TopDownShooterConfigSchema = z.object({
  lives: z.number().int().min(1).max(9).default(3),
  failEnabled: z.boolean().default(true),
  coinImageUrl: z.string().default("/demo-assets/coin.svg"),
  hudTransparent: z.boolean().default(false),
  rounds: z.array(TopDownShooterRoundSchema).max(9).default([]),
});
export type TopDownShooterConfig = z.infer<typeof TopDownShooterConfigSchema>;

export const DressUpSoundsSchema = z.object({
  selectUrl: z.string().default(""),
  dressUrl: z.string().default(""),
  revealUrl: z.string().default(""),
});
export type DressUpSounds = z.infer<typeof DressUpSoundsSchema>;

export const DressUpConfigSchema = z.object({
  promptModel: z.string().default("Choose your model"),
  promptOutfit: z.string().default("Pick a dress"),
  promptShoes: z.string().default("Pick shoes"),
  promptHat: z.string().default("Pick a hat"),
  promptEyewear: z.string().default("Pick glasses"),
  promptAccessory: z.string().default("Pick an accessory"),
  tryOnLabel: z.string().default("Try on"),
  resetLabel: z.string().default("Reset"),
  revealMs: z.number().int().min(200).max(4000).default(2500),
  includeHats: z.boolean().default(false),
  includeEyewear: z.boolean().default(false),
  includeAccessory: z.boolean().default(false),
  modelIds: z
    .array(z.string())
    .default(["model-01"]),
  hintHandEnabled: z.boolean().default(true),
  hintDelayMs: z.number().int().min(500).max(15000).default(1800),
  sounds: DressUpSoundsSchema.prefault({}),
});
export type DressUpConfig = z.infer<typeof DressUpConfigSchema>;

export const DEFAULT_DRESS_UP_CONFIG: DressUpConfig = {
  promptModel: "Choose your model",
  promptOutfit: "Pick a dress",
  promptShoes: "Pick shoes",
  promptHat: "Pick a hat",
  promptEyewear: "Pick glasses",
  promptAccessory: "Pick an accessory",
  tryOnLabel: "Try on",
  resetLabel: "Reset",
  revealMs: 2500,
  includeHats: false,
  includeEyewear: false,
  includeAccessory: false,
  modelIds: ["model-01"],
  hintHandEnabled: true,
  hintDelayMs: 1800,
  sounds: { selectUrl: "", dressUrl: "", revealUrl: "" },
};

const DefaultGameplayBackground: Background = {
  type: "gradient",
  color: "#12141a",
  gradientFrom: "#1c1f2a",
  gradientTo: "#12141a",
  gradientAngle: 180,
  portraitVideoUrl: "",
  landscapeVideoUrl: "",
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
  portraitVideoUrl: "",
  landscapeVideoUrl: "",
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
  fullBackground: FullBackgroundSchema.prefault({}),
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
  parking2d: Parking2DConfigSchema.prefault({}),
  towerDefense: TowerDefenseConfigSchema.prefault({}),
  pieceImages: z
    .array(z.string())
    .nullish()
    .transform((arr) => {
      const next = [...(arr ?? [])];
      while (next.length < MATCH3_PIECE_COUNT) next.push("");
      return next.slice(0, MATCH3_PIECE_COUNT);
    }),
  match3: Match3ConfigSchema.prefault({}),
  waterSort: WaterSortConfigSchema.prefault({}),
  solitaire: SolitaireConfigSchema.prefault({}),
  domino: DominoConfigSchema.prefault({}),
  tappyPlane: TappyPlaneConfigSchema.prefault({}),
  racingLap: RacingLapConfigSchema.prefault({}),
  topDownShooter: TopDownShooterConfigSchema.prefault({}),
  dressUp: DressUpConfigSchema.prefault({}),
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

/** Reserved override ids so a playable can customize non-layer template assets. */
export const UNLOCK_LINKS_SLOT_ID = "links";
export const UNLOCK_COIN_SLOT_ID = "coin";
export const UNLOCK_START_BG_SLOT_ID = "start-background";
export const UNLOCK_END_BG_SLOT_ID = "end-background";

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

/** Identity kit applied as variables onto a playable. Separate from personal templates. */
export const APP_BRAND_VERTICAL_LOGO_ID = "app-logo-vertical";
export const APP_BRAND_HORIZONTAL_LOGO_ID = "app-logo-horizontal";
export const APP_BRAND_ICON_ID = "app-icon";
export const APP_BRAND_DISCLAIMER_ID = "end-disclaimer";
export const START_DISCLAIMER_ID = "start-disclaimer";
export const GAMEPLAY_DISCLAIMER_ID = "gameplay-disclaimer";
export const APP_BRAND_DISCLAIMER_IDS: readonly string[] = [
  START_DISCLAIMER_ID,
  APP_BRAND_DISCLAIMER_ID,
  GAMEPLAY_DISCLAIMER_ID,
];

export const APP_BRAND_LOGO_SLOT_IDS: readonly string[] = [
  APP_BRAND_VERTICAL_LOGO_ID,
  APP_BRAND_HORIZONTAL_LOGO_ID,
];

export const APP_BRAND_IMAGE_SLOT_IDS: readonly string[] = [
  ...APP_BRAND_LOGO_SLOT_IDS,
  APP_BRAND_ICON_ID,
];

export const TEMPLATE_LOGO_SLOT_IDS: readonly string[] = BRAND_LOGO_SLOT_IDS;

export const AppBrandDataSchema = z.object({
  appName: z.string().default(""),
  googlePlayUrl: z.string().default(""),
  appStoreUrl: z.string().default(""),
  logoVerticalUrl: z.string().default(""),
  logoHorizontalUrl: z.string().default(""),
  appIconUrl: z.string().default(""),
  coinImageUrl: z.string().default(""),
  geo: z.string().default("US"),
  language: z.string().default("en"),
  disclaimerText: z.string().default(""),
  primaryColor: z.string().default("#e07a3d"),
  secondaryColor: z.string().default("#1c1f2a"),
});
export type AppBrandData = z.infer<typeof AppBrandDataSchema>;

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
    unlockedSlotIds: z.array(z.string()).default([]),
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
