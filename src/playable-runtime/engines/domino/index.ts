import type { Background, Orientation, DominoConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame, pointerCanvasPos } from "@/playable-runtime/engines/canvas-setup";
import { CANVAS_HUD_H, drawCanvasHud } from "@/playable-runtime/engines/canvas-hud";
import { drawHintHand } from "@/playable-runtime/engines/hint-hand";
import { dominoUrl } from "@/playable-runtime/engines/kenney-2d-assets";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";
import { listDominoRounds } from "@/playable-runtime/engines/domino/rounds";
import { createPayoutHud } from "@/playable-runtime/engines/parking-jam/payout";
import type { AudioBus } from "@/playable-runtime/audio/bus";
import { PLAYABLE_SOUNDS } from "@/playable-runtime/audio/defaults";

type Tile = { a: number; b: number };
type Turn = "player" | "cpu";
type Face = "left" | "right" | "up" | "down";
type ChainSlot = {
  tile: Tile;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  /** Direction pip `a` points. On a single starter this is the left open end. */
  aFace: Face;
};

type Extra = {
  background?: Background;
  orientation?: Orientation;
  domino?: DominoConfig;
  playAllRounds?: boolean;
  parkingRoundIndex?: number;
  hintHandUrl?: string;
  hintHandVisible?: boolean;
  audioBus?: AudioBus;
};

const CPU_THINK_MS = 2000;
const CPU_REVEAL_MS = 2000;
const PLACE_MS = 360;
const REFILL_MS = 280;
const DEFAULT_YOUR_TURN = "Your turn — select a tile";
const DEFAULT_PASS = "Turn passed";
const TILE_LONG_MAX = 48;
const TILE_LONG_MIN = 30;
const TILE_GAP = 3;

const FACE_ANGLE: Record<Face, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

