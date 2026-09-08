import type { Background, Orientation, TopDownShooterConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame } from "@/playable-runtime/engines/canvas-setup";
import { CANVAS_HUD_H, drawCanvasHud } from "@/playable-runtime/engines/canvas-hud";
import { createVirtualJoystick } from "@/playable-runtime/engines/virtual-joystick";
import { SHOOTER_SPRITES } from "@/playable-runtime/engines/kenney-2d-assets";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";
import { listShooterRounds } from "@/playable-runtime/engines/top-down-shooter/rounds";

type Extra = {
  background?: Background;
  orientation?: Orientation;
  topDownShooter?: TopDownShooterConfig;
  playAllRounds?: boolean;
  parkingRoundIndex?: number;
};

type Enemy = { x: number; y: number; hp: number; kind: 0 | 1 };
type Bullet = { x: number; y: number; vx: number; vy: number };

export function createTopDownShooterEngine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let winCb: (() => void) | null = null;
  let loseCb: (() => void) | null = null;
  let running = false;
  let raf = 0;
  let ended = false;
  let last = 0;
  let config: TopDownShooterConfig = { lives: 3, failEnabled: true, coinImageUrl: "", hudTransparent: false, rounds: [] };
  let playAllRounds = true;
  let roundIndex = 0;
  let earned = 0;
  let lives = 3;
  let killed = 0;
  let fireCd = 0;
  let hurtCd = 0;
  let background: Background | undefined;
  let orientation: Orientation = "portrait";
  let bgImage: HTMLImageElement | null = null;
  let coinImage: HTMLImageElement | null = null;
  let playerImg: HTMLImageElement | null = null;
  let zombieImg: HTMLImageElement | null = null;
  let soldierImg: HTMLImageElement | null = null;
  let floorImg: HTMLImageElement | null = null;
  let assets: Record<string, string> = {};
  let loadToken = 0;
  let px = 0.5;
  let py = 0.55;
  let facing = 0;
  let enemies: Enemy[] = [];
  let bullets: Bullet[] = [];
  const stick = createVirtualJoystick();
  let onDown: (e: PointerEvent) => void;
  let onMove: (e: PointerEvent) => void;
  let onUp: (e: PointerEvent) => void;

  function rounds() {
    return listShooterRounds(config);
  }
  function current() {
    const list = rounds();
    return list[Math.max(0, Math.min(roundIndex, list.length - 1))] ?? list[0];
  }

  function spawnWave() {
    const round = current();
    enemies = [];
    killed = 0;
    for (let i = 0; i < round.enemyCount; i++) {
      const ang = (i / round.enemyCount) * Math.PI * 2;
      enemies.push({
        x: 0.5 + Math.cos(ang) * 0.38,
        y: 0.55 + Math.sin(ang) * 0.32,
        hp: round.hpScale,
        kind: i % 2 === 0 ? 0 : 1,
      });
    }
  }

  function resetWave() {
    px = 0.5;
    py = 0.55;
    facing = 0;
    bullets = [];
    fireCd = 0;
    hurtCd = 0;
    ended = false;
    spawnWave();
    stick.onUp(-1);
  }

  function completeRound() {
    if (ended) return;
    earned += current().coins;
    const list = rounds();
    if (playAllRounds && roundIndex < list.length - 1) {
      roundIndex += 1;
      resetWave();
      return;
    }
    ended = true;
    winCb?.();
  }

  function tick(dt: number) {
    if (ended) return;
    const round = current();
    px += stick.state.x * 0.55 * dt;
    py += stick.state.y * 0.55 * dt;
    px = Math.min(0.92, Math.max(0.08, px));
    py = Math.min(0.9, Math.max(0.18, py));
    if (Math.hypot(stick.state.x, stick.state.y) > 0.15) facing = Math.atan2(stick.state.y, stick.state.x);
    fireCd -= dt;
    hurtCd -= dt;
    let nearest: Enemy | null = null;
    let nearestD = 99;
    for (const e of enemies) {
      const dx = px - e.x;
      const dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * 0.12 * round.speedScale * dt;
      e.y += (dy / d) * 0.12 * round.speedScale * dt;
      if (d < nearestD) {
        nearest = e;
        nearestD = d;
      }
      if (d < 0.06 && hurtCd <= 0) {
        hurtCd = 0.8;
        lives -= 1;
        if (lives <= 0 && config.failEnabled) {
          ended = true;
          loseCb?.();
          return;
        }
        if (lives <= 0) lives = 1;
      }
    }
    if (nearest && fireCd <= 0) {
      const dx = nearest.x - px;
      const dy = nearest.y - py;
      const d = Math.hypot(dx, dy) || 1;
      facing = Math.atan2(dy, dx);
      bullets.push({ x: px, y: py, vx: (dx / d) * 1.6, vy: (dy / d) * 1.6 });
      fireCd = 0.22;
    }
    bullets = bullets.filter((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 0 || b.x > 1 || b.y < 0.1 || b.y > 1) return false;
      for (const e of enemies) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < 0.045) {
          e.hp -= 1;
          return false;
        }
      }
      return true;
    });
    const before = enemies.length;
    enemies = enemies.filter((e) => e.hp > 0);
    killed += before - enemies.length;
    if (!enemies.length) completeRound();
  }

  function drawSprite(img: HTMLImageElement | null, x: number, y: number, size: number, rot: number) {
    if (!ctx) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot + Math.PI / 2);
    if (img?.complete && img.naturalWidth) ctx.drawImage(img, -size / 2, -size / 2, size, size);
    else {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-size / 2, -size / 2, size, size);
    }
    ctx.restore();
  }

  function draw() {
    if (!canvas || !ctx || !container) return;
    const now = performance.now();
    const dt = Math.min(0.033, (now - (last || now)) / 1000);
    last = now;
    if (running) tick(dt);
    const { w, h } = beginCanvasFrame(canvas, ctx, container);
    if (floorImg?.complete) {
      const tw = 48;
      for (let y = CANVAS_HUD_H; y < h; y += tw) {
        for (let x = 0; x < w; x += tw) ctx.drawImage(floorImg, x, y, tw, tw);
      }
    } else drawCanvasBackground(ctx, w, h, background, bgImage);
    const playH = h - CANVAS_HUD_H;
    const sx = (nx: number) => nx * w;
    const sy = (ny: number) => CANVAS_HUD_H + ny * playH;
    for (const e of enemies) {
      drawSprite(e.kind ? soldierImg : zombieImg, sx(e.x), sy(e.y), 36, Math.atan2(py - e.y, px - e.x));
    }
    ctx.fillStyle = "#fbbf24";
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(sx(b.x), sy(b.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSprite(playerImg, sx(px), sy(py), 42, facing);
    stick.place(w, h);
    stick.draw(ctx);
    const list = rounds();
    drawCanvasHud(ctx, {
      w,
      roundText: `R${Math.min(roundIndex + 1, list.length)}/${list.length}`,
      coinsText: `${earned}`,
      extraText: `Lives ${lives}  ${killed}/${current().enemyCount}`,
      coinImage,
      transparent: config.hudTransparent,
    });
  }

  function loop() {
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  async function load(extra: Extra) {
    if (extra.background) background = extra.background;
    if (extra.orientation) orientation = extra.orientation;
    const token = ++loadToken;
    const bgUrl = canvasBgUrl(background, orientation);
    const media = (ref: string) => resolveRuntimeUrl(ref, assets) || ref;
    const [bg, coin, player, zombie, soldier, floor] = await Promise.all([
      background?.type === "image" && bgUrl ? loadImage(media(bgUrl)) : Promise.resolve(null),
      config.coinImageUrl ? loadImage(media(config.coinImageUrl)) : Promise.resolve(null),
      loadImage(media(SHOOTER_SPRITES.player)),
      loadImage(media(SHOOTER_SPRITES.zombie)),
      loadImage(media(SHOOTER_SPRITES.soldier)),
      loadImage(media(SHOOTER_SPRITES.floor)),
    ]);
    if (token !== loadToken) return;
    bgImage = bg;
    coinImage = coin;
    playerImg = player;
    zombieImg = zombie;
    soldierImg = soldier;
    floorImg = floor;
  }

  return {
    id: "top-down-shooter",
    name: "Top-down Shooter",
    initialize(ctxInit: EngineInitContext) {
      const extra = ctxInit as EngineInitContext & Extra;
      container = ctxInit.container;
      const attached = attachPlayableCanvas(ctxInit.container);
      canvas = attached.canvas;
      ctx = attached.ctx;
      orientation = ctxInit.orientation;
      assets = ctxInit.assets || {};
      if (extra.topDownShooter) config = extra.topDownShooter;
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      lives = config.lives || 3;
      background = extra.background;
      resetWave();
      onDown = (e) => {
        if (!canvas || ended) return;
        if (stick.onDown(e.clientX, e.clientY, canvas.getBoundingClientRect(), e.pointerId, container!.clientWidth, container!.clientHeight)) {
          canvas.setPointerCapture(e.pointerId);
        }
      };
      onMove = (e) => {
        if (!canvas) return;
        stick.onMove(e.clientX, e.clientY, canvas.getBoundingClientRect(), e.pointerId);
      };
      onUp = (e) => stick.onUp(e.pointerId);
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      void load(extra).then(() => draw());
    },
    setOptions(options) {
      const extra = options as Extra;
      if (extra.topDownShooter) {
        config = extra.topDownShooter;
        lives = config.lives || lives;
      }
      if (typeof extra.playAllRounds === "boolean") playAllRounds = extra.playAllRounds;
      if (typeof extra.parkingRoundIndex === "number" && extra.parkingRoundIndex !== roundIndex) {
        roundIndex = extra.parkingRoundIndex;
        resetWave();
      }
      void load(extra).then(() => draw());
    },
    start() {
      running = true;
      last = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    reset() {
      earned = 0;
      lives = config.lives || 3;
      roundIndex = playAllRounds ? 0 : roundIndex;
      resetWave();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("pointerdown", onDown);
      canvas?.removeEventListener("pointermove", onMove);
      canvas?.removeEventListener("pointerup", onUp);
      canvas?.removeEventListener("pointercancel", onUp);
      container = null;
      canvas = null;
      ctx = null;
    },
    onWin(cb) {
      winCb = cb;
    },
    onLose(cb) {
      loseCb = cb;
    },
    resize() {
      draw();
    },
  };
}
