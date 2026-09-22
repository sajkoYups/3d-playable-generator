import type { Background, DressUpConfig, Orientation } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame, pointerCanvasPos } from "@/playable-runtime/engines/canvas-setup";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";
import { AudioBus } from "@/playable-runtime/audio/bus";
import { pickSoundUrl, PLAYABLE_SOUNDS } from "@/playable-runtime/audio/defaults";
import {
  DRESS_UP_ACCESSORIES,
  DRESS_UP_DRESSES,
  DRESS_UP_ITEMS,
  DRESS_UP_MODELS,
  DRESS_UP_SHOES,
  FITTED_CANVAS,
  dressUpItem,
  lookItemId,
  type DressUpItem,
} from "@/playable-runtime/engines/dress-up/catalog";

const FALLBACK: DressUpConfig = {
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

const APPLY_MS = 850;
const FLASH_MS = 400;
const HINT_CYCLE_MS = 900;
const MIN_TOUCH = 44;

const INK = "#3a342c";
const MUTED = "#7a7268";
const CARD = "rgba(255,252,248,0.94)";
const CARD_SEL = "rgba(255,246,236,0.98)";
const RING = "rgba(176,137,104,0.28)";
const RING_SEL = "#b08968";
const FOCUS = "rgba(176,137,104,0.16)";

type CanvasOptions = {
  background?: Background;
  dressUp?: DressUpConfig;
  orientation?: Orientation;
  hintHandUrl?: string;
  hintHandVisible?: boolean;
  audioBus?: AudioBus;
};

type Phase = "selecting" | "applying" | "revealed";
type Category = "dress" | "shoes" | "accessory";
type Rect = { x: number; y: number; w: number; h: number };
type ModelBox = { x: number; y: number; dw: number; dh: number };

type Hit = { kind: "item"; id: string; category: Category; rect: Rect };

type Thumb = { id: string; rect: Rect };

type Layout = {
  landscape: boolean;
  prompt: Rect;
  modelStage: Rect;
  label: Rect;
  thumbs: Thumb[];
  showTray: boolean;
};

type Session = {
  started: boolean;
  round: Category;
  dressId: string | null;
  shoesId: string | null;
  accessoryId: string | null;
  lookId: string | null;
  targetLookId: string | null;
  flyingId: string | null;
  flyFrom: Rect | null;
  phase: Phase;
  applyAt: number;
  holdUntil: number;
  won: boolean;
};

type Spark = { px: number; py: number; r: number; delay: number };

function emptySession(): Session {
  return {
    started: false,
    round: "dress",
    dressId: null,
    shoesId: null,
    accessoryId: null,
    lookId: null,
    targetLookId: null,
    flyingId: null,
    flyFrom: null,
    phase: "selecting",
    applyAt: 0,
    holdUntil: 0,
    won: false,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hitRect(x: number, y: number, r: Rect) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function drawContainedSrc(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  x: number,
  y: number,
  w: number,
  h: number,
  pad = 0,
) {
  if (sw < 1 || sh < 1 || !img.naturalWidth) return;
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, h - pad * 2);
  const s = Math.min(innerW / sw, innerH / sh);
  const dw = sw * s;
  const dh = sh * s;
  ctx.drawImage(img, sx, sy, sw, sh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function itemsFor(kind: Category): DressUpItem[] {
  if (kind === "dress") return DRESS_UP_DRESSES;
  if (kind === "shoes") return DRESS_UP_SHOES;
  return DRESS_UP_ACCESSORIES;
}

function flyAnchor(item: DressUpItem, box: ModelBox): Rect {
  const cx = box.x + box.dw / 2;
  if (item.category === "dress") {
    const w = box.dw * 0.52;
    const h = box.dh * 0.58;
    return { x: cx - w / 2, y: box.y + box.dh * 0.16, w, h };
  }
  if (item.category === "shoes") {
    const w = box.dw * 0.4;
    const h = box.dh * 0.18;
    return { x: cx - w / 2, y: box.y + box.dh * 0.78, w, h };
  }
  if (item.id === "acc-sunglasses") {
    const w = box.dw * 0.34;
    const h = box.dh * 0.1;
    return { x: cx - w / 2, y: box.y + box.dh * 0.12, w, h };
  }
  const w = box.dw * 0.28;
  const h = box.dh * 0.14;
  return { x: cx - w / 2, y: box.y + box.dh * 0.22, w, h };
}

export function createDressUpEngine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let running = false;
  let raf = 0;
  let winCb: (() => void) | null = null;
  let loadToken = 0;

  let background: Background | undefined;
  let orientation: Orientation = "portrait";
  let config: DressUpConfig = { ...FALLBACK };
  let assets: Record<string, string> = {};
  let sfx: AudioBus | null = null;
  let sfxOwned = false;
  let unlockEl: HTMLElement | null = null;
  let hintHandUrl = "";
  let hintHandVisible = true;

  let bgImage: HTMLImageElement | null = null;
  let handImage: HTMLImageElement | null = null;
  const images = new Map<string, HTMLImageElement | null>();

  let session = emptySession();
  let lastInputAt = 0;
  let hits: Hit[] = [];
  let lastHintRect: Rect | null = null;
  let lastLayout: Layout | null = null;
  let sparks: Spark[] = [];
  let tryOnToken = 0;
  let restoreBag: { session: Session; at: number } | null = null;

  function media(url: string) {
    return resolveRuntimeUrl(url, assets) || (Object.keys(assets).length === 0 ? url : "");
  }

  function imgFor(id: string | null): HTMLImageElement | null {
    if (!id) return null;
    const img = images.get(id);
    return img && img.complete && img.naturalWidth ? img : null;
  }

  function selectedId(kind: Category) {
    if (kind === "dress") return session.dressId;
    if (kind === "shoes") return session.shoesId;
    return session.accessoryId;
  }

  function setSelected(kind: Category, id: string) {
    if (kind === "dress") session.dressId = id;
    else if (kind === "shoes") session.shoesId = id;
    else session.accessoryId = id;
  }

  function nextRound(kind: Category): Category | "done" {
    if (kind === "dress") return "shoes";
    if (kind === "shoes") return "accessory";
    return "done";
  }

  function beginPlay() {
    tryOnToken += 1;
    session = emptySession();
    session.started = true;
    session.phase = "selecting";
    sparks = [];
    lastInputAt = performance.now();
  }

  function snapApplyIfNeeded() {
    if (session.phase !== "applying") return;
    finishApply(performance.now());
  }

  function resolveSfx(url: string) {
    return resolveRuntimeUrl(url, assets) || url;
  }

  function wireSfx(cfg: DressUpConfig) {
    if (!sfx) return;
    const s = cfg.sounds;
    sfx.setExtraUrls({
      select: resolveSfx(pickSoundUrl(s?.selectUrl, PLAYABLE_SOUNDS.swoosh)),
      dress: resolveSfx(pickSoundUrl(s?.dressUrl, PLAYABLE_SOUNDS.swoosh)),
      reveal: resolveSfx(pickSoundUrl(s?.revealUrl, PLAYABLE_SOUNDS.wow)),
    });
  }

  function playCue(id: string, throttleMs = 0) {
    sfx?.playSfx(id, { throttleMs });
  }

  function onSfxUnlock() {
    void sfx?.unlock();
  }

  function promptText() {
    if (session.phase === "revealed") return "Your look";
    if (session.round === "dress") return config.promptOutfit;
    if (session.round === "shoes") return config.promptShoes;
    return config.promptAccessory;
  }

  async function applyOptions(options?: CanvasOptions) {
    if (!options) return;
    if (options.background) background = options.background;
    if (options.orientation) orientation = options.orientation;
    if (options.dressUp) {
      config = { ...FALLBACK, ...options.dressUp };
      wireSfx(config);
    }
    if (typeof options.hintHandUrl === "string") hintHandUrl = options.hintHandUrl;
    if (typeof options.hintHandVisible === "boolean") hintHandVisible = options.hintHandVisible;

    const token = ++loadToken;
    const bgUrl = canvasBgUrl(background, orientation);
    const urls = DRESS_UP_ITEMS.map((item) => item.url);
    const [nextBg, nextHand, ...loaded] = await Promise.all([
      background?.type === "image" && bgUrl ? loadImage(media(bgUrl) || bgUrl) : Promise.resolve(null),
      hintHandUrl ? loadImage(media(hintHandUrl) || hintHandUrl) : Promise.resolve(null),
      ...urls.map((url) => {
        const resolved = media(url);
        return resolved ? loadImage(resolved) : Promise.resolve(null);
      }),
    ]);
    if (token !== loadToken) return;
    bgImage = nextBg;
    handImage = nextHand;
    images.clear();
    DRESS_UP_ITEMS.forEach((item, i) => {
      images.set(item.id, loaded[i] ?? null);
    });
  }

  function trayHidden() {
    return session.phase === "revealed" || (session.phase === "applying" && session.round === "accessory");
  }

  function layout(w: number, h: number): Layout {
    const pad = Math.max(8, Math.min(w, h) * 0.022);
    const gap = Math.max(6, pad * 0.65);
    const landscape = orientation === "landscape" || w > h * 1.12;
    const promptH = clamp(h * 0.055, 26, 36);
    const labelH = clamp(h * 0.03, 14, 18);
    const showTray = !trayHidden();
    const items = showTray ? itemsFor(session.round) : [];
    const count = Math.max(1, items.length);
    const emptyLabel: Rect = { x: pad, y: 0, w: 0, h: 0 };

    if (!showTray) {
      const prompt: Rect = { x: pad, y: pad * 0.7, w: w - pad * 2, h: promptH };
      const modelStage: Rect = {
        x: pad,
        y: prompt.y + prompt.h + gap,
        w: w - pad * 2,
        h: Math.max(72, h - pad - (prompt.y + prompt.h + gap)),
      };
      return { landscape, prompt, modelStage, label: emptyLabel, thumbs: [], showTray };
    }

    if (landscape) {
      const panelW = clamp(w * 0.38, 180, Math.min(300, w * 0.44));
      const modelStage: Rect = {
        x: pad,
        y: pad,
        w: Math.max(80, w - panelW - pad * 3),
        h: h - pad * 2,
      };
      const panelX = modelStage.x + modelStage.w + pad;
      const panel: Rect = { x: panelX, y: pad, w: panelW, h: h - pad * 2 };
      const prompt: Rect = { x: panel.x, y: panel.y, w: panel.w, h: promptH };
      const hideLabels = panel.h < 280;
      const label: Rect = {
        x: panel.x,
        y: prompt.y + prompt.h + gap,
        w: panel.w,
        h: hideLabels ? 0 : labelH,
      };
      const areaTop = label.y + label.h + (hideLabels ? 0 : gap * 0.4);
      const areaBottom = panel.y + panel.h;
      const areaH = Math.max(MIN_TOUCH, areaBottom - areaTop);
      const cardGap = gap;
      const cardH = Math.max(36, (areaH - cardGap * (count - 1)) / count);
      const thumbs: Thumb[] = items.map((item, i) => ({
        id: item.id,
        rect: { x: panel.x, y: areaTop + i * (cardH + cardGap), w: panel.w, h: cardH },
      }));
      return { landscape, prompt, modelStage, label, thumbs, showTray };
    }

    const prompt: Rect = { x: pad, y: pad * 0.7, w: w - pad * 2, h: promptH };
    const hideLabels = h < 500;
    const label: Rect = {
      x: pad,
      y: 0,
      w: w - pad * 2,
      h: hideLabels ? 0 : labelH,
    };
    const cardH = clamp(h * 0.2, MIN_TOUCH + 8, 150);
    const cardsBottom = h - pad;
    const cardsTop = cardsBottom - cardH;
    const modelTop = prompt.y + prompt.h + gap * 0.5;
    label.y = Math.max(modelTop + 80, cardsTop - (hideLabels ? 0 : label.h + gap * 0.35));
    const thumbsY = label.y + label.h + (hideLabels ? 0 : gap * 0.3);
    const thumbsH = Math.max(MIN_TOUCH, cardsBottom - thumbsY);
    const thumbW = (w - pad * 2 - gap * (count - 1)) / count;
    const thumbs: Thumb[] = items.map((item, i) => ({
      id: item.id,
      rect: { x: pad + i * (thumbW + gap), y: thumbsY, w: thumbW, h: thumbsH },
    }));
    const modelStage: Rect = {
      x: pad,
      y: modelTop,
      w: w - pad * 2,
      h: Math.max(72, (hideLabels ? thumbsY : label.y) - gap - modelTop),
    };
    return { landscape, prompt, modelStage, label, thumbs, showTray };
  }

  function stackBox(stage: Rect): ModelBox {
    const s = Math.min(stage.w / FITTED_CANVAS.width, stage.h / FITTED_CANVAS.height);
    const dw = FITTED_CANVAS.width * s;
    const dh = FITTED_CANVAS.height * s;
    const extraY = Math.max(0, stage.h - dh);
    return {
      x: stage.x + (stage.w - dw) / 2,
      y: stage.y + extraY * 0.55,
      dw,
      dh,
    };
  }

  function drawPrompt(rect: Rect, text: string) {
    if (!ctx) return;
    ctx.save();
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
    ctx.fillStyle = "rgba(58,52,44,0.08)";
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.max(12, Math.min(18, rect.h * 0.48))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.4, rect.w - 16);
    ctx.restore();
  }

  function drawLabel(rect: Rect, text: string, focused: boolean) {
    if (!ctx || rect.h < 2) return;
    ctx.save();
    ctx.fillStyle = focused ? INK : MUTED;
    ctx.font = `${focused ? 700 : 600} ${Math.max(10, Math.min(13, rect.h * 0.78))}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + 2, rect.y + rect.h / 2, rect.w - 4);
    ctx.restore();
  }

  function drawThumb(thumb: Thumb, selected: boolean, focusedRow: boolean) {
    if (!ctx) return;
    const item = dressUpItem(thumb.id);
    const r = thumb.rect;
    ctx.save();
    if (focusedRow && !selected) {
      roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fillStyle = FOCUS;
      ctx.fill();
    }
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = selected ? CARD_SEL : CARD;
    ctx.fill();
    ctx.strokeStyle = selected ? RING_SEL : RING;
    ctx.lineWidth = selected ? 2.4 : 1;
    ctx.stroke();
    if (item) {
      const img = imgFor(item.id);
      if (img) {
        const crop = item.crop;
        drawContainedSrc(ctx, img, crop.x, crop.y, crop.w, crop.h, r.x, r.y, r.w, r.h, 7);
      }
    }
    ctx.restore();
  }

  function drawCharacter(box: ModelBox, item: DressUpItem, alpha: number) {
    if (!ctx || alpha <= 0) return;
    const img = imgFor(item.id);
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, box.x, box.y, box.dw, box.dh);
    ctx.restore();
  }

  function drawShadow(box: ModelBox) {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = "rgba(58,52,44,0.16)";
    ctx.beginPath();
    ctx.ellipse(box.x + box.dw / 2, box.y + box.dh - 4, box.dw * 0.26, Math.max(5, box.dh * 0.028), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function thumbRectFor(id: string): Rect | null {
    if (!lastLayout) return null;
    return lastLayout.thumbs.find((entry) => entry.id === id)?.rect ?? null;
  }

  function drawFlying(box: ModelBox, now: number) {
    if (!ctx || session.phase !== "applying" || !session.applyAt || prefersReducedMotion()) return;
    const id = session.flyingId;
    if (!id) return;
    const item = dressUpItem(id);
    const img = imgFor(id);
    const from = session.flyFrom || thumbRectFor(id);
    if (!item || !img || !from) return;
    const local = Math.min(1, Math.max(0, (now - session.applyAt) / APPLY_MS));
    if (local <= 0) return;
    const ease = easeOutCubic(local);
    const to = flyAnchor(item, box);
    const x = from.x + (to.x - from.x) * ease;
    const y = from.y + (to.y - from.y) * ease;
    const w = from.w + (to.w - from.w) * ease;
    const h = from.h + (to.h - from.h) * ease;
    ctx.save();
    ctx.globalAlpha = 0.4 + ease * 0.6;
    const crop = item.crop;
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, x, y, w, h);
    ctx.restore();
  }

  function drawFlash(box: ModelBox, flashT: number) {
    if (!ctx || flashT <= 0) return;
    const pulse = Math.sin(Math.min(1, flashT) * Math.PI);
    ctx.save();
    const grd = ctx.createRadialGradient(
      box.x + box.dw / 2,
      box.y + box.dh * 0.42,
      8,
      box.x + box.dw / 2,
      box.y + box.dh * 0.42,
      box.dh * 0.55,
    );
    grd.addColorStop(0, `rgba(255,252,245,${0.72 * pulse})`);
    grd.addColorStop(1, "rgba(255,252,245,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(box.x - 8, box.y - 8, box.dw + 16, box.dh + 16);
    for (const spark of sparks) {
      const t = clamp((flashT - spark.delay) / 0.7, 0, 1);
      if (t <= 0) continue;
      const a = Math.sin(t * Math.PI) * pulse;
      ctx.globalAlpha = a;
      ctx.fillStyle = "#fff8e8";
      ctx.beginPath();
      ctx.arc(box.x + spark.px * box.dw, box.y + spark.py * box.dh, spark.r * (0.7 + pulse), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHint(now: number, rect: Rect | null) {
    if (!ctx || !rect) return;
    if (!config.hintHandEnabled || !hintHandVisible || !running) return;
    if (session.phase !== "selecting") return;
    if (now - lastInputAt < config.hintDelayMs) return;
    const cycle = ((now - lastInputAt - config.hintDelayMs) % HINT_CYCLE_MS) / HINT_CYCLE_MS;
    const bounce = easeInOut(cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2);
    const size = Math.min(rect.w, rect.h) * 0.42;
    const x = rect.x + rect.w * 0.62;
    const y = rect.y + rect.h * 0.55 + bounce * 10;
    if (handImage && handImage.complete && handImage.naturalWidth) {
      ctx.drawImage(handImage, x - size * 0.15, y - size * 0.1, size, size);
    } else {
      ctx.fillStyle = "rgba(248,250,252,0.95)";
      ctx.beginPath();
      ctx.arc(x, y, size * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function seedSparks() {
    sparks = Array.from({ length: 14 }, (_, i) => ({
      px: 0.28 + ((i * 17) % 45) / 100,
      py: 0.18 + ((i * 23) % 60) / 100,
      r: 1.6 + (i % 4),
      delay: (i % 5) * 0.08,
    }));
  }

  function applyTimings() {
    if (prefersReducedMotion()) return { apply: 0, flash: 160, total: 160 };
    return { apply: APPLY_MS, flash: FLASH_MS, total: APPLY_MS + FLASH_MS };
  }

  function stageItem(id: string | null): DressUpItem | undefined {
    if (!id) return DRESS_UP_MODELS[0];
    return dressUpItem(id) ?? DRESS_UP_MODELS[0];
  }

  function drawLook(box: ModelBox, now: number) {
    drawShadow(box);
    const fromItem = stageItem(session.lookId);
    const toItem = session.targetLookId ? dressUpItem(session.targetLookId) : undefined;
    const timings = applyTimings();
    let wear = 0;
    let flashT = 0;
    let flying = false;

    if (session.phase === "revealed") {
      wear = 1;
    } else if (session.phase === "selecting") {
      wear = session.lookId ? 1 : 0;
    } else if (session.phase === "applying" && session.applyAt) {
      const elapsed = now - session.applyAt;
      if (elapsed < timings.apply) {
        flying = timings.apply > 0;
      } else {
        flashT = clamp((elapsed - timings.apply) / Math.max(1, timings.flash), 0, 1);
        wear = easeInOut(flashT);
      }
    }

    if (wear < 1 && fromItem) drawCharacter(box, fromItem, 1 - wear);
    if (wear > 0) {
      const shown = toItem || (session.lookId ? dressUpItem(session.lookId) : undefined);
      if (shown) drawCharacter(box, shown, wear);
      else if (fromItem) drawCharacter(box, fromItem, 1);
    }
    if (flying) drawFlying(box, now);
    if (flashT > 0) drawFlash(box, flashT);
  }

  function finishApply(now: number) {
    if (session.targetLookId) session.lookId = session.targetLookId;
    session.targetLookId = null;
    session.flyingId = null;
    session.flyFrom = null;
    session.applyAt = 0;
    sparks = [];
    const following = nextRound(session.round);
    if (following === "done") {
      session.phase = "revealed";
      session.holdUntil = now + config.revealMs;
      playCue("reveal");
      return;
    }
    session.round = following;
    session.phase = "selecting";
    lastInputAt = now;
  }

  async function startRoundPick(id: string) {
    if (session.phase !== "selecting") return;
    const round = session.round;
    setSelected(round, id);
    const targetId = lookItemId(session.dressId, session.shoesId, session.accessoryId);
    const look = targetId ? dressUpItem(targetId) : undefined;
    if (!targetId || !look) {
      if (round === "dress") session.dressId = null;
      else if (round === "shoes") session.shoesId = null;
      else session.accessoryId = null;
      return;
    }
    const token = ++tryOnToken;
    session.flyFrom = thumbRectFor(id);
    session.phase = "applying";
    session.targetLookId = targetId;
    session.flyingId = id;
    session.applyAt = 0;
    session.holdUntil = 0;
    let img = imgFor(targetId);
    if (!img) {
      const loaded = await loadImage(media(look.url) || look.url);
      if (token !== tryOnToken || session.phase !== "applying") return;
      if (loaded) images.set(targetId, loaded);
      img = loaded;
    }
    if (token !== tryOnToken || session.phase !== "applying") return;
    if (!img) {
      session.phase = "selecting";
      session.targetLookId = null;
      session.flyingId = null;
      session.flyFrom = null;
      if (round === "dress") session.dressId = null;
      else if (round === "shoes") session.shoesId = null;
      else session.accessoryId = null;
      return;
    }
    const now = performance.now();
    session.applyAt = now;
    seedSparks();
    playCue("dress");
    if (prefersReducedMotion()) finishApply(now);
  }

  function draw() {
    if (!canvas || !ctx || !container) return;
    const { w, h } = beginCanvasFrame(canvas, ctx, container);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    drawCanvasBackground(ctx, w, h, background, bgImage);

    const now = performance.now();
    const timings = applyTimings();
    if (session.phase === "applying" && session.applyAt > 0 && now - session.applyAt >= timings.total) {
      finishApply(now);
    }
    if (session.phase === "revealed" && session.lookId && !imgFor(session.lookId) && DRESS_UP_MODELS[0]) {
      // Keep the previous character visible until the next look is ready.
    } else if (!session.won && session.phase === "revealed" && session.holdUntil > 0 && now >= session.holdUntil) {
      session.won = true;
      winCb?.();
    }

    const L = layout(w, h);
    lastLayout = L;
    hits = [];
    lastHintRect = null;

    drawPrompt(L.prompt, promptText());
    drawLook(stackBox(L.modelStage), now);

    const selecting = session.phase === "selecting";
    if (L.showTray) {
      const roundTitle =
        session.round === "dress" ? "Dress" : session.round === "shoes" ? "Shoes" : "Accessory";
      drawLabel(L.label, roundTitle, selecting);
      for (const thumb of L.thumbs) {
        drawThumb(thumb, selectedId(session.round) === thumb.id, selecting);
        if (selecting) hits.push({ kind: "item", id: thumb.id, category: session.round, rect: thumb.rect });
      }
      if (selecting && L.thumbs[0]) lastHintRect = L.thumbs[0].rect;
    }

    drawHint(now, lastHintRect);
  }

  function onPointer(e: PointerEvent) {
    if (!running || !canvas || !container || session.won) return;
    if (session.phase !== "selecting") return;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const pos = pointerCanvasPos(e, canvas, w, h);
    const hit = hits.find((entry) => hitRect(pos.x, pos.y, entry.rect));
    if (!hit || hit.kind !== "item") return;
    lastInputAt = performance.now();
    playCue("select");
    void startRoundPick(hit.id);
  }

  function loop() {
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  return {
    id: "dress-up",
    name: "Fashion Dress-Up",
    initialize(ctxInit: EngineInitContext) {
      const extra = ctxInit as EngineInitContext & CanvasOptions;
      container = ctxInit.container;
      assets = ctxInit.assets || {};
      ctxInit.container.style.position = ctxInit.container.style.position || "relative";
      const attached = attachPlayableCanvas(ctxInit.container);
      canvas = attached.canvas;
      ctx = attached.ctx;
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      orientation = ctxInit.orientation;
      config = { ...FALLBACK, ...(extra.dressUp || {}) };
      if (extra.audioBus) {
        sfx = extra.audioBus;
        sfxOwned = false;
      } else {
        sfx = new AudioBus();
        sfxOwned = true;
      }
      wireSfx(config);
      unlockEl = ctxInit.container;
      unlockEl.addEventListener("pointerdown", onSfxUnlock, true);
      const bag = restoreBag;
      restoreBag = null;
      if (bag && performance.now() - bag.at < 80 && !bag.session.won) {
        session = bag.session;
        session.started = true;
        snapApplyIfNeeded();
      } else {
        beginPlay();
      }
      void applyOptions(extra).then(() => draw());
      canvas.addEventListener("pointerdown", onPointer);
    },
    setOptions(options) {
      void applyOptions(options as CanvasOptions).then(() => draw());
    },
    start() {
      running = true;
      lastInputAt = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    reset() {
      beginPlay();
      lastInputAt = performance.now();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      tryOnToken += 1;
      snapApplyIfNeeded();
      restoreBag = { session: { ...session }, at: performance.now() };
      canvas?.removeEventListener("pointerdown", onPointer);
      unlockEl?.removeEventListener("pointerdown", onSfxUnlock, true);
      unlockEl = null;
      if (sfxOwned) sfx?.destroy();
      else sfx?.stopLoop();
      sfx = null;
      container = null;
      canvas = null;
      ctx = null;
      bgImage = null;
      handImage = null;
      images.clear();
      lastLayout = null;
    },
    onWin(cb) {
      winCb = cb;
    },
    onLose(_cb) {},
    resize() {
      draw();
    },
  };
}
