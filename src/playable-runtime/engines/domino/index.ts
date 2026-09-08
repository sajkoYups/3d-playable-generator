import type { Background, Orientation, DominoConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame, pointerCanvasPos } from "@/playable-runtime/engines/canvas-setup";
import { CANVAS_HUD_H, drawCanvasHud } from "@/playable-runtime/engines/canvas-hud";
import { drawHintHand } from "@/playable-runtime/engines/hint-hand";
import { dominoUrl } from "@/playable-runtime/engines/kenney-2d-assets";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";
import { listDominoRounds } from "@/playable-runtime/engines/domino/rounds";

type Tile = { a: number; b: number };
type Turn = "player" | "cpu";
type ChainSlot = { tile: Tile; x: number; y: number; w: number; h: number; lying: boolean };
type DropZone = { x: number; y: number; w: number; h: number; side: "left" | "right" };

type Extra = {
  background?: Background;
  orientation?: Orientation;
  domino?: DominoConfig;
  playAllRounds?: boolean;
  parkingRoundIndex?: number;
  hintHandUrl?: string;
  hintHandVisible?: boolean;
};

const CPU_THINK_MS = 550;
const TILE_LONG_MAX = 48;
const TILE_LONG_MIN = 30;
const TILE_GAP = 3;
const DROP_W = 44;
const DROP_H = 52;