function pack(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push({ a, b });
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

function isBlank(tile: Tile) {
  return tile.a === 0 && tile.b === 0;
}

function matches(tile: Tile, pip: number) {
  return isBlank(tile) || tile.a === pip || tile.b === pip;
}

function isDouble(tile: Tile) {
  return tile.a === tile.b;
}


function orientedForEnd(tile: Tile, end: number, side: "left" | "right"): Tile {
  if (isBlank(tile)) return { a: 0, b: 0 };
  if (side === "right") return tile.a === end ? tile : { a: tile.b, b: tile.a };
  return tile.b === end ? tile : { a: tile.b, b: tile.a };
}

function opposite(face: Face): Face {
  if (face === "left") return "right";
  if (face === "right") return "left";
  if (face === "up") return "down";
  return "up";
}

/**
 * Kenney `tile_lo_hi` is vertical with the lower pip on top.
 * `aFace` is the direction pip `a` should point after rotation.
 * Doubles sit crosswise: vertical on a horizontal run, horizontal on a downward turn.
 */
function spriteRotation(tile: Tile, aFace: Face) {
  if (isDouble(tile)) return aFace === "up" || aFace === "down" ? Math.PI / 2 : 0;
  const lo = Math.min(tile.a, tile.b);
  const faceAngle = FACE_ANGLE[aFace];
  return tile.a === lo ? faceAngle : faceAngle + Math.PI;
}

function tileSize(tile: Tile, aFace: Face, long: number) {
  const short = long * 0.5;
  const pipAxisHorizontal = aFace === "left" || aFace === "right";
  const wide = isDouble(tile) ? !pipAxisHorizontal : pipAxisHorizontal;
  return {
    w: wide ? long : short,
    h: wide ? short : long,
    rot: spriteRotation(tile, aFace),
  };
}

function slotBounds(slots: ChainSlot[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of slots) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.w);
    maxY = Math.max(maxY, s.y + s.h);
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Snake inside a width. The first row runs right. A tile that would leave the
 * row turns down off the outer end, then the next row runs the other way.
 * Coordinates are uncentered and may start above y=0 when a double is crosswise.
 */
function layoutSnakePass(chain: Tile[], areaW: number, long: number): ChainSlot[] {
  if (!chain.length) return [];
  const short = long * 0.5;
  const slots: ChainSlot[] = [];
  let dir: 1 | -1 = 1;
  let cursor = 0;
  let rowTop = 0;

  for (let i = 0; i < chain.length; i++) {
    const tile = chain[i];
    let aFace: Face = dir === 1 ? "left" : "right";
    let size = tileSize(tile, aFace, long);
    const fits = dir === 1 ? cursor + size.w <= areaW + 0.01 : cursor - size.w >= -0.01;
    const prev = slots[slots.length - 1];
    const prevIsCorner = Boolean(prev && (prev.aFace === "up" || prev.aFace === "down"));

    if (!fits && prev && i > 0 && !prevIsCorner) {
      aFace = "up";
      size = tileSize(tile, aFace, long);
      let x = dir === 1 ? prev.x + prev.w - size.w : prev.x;
      x = Math.max(0, Math.min(x, areaW - size.w));
      const y = prev.y + prev.h + TILE_GAP;
      slots.push({ tile, x, y, w: size.w, h: size.h, rot: size.rot, aFace });
      dir = dir === 1 ? -1 : 1;
      rowTop = y + size.h - short;
      cursor = dir === 1 ? x + size.w + TILE_GAP : x - TILE_GAP;
      continue;
    }

    const y = rowTop + short / 2 - size.h / 2;
    const rawX = dir === 1 ? cursor : cursor - size.w;
    const x = Math.max(0, Math.min(rawX, Math.max(0, areaW - size.w)));
    slots.push({ tile, x, y, w: size.w, h: size.h, rot: size.rot, aFace });
    cursor = dir === 1 ? x + size.w + TILE_GAP : x - TILE_GAP;
  }
  return slots;
}

/** Centered snake. Shrinks until the chain fits the play area height. */
function layoutSnake(chain: Tile[], areaX: number, areaY: number, areaW: number, areaH: number): ChainSlot[] {
  if (!chain.length) return [];
  const pad = 4;
  const innerW = Math.max(TILE_LONG_MIN, areaW - pad * 2);
  let slots = layoutSnakePass(chain, innerW, TILE_LONG_MIN);
  for (let long = TILE_LONG_MAX; long >= TILE_LONG_MIN; long -= 2) {
    const laid = layoutSnakePass(chain, innerW, long);
    const box = slotBounds(laid);
    slots = laid;
    if (box.h <= areaH) break;
  }
  const box = slotBounds(slots);
  const dx = areaX + (areaW - box.w) / 2 - box.minX;
  const dy = areaY + Math.max(0, (areaH - box.h) / 2) - box.minY;
  return slots.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
}

function pointIn(x: number, y: number, r: { x: number; y: number; w: number; h: number }) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function halfRect(slot: ChainSlot, face: Face) {
  const { x, y, w, h } = slot;
  if (face === "left") return { x, y, w: w / 2, h };
  if (face === "right") return { x: x + w / 2, y, w: w / 2, h };
  if (face === "up") return { x, y, w, h: h / 2 };
  return { x, y: y + h / 2, w, h: h / 2 };
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
    yourTurnMessage: DEFAULT_YOUR_TURN,
    passMessage: DEFAULT_PASS,
    turnSpeed: 1,
    rounds: [],
  };
  let holding = false;
  let paying = false;
  let sfx: AudioBus | null = null;
  const hud = createPayoutHud();
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
  let chainSlots: ChainSlot[] = [];
  let intake: { index: number; t0: number; onDone: () => void } | null = null;
  let flight: {
    index: number;
    fromX: number;
    fromY: number;
    fromW: number;
    fromH: number;
    /** 0 starts face-down (opponent). 1 is already face-up (player). */
    face: number;
    t0: number;
    onDone: () => void;
  } | null = null;

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
    holding = false;
  }

  function yourTurnText() {
    const text = config.yourTurnMessage?.trim();
    return text || DEFAULT_YOUR_TURN;
  }

  function passText() {
    const text = config.passMessage?.trim();
    return text || DEFAULT_PASS;
  }

  function paceMs(base: number) {
    const speed = config.turnSpeed > 0 ? config.turnSpeed : 1;
    return Math.round(base / speed);
  }

  function coinTotal() {
    return rounds().reduce((sum, round) => sum + round.coins, 0);
  }

  function syncHud() {
    const url = resolveRuntimeUrl(config.coinImageUrl || "/demo-assets/coin.svg", assets);
    hud.setCoinUrl(url || "/demo-assets/coin.svg");
    hud.setState(earned, coinTotal());
  }

  function wireSfx() {
    if (!sfx) return;
    const pick = (url: string) => resolveRuntimeUrl(url, assets) || url;
    sfx.setExtraUrls({
      payout: pick(PLAYABLE_SOUNDS.payout),
      refill: pick(PLAYABLE_SOUNDS.dominoRefill),
      place: pick(PLAYABLE_SOUNDS.dominoPlace),
      turn: pick(PLAYABLE_SOUNDS.dominoTurn),
    });
  }

  function playCue(id: string) {
    void sfx?.unlock();
    sfx?.playSfx(id);
  }

  function holdThen(fn: () => void) {
    clearCpuTimer();
    holding = true;
    cpuTimer = window.setTimeout(() => {
      cpuTimer = 0;
      holding = false;
      fn();
    }, paceMs(CPU_REVEAL_MS));
  }

  function deal() {
    hud.cancel();
    paying = false;
    flight = null;
    intake = null;
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
    status = yourTurnText();
    lastInputAt = performance.now();
    if (playableIn(playerHand).length === 0) refillPlayer();
    else playCue("turn");
  }

  function playableIn(hand: Tile[]) {
    return hand
      .map((tile, i) => ({ tile, i }))
      .filter(({ tile }) => matches(tile, left) || matches(tile, right));
  }

  function easeOut(t: number) {
    const x = Math.min(1, Math.max(0, t));
    return 1 - (1 - x) ** 3;
  }

  function lerpAngle(a: number, b: number, t: number) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function cpuBackRect(index: number, count: number) {
    const cpuMax = turn === "cpu" ? 42 : 26;
    const tw = Math.min(cpuMax, (viewW - 20) / Math.max(count, 1) - 4);
    const th = tw * 1.7;
    const y = CANVAS_HUD_H + 8;
    const x = (viewW - count * (tw + 4) + 4) / 2 + index * (tw + 4);
    return { x, y, w: tw, h: th };
  }

  function beginFlight(
    index: number,
    from: { x: number; y: number; w: number; h: number },
    face: number,
    onDone: () => void,
  ) {
    flight = {
      index,
      fromX: from.x,
      fromY: from.y,
      fromW: from.w,
      fromH: from.h,
      face,
      t0: performance.now(),
      onDone,
    };
    playCue("place");
  }

  function tickFlight() {
    if (!flight) return;
    if (performance.now() - flight.t0 < PLACE_MS) return;
    const done = flight.onDone;
    flight = null;
    done();
  }

  function place(tile: Tile, prefer: "left" | "right" | "auto" = "auto"): "left" | "right" | null {
    const canL = matches(tile, left);
    const canR = matches(tile, right);
    if (!canL && !canR) return null;
    let side: "left" | "right";
    if (prefer === "left") {
      if (!canL) return null;
      side = "left";
    } else if (prefer === "right") {
      if (!canR) return null;
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
    return side;
  }

  function completeRound(won: boolean) {
    if (ended || paying) return;
    clearCpuTimer();
    if (won) {
      paying = true;
      ended = true;
      const reward = current().coins;
      const from = earned;
      earned += reward;
      const list = rounds();
      const hasNext = playAllRounds && roundIndex < list.length - 1;
      syncHud();
      playCue("payout");
      hud.startPayout({
        from,
        to: earned,
        reward,
        nextRound: hasNext ? roundIndex + 2 : null,
        onDone: () => {
          paying = false;
          if (hasNext) {
            roundIndex += 1;
            deal();
            return;
          }
          winCb?.();
        },
      });
      return;
    }
    ended = true;
    if (config.failEnabled) loseCb?.();
    else {
      const list = rounds();
      if (playAllRounds && roundIndex < list.length - 1) {
        roundIndex += 1;
        deal();
      } else winCb?.();
    }
  }

  function advanceWithoutScore() {
    if (ended) return;
    clearCpuTimer();
    ended = true;
    const list = rounds();
    if (playAllRounds && roundIndex < list.length - 1) {
      roundIndex += 1;
      deal();
      return;
    }
    winCb?.();
  }

  function settleByTileCount() {
    if (ended) return;
    const playerTiles = playerHand.length;
    const cpuTiles = cpuHand.length;
    if (playerTiles < cpuTiles) {
      turn = "player";
      status = "You win";
      completeRound(true);
      return;
    }
    if (cpuTiles < playerTiles) {
      status = "Opponent wins";
      completeRound(false);
      return;
    }
    status = "Tie";
    advanceWithoutScore();
  }

  function givePlayerTurn() {
    turn = "player";
    selected = -1;
    lastInputAt = performance.now();
    if (playableIn(playerHand).length === 0) {
      refillPlayer();
      return;
    }
    status = yourTurnText();
    playCue("turn");
  }

  function refillPlayer() {
    if (ended || turn !== "player" || intake) return;
    if (playableIn(playerHand).length > 0) {
      status = yourTurnText();
      return;
    }
    if (!boneyard.length) {
      status = passText();
      holdThen(() => settleByTileCount());
      return;
    }
    status = "";
    playCue("refill");
    pullOne();
  }

  function pullOne() {
    if (playableIn(playerHand).length > 0 || !boneyard.length) {
      if (playableIn(playerHand).length > 0) {
        status = yourTurnText();
        playCue("turn");
      }
      else {
        status = passText();
        holdThen(() => settleByTileCount());
      }
      return;
    }
    playerHand.push(boneyard.pop()!);
    intake = {
      index: playerHand.length - 1,
      t0: performance.now(),
      onDone: () => pullOne(),
    };
  }

  function tickIntake() {
    if (!intake) return;
    if (performance.now() - intake.t0 < REFILL_MS) return;
    const done = intake.onDone;
    intake = null;
    done();
  }

  function scheduleCpu() {
    clearCpuTimer();
    if (ended || turn !== "cpu") return;
    status = "CPU thinking…";
    cpuTimer = window.setTimeout(() => {
      cpuTimer = 0;
      runCpuTurn();
    }, paceMs(CPU_THINK_MS));
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
      const from = cpuBackRect(pick.i, cpuHand.length);
      const side = place(pick.tile, "auto");
      if (!side) return;
      cpuHand.splice(pick.i, 1);
      status = `Opponent played ${pick.tile.a}|${pick.tile.b}`;
      beginFlight(side === "left" ? 0 : chain.length - 1, from, 0, () => {
        if (!cpuHand.length) settleByTileCount();
        else givePlayerTurn();
      });
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
    status = passText();
    holdThen(() => settleByTileCount());
  }

  function endPlayerAction() {
    selected = -1;
    if (!playerHand.length) {
      settleByTileCount();
      return;
    }
    turn = "cpu";
    scheduleCpu();
  }

  function tryPlaceSelected(side: "left" | "right") {
    if (selected < 0 || selected >= playerHand.length) return false;
    const tile = playerHand[selected];
    const from = handLayout[selected] ?? { x: viewW / 2 - 22, y: viewH - 100, w: 44, h: 88 };
    const placed = place(tile, side);
    if (!placed) {
      status = "Can't play there";
      return false;
    }
    playerHand.splice(selected, 1);
    selected = -1;
    status = "";
    beginFlight(placed === "left" ? 0 : chain.length - 1, from, 1, () => endPlayerAction());
    return true;
  }

  function endTarget(side: "left" | "right", can: boolean) {
    if (!can || !chainSlots.length) return null;
    if (chainSlots.length === 1) {
      const slot = chainSlots[0];
      return halfRect(slot, side === "left" ? slot.aFace : opposite(slot.aFace));
    }
    return side === "left" ? chainSlots[0] : chainSlots[chainSlots.length - 1];
  }

  function posFromEvent(e: PointerEvent) {
    return pointerCanvasPos(e, canvas!, viewW, viewH);
  }

  function onPointer(e: PointerEvent) {
    void sfx?.unlock();
    if (!running || ended || holding || paying || flight || intake || !canvas || turn !== "player") return;
    e.preventDefault();
    e.stopPropagation();
    lastInputAt = performance.now();
    const { x, y } = posFromEvent(e);

    const sel = selected >= 0 ? playerHand[selected] : null;
    const canL = Boolean(sel && matches(sel, left));
    const canR = Boolean(sel && matches(sel, right));
    if (selected >= 0) {
      const rightEnd = endTarget("right", canR);
      const leftEnd = endTarget("left", canL);
      if (rightEnd && pointIn(x, y, rightEnd)) {
        tryPlaceSelected("right");
        return;
      }
      if (leftEnd && pointIn(x, y, leftEnd)) {
        tryPlaceSelected("left");
        return;
      }
    }

    const i = handLayout.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (i < 0) {
      if (selected >= 0) status = "Tap the highlighted domino";
      return;
    }

    const tile = playerHand[i];
    const tileL = matches(tile, left);
    const tileR = matches(tile, right);
    if (!tileL && !tileR) {
      status = "Doesn't match either end";
      return;
    }
    if (selected === i) {
      selected = -1;
      status = yourTurnText();
      return;
    }
    selected = i;
    status = "Tap the highlighted domino";
  }

  function drawTile(tile: Tile, x: number, y: number, w: number, h: number, rot = 0, hl = false) {
    if (!ctx) return;
    const url = dominoUrl(tile.a, tile.b);
    const img = imgs.get(url);
    const nativeW = Math.min(w, h);
    const nativeH = Math.max(w, h);
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rot);
    if (hl) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.strokeRect(-nativeW / 2 - 2, -nativeH / 2 - 2, nativeW + 4, nativeH + 4);
    }
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -nativeW / 2, -nativeH / 2, nativeW, nativeH);
    else {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-nativeW / 2, -nativeH / 2, nativeW, nativeH);
      ctx.fillStyle = "#0f172a";
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${tile.a}|${tile.b}`, 0, 4);
    }
    ctx.restore();
  }

  function highlightRect(r: { x: number; y: number; w: number; h: number }) {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = "rgba(251, 191, 36, 0.35)";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
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

  function drawFlightTile(slot: ChainSlot) {
    if (!flight || !ctx) return;
    const e = easeOut((performance.now() - flight.t0) / PLACE_MS);
    const fromLong = Math.max(flight.fromW, flight.fromH);
    const toLong = Math.max(slot.w, slot.h);
    const long = fromLong + (toLong - fromLong) * e;
    const short = long * 0.5;
    const cx = flight.fromX + flight.fromW / 2 + (slot.x + slot.w / 2 - (flight.fromX + flight.fromW / 2)) * e;
    const cy = flight.fromY + flight.fromH / 2 + (slot.y + slot.h / 2 - (flight.fromY + flight.fromH / 2)) * e;
    const x = cx - short / 2;
    const y = cy - long / 2;
    const face = flight.face + (1 - flight.face) * e;
    if (face < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - face;
      drawBack(x, y, short, long);
      ctx.restore();
    }
    if (face > 0) {
      ctx.save();
      ctx.globalAlpha = face;
      drawTile(slot.tile, x, y, short, long, lerpAngle(0, slot.rot, e));
      ctx.restore();
    }
  }

  function draw() {
    if (!canvas || !ctx || !container) return;
    tickFlight();
    tickIntake();
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
      hideCoin: true,
    });

    const cpuMax = turn === "cpu" ? 42 : 26;
    const cpuTw = Math.min(cpuMax, (w - 20) / Math.max(cpuHand.length, 1) - 4);
    const cpuTh = cpuTw * 1.7;
    const cpuY = CANVAS_HUD_H + 8;
    cpuHand.forEach((_, i) => {
      const cx = (w - cpuHand.length * (cpuTw + 4) + 4) / 2 + i * (cpuTw + 4);
      drawBack(cx, cpuY, cpuTw, cpuTh);
    });
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    const cpuLabelY = cpuY + cpuTh + 12;
    ctx.fillText(`CPU · ${cpuHand.length}`, w / 2, cpuLabelY);
    const cpuMessage = turn === "cpu";
    if (cpuMessage) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "700 12px system-ui";
      ctx.fillText(status, w / 2, cpuLabelY + 16);
    }

    const hw = Math.min(44, (w - 16) / Math.max(playerHand.length, 1) - 6);
    const hh = hw * 2;
    const hy = h - hh - 18;
    const chainTop = cpuY + cpuTh + (cpuMessage ? 42 : 20);
    const chainBottom = hy - 48;
    chainSlots = layoutSnake(chain, 2, chainTop, w - 4, Math.max(90, chainBottom - chainTop));
    chainSlots.forEach((s, i) => {
      if (flight && i === flight.index) return;
      drawTile(s.tile, s.x, s.y, s.w, s.h, s.rot);
    });

    const selTile = selected >= 0 ? playerHand[selected] : null;
    const canSelL = Boolean(selTile && matches(selTile, left));
    const canSelR = Boolean(selTile && matches(selTile, right));
    if (turn === "player" && selected >= 0) {
      const leftEnd = endTarget("left", canSelL);
      const rightEnd = endTarget("right", canSelR);
      if (leftEnd) highlightRect(leftEnd);
      if (rightEnd) highlightRect(rightEnd);
    }

    handLayout = [];
    const playable = new Set(playableIn(playerHand).map((m) => m.i));
    playerHand.forEach((tile, i) => {
      const hx = 8 + i * (hw + 6);
      handLayout.push({ x: hx, y: hy, w: hw, h: hh });
      if (intake && i === intake.index) return;
      drawTile(tile, hx, hy, hw, hh, 0, selected === i || (turn === "player" && selected < 0 && playable.has(i)));
    });
    if (intake && handLayout[intake.index]) {
      const slot = handLayout[intake.index];
      const e = easeOut((performance.now() - intake.t0) / REFILL_MS);
      const fromX = 8;
      const fromY = hy - hh - 18;
      const x = fromX + (slot.x - fromX) * e;
      const y = fromY + (slot.y - fromY) * e;
      const scale = 0.7 + 0.3 * e;
      const tile = playerHand[intake.index];
      if (tile) drawTile(tile, x, y, slot.w * scale, slot.h * scale, 0);
    }
    if (flight && chainSlots[flight.index]) drawFlightTile(chainSlots[flight.index]);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`Boneyard ${boneyard.length}`, 10, hy - 12);

    if (!cpuMessage) {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "700 12px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(status, w - 10, hy - 12);
    }

    const now = performance.now();
    if (
      turn === "player" &&
      !ended &&
      !flight &&
      !intake &&
      config.hintHandEnabled &&
      hintHandVisible &&
      now - lastInputAt >= config.hintDelayMs
    ) {
      if (selected >= 0) {
        const zone = endTarget("left", canSelL) ?? endTarget("right", canSelR);
        if (zone) drawHintHand(ctx, handImage, zone.x + zone.w / 2, zone.y + zone.h / 2, 36, now);
      } else {
        const moves = playableIn(playerHand);
        if (moves.length && handLayout[moves[0].i]) {
          const b = handLayout[moves[0].i];
          drawHintHand(ctx, handImage, b.x + b.w / 2, b.y + 8, hw, now);
        }
      }
    }
    hud.tick(performance.now());
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
      if (extra.audioBus) sfx = extra.audioBus;
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      hintHandUrl = extra.hintHandUrl || "";
      hintHandVisible = extra.hintHandVisible !== false;
      background = extra.background;
      wireSfx();
      hud.mount(ctxInit.container);
      syncHud();
      deal();
      void load(extra).then(() => draw());
      canvas.addEventListener("pointerdown", onPointer);
    },
    setOptions(options) {
      const extra = options as Extra;
      if (extra.domino) {
        config = extra.domino;
        if (!ended && !holding && !paying && turn === "player" && selected < 0 && playableIn(playerHand).length > 0) {
          status = yourTurnText();
        }
        syncHud();
      }
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
      hud.cancel();
      paying = false;
      earned = 0;
      syncHud();
      roundIndex = playAllRounds ? 0 : roundIndex;
      deal();
    },
    destroy() {
      running = false;
      flight = null;
      intake = null;
      clearCpuTimer();
      hud.destroy();
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
      hud.resize();
      draw();
    },
  };
}