function pack(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push({ a, b });
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

function matches(tile: Tile, pip: number) {
  return tile.a === pip || tile.b === pip;
}

function isDouble(tile: Tile) {
  return tile.a === tile.b;
}

function pipSum(tiles: Tile[]) {
  return tiles.reduce((n, t) => n + t.a + t.b, 0);
}

function orientedForEnd(tile: Tile, end: number, side: "left" | "right"): Tile {
  if (side === "right") return tile.a === end ? tile : { a: tile.b, b: tile.a };
  return tile.b === end ? tile : { a: tile.b, b: tile.a };
}

function hitZone(z: DropZone | null, x: number, y: number) {
  return Boolean(z && x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
}

/**
 * Centered single-row chain. Mild shrink as the chain grows; doubles sit crosswise.
 * Returns slots plus left/right drop zones flanking the row.
 */
function layoutCenteredChain(
  chain: Tile[],
  areaX: number,
  areaY: number,
  areaW: number,
  areaH: number,
): { slots: ChainSlot[]; leftDrop: DropZone; rightDrop: DropZone; long: number } {
  const pad = 6;
  const innerW = Math.max(40, areaW - pad * 2 - DROP_W * 2 - 8);
  const n = Math.max(1, chain.length);
  let units = 0;
  for (const t of chain) units += isDouble(t) ? 0.5 : 1;
  if (!chain.length) units = 1;
  const gaps = Math.max(0, chain.length - 1) * TILE_GAP;
  const long = Math.min(TILE_LONG_MAX, Math.max(TILE_LONG_MIN, (innerW - gaps) / Math.max(units, 1)));
  const short = long * 0.5;

  let totalW = 0;
  for (let i = 0; i < chain.length; i++) {
    totalW += (isDouble(chain[i]) ? short : long) + (i > 0 ? TILE_GAP : 0);
  }
  const cy = areaY + areaH / 2;
  let x = areaX + (areaW - totalW) / 2;
  const slots: ChainSlot[] = [];
  for (const tile of chain) {
    const dbl = isDouble(tile);
    const w = dbl ? short : long;
    const h = dbl ? long : short;
    slots.push({ tile, x, y: cy - h / 2, w, h, lying: !dbl });
    x += w + TILE_GAP;
  }

  const rowLeft = slots.length ? slots[0].x : areaX + areaW / 2 - long / 2;
  const rowRight = slots.length ? slots[slots.length - 1].x + slots[slots.length - 1].w : areaX + areaW / 2 + long / 2;
  const dropY = cy - DROP_H / 2;
  const leftDrop: DropZone = {
    x: Math.max(areaX + 2, rowLeft - DROP_W - 6),
    y: dropY,
    w: DROP_W,
    h: DROP_H,
    side: "left",
  };
  const rightDrop: DropZone = {
    x: Math.min(areaX + areaW - DROP_W - 2, rowRight + 6),
    y: dropY,
    w: DROP_W,
    h: DROP_H,
    side: "right",
  };
  return { slots, leftDrop, rightDrop, long };
}

export function createDominoEngine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let winCb: (() => void) | null = null;
  let loseCb: (() => void) | null = null;
  let running = false;
  let raf = 0;
  let ended = false;
  let config: DominoConfig = {
    failEnabled: true,
    hintHandEnabled: true,
    hintDelayMs: 2500,
    coinImageUrl: "",
    hudTransparent: false,
    rounds: [],
  };
  let playAllRounds = true;
  let roundIndex = 0;
  let earned = 0;
  let lastInputAt = 0;
  let background: Background | undefined;
  let orientation: Orientation = "portrait";
  let hintHandUrl = "";
  let hintHandVisible = true;
  let bgImage: HTMLImageElement | null = null;
  let handImage: HTMLImageElement | null = null;
  let coinImage: HTMLImageElement | null = null;
  const imgs = new Map<string, HTMLImageElement | null>();
  let assets: Record<string, string> = {};
  let loadToken = 0;
  let viewW = 1;
  let viewH = 1;

  let playerHand: Tile[] = [];
  let cpuHand: Tile[] = [];
  let boneyard: Tile[] = [];
  let chain: Tile[] = [];
  let left = 0;
  let right = 0;
  let selected = -1;
  let turn: Turn = "player";
  let status = "";
  let cpuTimer = 0;
  let handLayout: { x: number; y: number; w: number; h: number }[] = [];
  let drawBtn: { x: number; y: number; w: number; h: number } | null = null;
  let leftDrop: DropZone | null = null;
  let rightDrop: DropZone | null = null;

  function rounds() {
    return listDominoRounds(config);
  }
  function current() {
    const list = rounds();
    return list[Math.max(0, Math.min(roundIndex, list.length - 1))] ?? list[0];
  }

  function clearCpuTimer() {
    if (cpuTimer) {
      window.clearTimeout(cpuTimer);
      cpuTimer = 0;
    }
  }

  function deal() {
    clearCpuTimer();
    const round = current();
    const tiles = pack();
    const starter = tiles.pop()!;
    chain = [starter];
    left = starter.a;
    right = starter.b;
    const handSize = round.handSize;
    playerHand = tiles.splice(0, handSize);
    cpuHand = tiles.splice(0, handSize);
    boneyard = tiles;
    selected = -1;
    ended = false;
    turn = "player";
    status = "Your turn — select a tile";
    lastInputAt = performance.now();
    if (playableIn(playerHand).length === 0 && boneyard.length === 0) settleBlocked();
    else if (playableIn(playerHand).length === 0) status = "Draw until you can play";
  }

  function playableIn(hand: Tile[]) {
    return hand
      .map((tile, i) => ({ tile, i }))
      .filter(({ tile }) => matches(tile, left) || matches(tile, right));
  }

  function place(tile: Tile, prefer: "left" | "right" | "auto" = "auto") {
    const canL = matches(tile, left);
    const canR = matches(tile, right);
    if (!canL && !canR) return false;
    let side: "left" | "right";
    if (prefer === "left") {
      if (!canL) return false;
      side = "left";
    } else if (prefer === "right") {
      if (!canR) return false;
      side = "right";
    } else if (canL && canR) side = "right";
    else side = canR ? "right" : "left";
    if (side === "right") {
      chain.push(orientedForEnd(tile, right, "right"));
      right = chain[chain.length - 1].b;
    } else {
      chain.unshift(orientedForEnd(tile, left, "left"));
      left = chain[0].a;
    }
    return true;
  }

  function scoreWin() {
    const pips = pipSum(cpuHand);
    earned += pips > 0 ? pips : current().coins;
  }

  function completeRound(won: boolean) {
    if (ended) return;
    clearCpuTimer();
    ended = true;
    if (won) {
      scoreWin();
      const list = rounds();
      if (playAllRounds && roundIndex < list.length - 1) {
        roundIndex += 1;
        deal();
        return;
      }
      winCb?.();
      return;
    }
    if (config.failEnabled) loseCb?.();
    else {
      const list = rounds();
      if (playAllRounds && roundIndex < list.length - 1) {
        roundIndex += 1;
        deal();
      } else winCb?.();
    }
  }

  function settleBlocked() {
    const p = pipSum(playerHand);
    const c = pipSum(cpuHand);
    status = p <= c ? "Blocked — you win" : "Blocked — CPU wins";
    completeRound(p <= c);
  }

  function bothBlocked() {
    return (
      playableIn(playerHand).length === 0 &&
      playableIn(cpuHand).length === 0 &&
      boneyard.length === 0
    );
  }

  function givePlayerTurn() {
    turn = "player";
    selected = -1;
    lastInputAt = performance.now();
    if (bothBlocked()) {
      settleBlocked();
      return;
    }
    if (playableIn(playerHand).length === 0 && boneyard.length === 0) {
      status = "No moves — passed";
      turn = "cpu";
      scheduleCpu();
      return;
    }
    status = playableIn(playerHand).length === 0 ? "Draw until you can play" : "Your turn — select a tile";
  }

  function scheduleCpu() {
    clearCpuTimer();
    if (ended || turn !== "cpu") return;
    status = "CPU thinking…";
    cpuTimer = window.setTimeout(() => {
      cpuTimer = 0;
      runCpuTurn();
    }, CPU_THINK_MS);
  }

  function runCpuTurn() {
    if (ended || turn !== "cpu") return;
    const moves = playableIn(cpuHand);
    if (moves.length) {
      moves.sort((x, y) => {
        const xd = isDouble(x.tile) ? 1 : 0;
        const yd = isDouble(y.tile) ? 1 : 0;
        if (yd !== xd) return yd - xd;
        return y.tile.a + y.tile.b - (x.tile.a + x.tile.b);
      });
      const pick = moves[0];
      place(pick.tile, "auto");
      cpuHand.splice(pick.i, 1);
      status = `CPU played ${pick.tile.a}|${pick.tile.b}`;
      if (!cpuHand.length) {
        completeRound(false);
        return;
      }
      givePlayerTurn();
      return;
    }
    if (boneyard.length) {
      let drew = 0;
      while (boneyard.length && playableIn(cpuHand).length === 0) {
        cpuHand.push(boneyard.pop()!);
        drew += 1;
      }
      status = drew === 1 ? "CPU drew" : `CPU drew ${drew}`;
      if (playableIn(cpuHand).length > 0) {
        scheduleCpu();
        return;
      }
    }
    status = "CPU passed";
    givePlayerTurn();
  }

  function endPlayerAction() {
    selected = -1;
    if (!playerHand.length) {
      completeRound(true);
      return;
    }
    if (bothBlocked()) {
      settleBlocked();
      return;
    }
    turn = "cpu";
    scheduleCpu();
  }

  function drawForPlayer() {
    if (ended || turn !== "player" || !boneyard.length) return false;
    if (playableIn(playerHand).length > 0) return false;
    let drew = 0;
    while (boneyard.length && playableIn(playerHand).length === 0) {
      playerHand.push(boneyard.pop()!);
      drew += 1;
    }
    selected = -1;
    if (playableIn(playerHand).length > 0) {
      status = drew === 1 ? "Drew a playable tile — select it" : `Drew ${drew} — select a tile`;
      return true;
    }
    status = "Boneyard empty — passed";
    endPlayerAction();
    return true;
  }

  function tryPlaceSelected(side: "left" | "right") {
    if (selected < 0 || selected >= playerHand.length) return false;
    const tile = playerHand[selected];
    if (!place(tile, side)) {
      status = side === "left" ? "Can't play on Left" : "Can't play on Right";
      return false;
    }
    playerHand.splice(selected, 1);
    selected = -1;
    endPlayerAction();
    return true;
  }

  function posFromEvent(e: PointerEvent) {
    return pointerCanvasPos(e, canvas!, viewW, viewH);
  }

  function onPointer(e: PointerEvent) {
    if (!running || ended || !canvas || turn !== "player") return;
    e.preventDefault();
    e.stopPropagation();
    lastInputAt = performance.now();
    const { x, y } = posFromEvent(e);

    if (drawBtn && x >= drawBtn.x && x <= drawBtn.x + drawBtn.w && y >= drawBtn.y && y <= drawBtn.y + drawBtn.h) {
      drawForPlayer();
      return;
    }

    // Second tap: place on Left / Right when a tile is selected.
    if (selected >= 0) {
      if (hitZone(leftDrop, x, y)) {
        tryPlaceSelected("left");
        return;
      }
      if (hitZone(rightDrop, x, y)) {
        tryPlaceSelected("right");
        return;
      }
    }

    const i = handLayout.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (i < 0) {
      if (playableIn(playerHand).length === 0 && boneyard.length) drawForPlayer();
      else if (selected >= 0) status = "Tap Left or Right to place";
      return;
    }

    const tile = playerHand[i];
    const canL = matches(tile, left);
    const canR = matches(tile, right);
    if (!canL && !canR) {
      status = "Doesn't match either end";
      return;
    }
    if (selected === i) {
      selected = -1;
      status = "Your turn — select a tile";
      return;
    }
    selected = i;
    if (canL && canR) status = "Tap Left or Right to place";
    else if (canL) status = "Tap Left to place";
    else status = "Tap Right to place";
  }

  function drawTile(tile: Tile, x: number, y: number, w: number, h: number, lying = false, hl = false) {
    if (!ctx) return;
    const url = dominoUrl(tile.a, tile.b);
    const img = imgs.get(url);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (lying) ctx.rotate(Math.PI / 2);
    const dw = lying ? h : w;
    const dh = lying ? w : h;
    if (hl) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.strokeRect(-dw / 2 - 2, -dh / 2 - 2, dw + 4, dh + 4);
    }
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    else {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      ctx.fillStyle = "#0f172a";
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${tile.a}|${tile.b}`, 0, 4);
    }
    ctx.restore();
  }

  function drawBack(x: number, y: number, w: number, h: number) {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = "#1e3a5f";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(248,250,252,0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = "rgba(148,163,184,0.35)";
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.restore();
  }

  function drawDropZone(z: DropZone, pip: number, active: boolean) {
    if (!ctx) return;
    ctx.save();
    if (active) {
      ctx.fillStyle = "rgba(251, 191, 36, 0.28)";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.5;
    } else {
      ctx.fillStyle = "rgba(148, 163, 184, 0.12)";
      ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
      ctx.lineWidth = 1.5;
    }
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeRect(z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1);
    ctx.fillStyle = active ? "#fde68a" : "#94a3b8";
    ctx.font = "700 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(z.side === "left" ? "Left" : "Right", z.x + z.w / 2, z.y + z.h / 2 - 8);
    ctx.font = "700 16px system-ui";
    ctx.fillStyle = active ? "#fff" : "#cbd5e1";
    ctx.fillText(String(pip), z.x + z.w / 2, z.y + z.h / 2 + 10);
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  function draw() {
    if (!canvas || !ctx || !container) return;
    const { w, h } = beginCanvasFrame(canvas, ctx, container);
    viewW = w;
    viewH = h;
    drawCanvasBackground(ctx, w, h, background, bgImage);
    const list = rounds();
    drawCanvasHud(ctx, {
      w,
      roundText: `R${Math.min(roundIndex + 1, list.length)}/${list.length}`,
      coinsText: `${earned}`,
      extraText: `You ${playerHand.length} · CPU ${cpuHand.length}`,
      coinImage,
      transparent: config.hudTransparent,
    });

    const cpuTw = Math.min(26, (w - 20) / Math.max(cpuHand.length, 1) - 4);
    const cpuTh = cpuTw * 1.7;
    const cpuY = CANVAS_HUD_H + 8;
    cpuHand.forEach((_, i) => {
      const cx = (w - cpuHand.length * (cpuTw + 4) + 4) / 2 + i * (cpuTw + 4);
      drawBack(cx, cpuY, cpuTw, cpuTh);
    });
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`CPU · ${cpuHand.length}`, w / 2, cpuY + cpuTh + 12);

    const hw = Math.min(44, (w - 16) / Math.max(playerHand.length, 1) - 6);
    const hh = hw * 2;
    const hy = h - hh - 18;
    const chainTop = cpuY + cpuTh + 20;
    const chainBottom = hy - 48;
    const laid = layoutCenteredChain(chain, 2, chainTop, w - 4, Math.max(90, chainBottom - chainTop));
    leftDrop = laid.leftDrop;
    rightDrop = laid.rightDrop;
    for (const s of laid.slots) {
      drawTile(s.tile, s.x, s.y, s.w, s.h, s.lying);
    }

    const selTile = selected >= 0 ? playerHand[selected] : null;
    const canSelL = Boolean(selTile && matches(selTile, left));
    const canSelR = Boolean(selTile && matches(selTile, right));
    drawDropZone(laid.leftDrop, left, turn === "player" && selected >= 0 && canSelL);
    drawDropZone(laid.rightDrop, right, turn === "player" && selected >= 0 && canSelR);

    handLayout = [];
    const playable = new Set(playableIn(playerHand).map((m) => m.i));
    playerHand.forEach((tile, i) => {
      const hx = 8 + i * (hw + 6);
      handLayout.push({ x: hx, y: hy, w: hw, h: hh });
      drawTile(tile, hx, hy, hw, hh, false, selected === i || (turn === "player" && selected < 0 && playable.has(i)));
    });

    drawBtn = null;
    const canDraw = turn === "player" && !ended && playableIn(playerHand).length === 0 && boneyard.length > 0;
    if (canDraw) {
      const bw = 168;
      const bh = 30;
      drawBtn = { x: w / 2 - bw / 2, y: hy - 42, w: bw, h: bh };
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(drawBtn.x, drawBtn.y, bw, bh);
      ctx.fillStyle = "#111827";
      ctx.font = "700 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`Draw until playable (${boneyard.length})`, w / 2, drawBtn.y + bh / 2);
      ctx.textBaseline = "alphabetic";
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`Boneyard ${boneyard.length}`, 10, hy - 12);
    }

    ctx.fillStyle = turn === "cpu" ? "#fbbf24" : "#e2e8f0";
    ctx.font = "700 12px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(status, w - 10, hy - 12);

    const now = performance.now();
    if (
      turn === "player" &&
      !ended &&
      config.hintHandEnabled &&
      hintHandVisible &&
      now - lastInputAt >= config.hintDelayMs
    ) {
      if (selected >= 0) {
        const zone = canSelL ? laid.leftDrop : canSelR ? laid.rightDrop : null;
        if (zone) drawHintHand(ctx, handImage, zone.x + zone.w / 2, zone.y + zone.h / 2, 36, now);
      } else {
        const moves = playableIn(playerHand);
        if (moves.length && handLayout[moves[0].i]) {
          const b = handLayout[moves[0].i];
          drawHintHand(ctx, handImage, b.x + b.w / 2, b.y + 8, hw, now);
        } else if (canDraw && drawBtn) {
          drawHintHand(ctx, handImage, drawBtn.x + drawBtn.w / 2, drawBtn.y + drawBtn.h / 2, 40, now);
        }
      }
    }
  }

  function loop() {
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function mediaUrl(ref: string) {
    return resolveRuntimeUrl(ref, assets) || (Object.keys(assets).length === 0 ? ref : "");
  }

  async function load(extra: Extra) {
    if (extra.background) background = extra.background;
    if (extra.orientation) orientation = extra.orientation;
    const token = ++loadToken;
    const bgUrl = canvasBgUrl(background, orientation);
    const jobs = [0, 1, 2, 3, 4, 5, 6].flatMap((a) =>
      [0, 1, 2, 3, 4, 5, 6].filter((b) => b >= a).map(async (b) => {
        const url = dominoUrl(a, b);
        imgs.set(url, await loadImage(mediaUrl(url)));
      }),
    );
    const [bg, handImg, coin] = await Promise.all([
      background?.type === "image" && bgUrl ? loadImage(mediaUrl(bgUrl)) : Promise.resolve(null),
      hintHandUrl ? loadImage(mediaUrl(hintHandUrl)) : Promise.resolve(null),
      config.coinImageUrl ? loadImage(mediaUrl(config.coinImageUrl)) : Promise.resolve(null),
      ...jobs,
    ]);
    if (token !== loadToken) return;
    bgImage = bg;
    handImage = handImg;
    coinImage = coin;
  }

  return {
    id: "domino",
    name: "Domino",
    initialize(ctxInit: EngineInitContext) {
      const extra = ctxInit as EngineInitContext & Extra;
      container = ctxInit.container;
      const attached = attachPlayableCanvas(ctxInit.container);
      canvas = attached.canvas;
      ctx = attached.ctx;
      orientation = ctxInit.orientation;
      assets = ctxInit.assets || {};
      if (extra.domino) config = extra.domino;
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      hintHandUrl = extra.hintHandUrl || "";
      hintHandVisible = extra.hintHandVisible !== false;
      background = extra.background;
      deal();
      void load(extra).then(() => draw());
      canvas.addEventListener("pointerdown", onPointer);
    },
    setOptions(options) {
      const extra = options as Extra;
      if (extra.domino) config = extra.domino;
      if (typeof extra.playAllRounds === "boolean") playAllRounds = extra.playAllRounds;
      if (typeof extra.parkingRoundIndex === "number" && extra.parkingRoundIndex !== roundIndex) {
        roundIndex = extra.parkingRoundIndex;
        deal();
      }
      if (typeof extra.hintHandUrl === "string") hintHandUrl = extra.hintHandUrl;
      if (typeof extra.hintHandVisible === "boolean") hintHandVisible = extra.hintHandVisible;
      void load(extra).then(() => draw());
    },
    start() {
      running = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    reset() {
      earned = 0;
      roundIndex = playAllRounds ? 0 : roundIndex;
      deal();
    },
    destroy() {
      running = false;
      clearCpuTimer();
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("pointerdown", onPointer);
      container = null;
      canvas = null;
      ctx = null;
      imgs.clear();
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
