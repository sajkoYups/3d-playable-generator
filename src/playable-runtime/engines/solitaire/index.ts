import type { Background, Orientation, SolitaireConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { canvasBgUrl, drawCanvasBackground, loadImage } from "@/playable-runtime/engines/canvas";
import { attachPlayableCanvas, beginCanvasFrame, pointerCanvasPos } from "@/playable-runtime/engines/canvas-setup";
import { CANVAS_HUD_H, drawCanvasHud } from "@/playable-runtime/engines/canvas-hud";
import { drawHintHand } from "@/playable-runtime/engines/hint-hand";
import {
  CARD_BACK_URL,
  KENNEY_CARD_ASPECT,
  KENNEY_CARD_SRC,
  cardUrl,
} from "@/playable-runtime/engines/kenney-2d-assets";
import { resolveRuntimeUrl } from "@/playable-runtime/models/assets";
import { listSolitaireRounds, SOLITAIRE_TABLEAU_PILES } from "@/playable-runtime/engines/solitaire/rounds";

type Card = { id: number; suit: number; rank: number; faceUp: boolean };
type Hit =
  | { kind: "stock" }
  | { kind: "waste" }
  | { kind: "foundation"; i: number }
  | { kind: "tableau"; col: number; from: number };

type Drag = {
  src: "waste" | "foundation" | number;
  from: number;
  foundation?: number;
  cards: Card[];
  ox: number;
  oy: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type Extra = {
  background?: Background;
  orientation?: Orientation;
  solitaire?: SolitaireConfig;
  playAllRounds?: boolean;
  parkingRoundIndex?: number;
  hintHandUrl?: string;
  hintHandVisible?: boolean;
};

const RANK = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT = ["♥", "♦", "♣", "♠"];
const SUIT_COLOR = ["#c41e3a", "#c41e3a", "#16161d", "#16161d"];

function red(suit: number) {
  return suit === 0 || suit === 1;
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function createSolitaireEngine(): Playable3DEngine {
  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let winCb: (() => void) | null = null;
  let loseCb: (() => void) | null = null;
  let running = false;
  let raf = 0;
  let ended = false;

  let config: SolitaireConfig = {
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
  let backImg: HTMLImageElement | null = null;
  const faceImgs = new Map<string, HTMLImageElement | null>();
  let assets: Record<string, string> = {};
  let loadToken = 0;
  let viewW = 1;
  let viewH = 1;

  let tableau: Card[][] = [];
  let foundations: Card[][] = [[], [], [], []];
  let stock: Card[] = [];
  let waste: Card[] = [];
  let drag: Drag | null = null;
  let layout = {
    cardW: 44,
    cardH: 44 * KENNEY_CARD_ASPECT,
    pad: 8,
    gap: 5,
    stockX: 8,
    wasteX: 56,
    foundX: 0,
    tabY: 0,
    fan: 18,
    radius: 6,
  };

  function rounds() {
    return listSolitaireRounds(config);
  }

  function currentRound() {
    const list = rounds();
    return list[Math.max(0, Math.min(roundIndex, list.length - 1))] ?? list[0];
  }

  function deal() {
    const piles = SOLITAIRE_TABLEAU_PILES;
    const deck: Card[] = [];
    let id = 0;
    for (let s = 0; s < 4; s++) {
      for (let r = 1; r <= 13; r++) deck.push({ id: id++, suit: s, rank: r, faceUp: false });
    }
    shuffle(deck);
    tableau = Array.from({ length: piles }, () => []);
    for (let col = 0; col < piles; col++) {
      for (let n = 0; n <= col; n++) {
        const card = deck.pop();
        if (!card) break;
        card.faceUp = n === col;
        tableau[col].push(card);
      }
    }
    stock = deck;
    waste = [];
    foundations = [[], [], [], []];
    drag = null;
    ended = false;
    lastInputAt = performance.now();
  }

  function foundationCount() {
    return foundations.reduce((n, p) => n + p.length, 0);
  }

  function canOnFoundation(card: Card, pile: Card[]) {
    if (!pile.length) return card.rank === 1;
    const top = pile[pile.length - 1];
    return top.suit === card.suit && card.rank === top.rank + 1;
  }

  function canOnTableau(card: Card, pile: Card[]) {
    if (!pile.length) return card.rank === 13;
    const top = pile[pile.length - 1];
    return top.faceUp && red(card.suit) !== red(top.suit) && card.rank === top.rank - 1;
  }

  function completeRound() {
    if (ended) return;
    earned += currentRound().coins;
    const list = rounds();
    if (playAllRounds && roundIndex < list.length - 1) {
      roundIndex += 1;
      deal();
      return;
    }
    ended = true;
    winCb?.();
  }

  function afterMove() {
    if (foundationCount() >= currentRound().cardsToWin) completeRound();
    else loseIfStuck();
  }

  function hasLegalPlay() {
    const wasteTop = waste[waste.length - 1];
    if (wasteTop) {
      if (foundations.some((p) => canOnFoundation(wasteTop, p))) return true;
      if (tableau.some((p) => canOnTableau(wasteTop, p))) return true;
    }
    for (const pile of tableau) {
      const top = pile[pile.length - 1];
      if (!top?.faceUp) continue;
      if (foundations.some((p) => canOnFoundation(top, p))) return true;
    }
    for (let c = 0; c < tableau.length; c++) {
      const pile = tableau[c];
      const start = pile.findIndex((card) => card.faceUp);
      if (start < 0) continue;
      const card = pile[start];
      for (let d = 0; d < tableau.length; d++) {
        if (d === c) continue;
        if (canOnTableau(card, tableau[d])) return true;
      }
    }
    return stock.length > 0 || waste.length > 0;
  }

  function loseIfStuck() {
    if (!config.failEnabled || ended) return;
    if (hasLegalPlay()) return;
    ended = true;
    loseCb?.();
  }

  function flipStock() {
    if (stock.length) {
      const card = stock.pop()!;
      card.faceUp = true;
      waste.push(card);
      return;
    }
    if (!waste.length) return;
    while (waste.length) {
      const card = waste.pop()!;
      card.faceUp = false;
      stock.push(card);
    }
  }

  function takeFrom(src: "waste" | "foundation" | number, from: number, foundationIndex?: number) {
    if (src === "waste") {
      waste.pop();
      return;
    }
    if (src === "foundation") {
      foundations[foundationIndex ?? 0].pop();
      return;
    }
    tableau[src].splice(from);
    const pile = tableau[src];
    if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
  }

  function tryPlace(cards: Card[], hit: Hit, src: Drag["src"], from: number, foundationIndex?: number) {
    if (!cards.length) return false;
    if (hit.kind === "foundation") {
      if (cards.length !== 1 || !canOnFoundation(cards[0], foundations[hit.i])) return false;
      takeFrom(src, from, foundationIndex);
      foundations[hit.i].push(cards[0]);
      afterMove();
      return true;
    }
    if (hit.kind === "tableau") {
      const destCol = hit.col;
      if (src === destCol) return false;
      if (!canOnTableau(cards[0], tableau[destCol])) return false;
      takeFrom(src, from, foundationIndex);
      tableau[destCol].push(...cards);
      afterMove();
      return true;
    }
    return false;
  }

  function tryAnyFoundation(cards: Card[], src: Drag["src"], from: number, foundationIndex?: number) {
    if (cards.length !== 1) return false;
    for (let i = 0; i < 4; i++) {
      if (tryPlace(cards, { kind: "foundation", i }, src, from, foundationIndex)) return true;
    }
    return false;
  }

  function findHint(): { x: number; y: number } | null {
    const { cardW, cardH, stockX, wasteX, tabY, fan, pad, gap } = layout;
    const wasteTop = waste[waste.length - 1];
    if (wasteTop) {
      if (foundations.some((p) => canOnFoundation(wasteTop, p)) || tableau.some((p) => canOnTableau(wasteTop, p))) {
        return { x: wasteX + cardW / 2, y: CANVAS_HUD_H + 10 + cardH * 0.45 };
      }
    }
    for (let c = 0; c < tableau.length; c++) {
      const pile = tableau[c];
      const top = pile[pile.length - 1];
      if (!top?.faceUp) continue;
      if (foundations.some((p) => canOnFoundation(top, p))) {
        return { x: pad + c * (cardW + gap) + cardW / 2, y: tabY + (pile.length - 1) * fan + cardH * 0.35 };
      }
    }
    if (stock.length || waste.length) return { x: stockX + cardW / 2, y: CANVAS_HUD_H + 10 + cardH * 0.45 };
    return null;
  }

  function hitAt(x: number, y: number): Hit | null {
    const { cardW, cardH, pad, gap, stockX, wasteX, foundX, tabY, fan } = layout;
    const top = CANVAS_HUD_H + 8;
    if (y >= top && y <= top + cardH) {
      if (x >= stockX && x <= stockX + cardW) return { kind: "stock" };
      if (x >= wasteX && x <= wasteX + cardW) return { kind: "waste" };
      for (let i = 0; i < 4; i++) {
        const fx = foundX + i * (cardW + gap);
        if (x >= fx && x <= fx + cardW) return { kind: "foundation", i };
      }
    }
    for (let c = 0; c < tableau.length; c++) {
      const px = pad + c * (cardW + gap);
      const pile = tableau[c];
      if (!pile.length) {
        if (x >= px && x <= px + cardW && y >= tabY && y <= tabY + cardH) return { kind: "tableau", col: c, from: 0 };
        continue;
      }
      for (let i = pile.length - 1; i >= 0; i--) {
        const py = tabY + i * fan;
        const h = i === pile.length - 1 ? cardH : fan;
        if (x >= px && x <= px + cardW && y >= py && y <= py + h) {
          return { kind: "tableau", col: c, from: pile[i].faceUp ? i : pile.length - 1 };
        }
      }
    }
    return null;
  }

  function pickup(hit: Hit, x: number, y: number): Drag | null {
    const { cardW, cardH, pad, gap, wasteX, foundX, tabY, fan } = layout;
    const top = CANVAS_HUD_H + 8;
    if (hit.kind === "waste") {
      const card = waste[waste.length - 1];
      if (!card) return null;
      return { src: "waste", from: 0, cards: [card], ox: x - wasteX, oy: y - top, x, y, startX: x, startY: y, moved: false };
    }
    if (hit.kind === "foundation") {
      const pile = foundations[hit.i];
      const card = pile[pile.length - 1];
      if (!card) return null;
      const fx = foundX + hit.i * (cardW + gap);
      return {
        src: "foundation",
        from: 0,
        foundation: hit.i,
        cards: [card],
        ox: x - fx,
        oy: y - top,
        x,
        y,
        startX: x,
        startY: y,
        moved: false,
      };
    }
    if (hit.kind === "tableau") {
      const pile = tableau[hit.col];
      if (!pile[hit.from]?.faceUp) return null;
      const cards = pile.slice(hit.from);
      if (!cards.length) return null;
      const px = pad + hit.col * (cardW + gap);
      const py = tabY + hit.from * fan;
      return { src: hit.col, from: hit.from, cards, ox: x - px, oy: y - py, x, y, startX: x, startY: y, moved: false };
    }
    return null;
  }

  function posFromEvent(e: PointerEvent) {
    return pointerCanvasPos(e, canvas!, viewW, viewH);
  }

  function onDown(e: PointerEvent) {
    if (!running || ended || !canvas) return;
    e.preventDefault();
    e.stopPropagation();
    lastInputAt = performance.now();
    const { x, y } = posFromEvent(e);
    const hit = hitAt(x, y);
    if (!hit) {
      drag = null;
      return;
    }
    if (hit.kind === "stock") {
      flipStock();
      loseIfStuck();
      return;
    }
    drag = pickup(hit, x, y);
    if (drag) canvas.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (!drag || !canvas) return;
    const { x, y } = posFromEvent(e);
    if (Math.hypot(x - drag.startX, y - drag.startY) > 8) drag.moved = true;
    drag.x = x;
    drag.y = y;
  }

  function onUp(e: PointerEvent) {
    if (!drag || !canvas) {
      drag = null;
      return;
    }
    const { x, y } = posFromEvent(e);
    const cards = drag.cards;
    const src = drag.src;
    const from = drag.from;
    const fi = drag.foundation;
    const moved = drag.moved;
    drag = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const hit = hitAt(x, y);
    if (moved && hit) {
      tryPlace(cards, hit, src, from, fi);
      return;
    }
    if (!moved) tryAnyFoundation(cards, src, from, fi);
  }

  function drawWell(x: number, y: number, label?: string) {
    if (!ctx) return;
    const { cardW, cardH, radius } = layout;
    ctx.save();
    roundRect(ctx, x, y, cardW, cardH, radius);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (label) {
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.font = `700 ${Math.max(12, cardW * 0.32)}px Georgia, "Times New Roman", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + cardW / 2, y + cardH / 2);
    }
    ctx.restore();
  }

  function drawFaceFallback(card: Card, x: number, y: number, w: number, h: number) {
    if (!ctx) return;
    const color = SUIT_COLOR[card.suit];
    const pip = SUIT[card.suit];
    const rank = RANK[card.rank];
    const corner = Math.max(9, w * 0.2);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 ${corner}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(rank, x + 3 + corner * 0.45, y + 4);
    ctx.font = `${corner * 0.85}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(pip, x + 3 + corner * 0.45, y + 4 + corner * 0.92);
    ctx.save();
    ctx.translate(x + w - 3 - corner * 0.45, y + h - 4);
    ctx.rotate(Math.PI);
    ctx.font = `700 ${corner}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(rank, 0, 0);
    ctx.font = `${corner * 0.85}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(pip, 0, corner * 0.92);
    ctx.restore();
    ctx.font = `${Math.max(18, w * 0.42)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pip, x + w / 2, y + h / 2 + 2);
  }

  /** Draw cropped Kenney art edge-to-edge (pack has transparent L/R gutters). */
  function drawKenneyCover(
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
  ) {
    if (!ctx) return;
    const { sx, sy, sw, sh } = KENNEY_CARD_SRC;
    const scale = Math.max(w / sw, h / sh) * 1.02;
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  }

  function drawBack(x: number, y: number, w: number, h: number, radius: number) {
    if (!ctx) return;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = "#1e3a8a";
    ctx.fill();
    if (backImg && backImg.complete && backImg.naturalWidth) {
      drawKenneyCover(backImg, x, y, w, h, radius);
    } else {
      ctx.strokeStyle = "rgba(248,250,252,0.35)";
      ctx.lineWidth = 2;
      roundRect(ctx, x + 6, y + 6, w - 12, h - 12, Math.max(2, radius - 2));
      ctx.stroke();
    }
  }

  function drawCard(card: Card, x: number, y: number, lifted = false) {
    if (!ctx) return;
    const { cardW: w, cardH: h, radius } = layout;
    ctx.save();
    ctx.shadowColor = lifted ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.28)";
    ctx.shadowBlur = lifted ? 16 : 7;
    ctx.shadowOffsetY = lifted ? 8 : 3;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = card.faceUp ? "#fbfaf6" : "#1e3a8a";
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (card.faceUp) {
      const url = cardUrl(card.suit, card.rank);
      const img = faceImgs.get(url);
      if (img && img.complete && img.naturalWidth) drawKenneyCover(img, x, y, w, h, radius);
      else drawFaceFallback(card, x, y, w, h);
    } else drawBack(x, y, w, h, radius);
    ctx.strokeStyle = card.faceUp ? "rgba(15,23,42,0.16)" : "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();
    ctx.restore();
  }

  function paintFelt(w: number, h: number) {
    if (!ctx) return;
    if (background?.type === "transparent" || background?.type === "image") {
      drawCanvasBackground(ctx, w, h, background, bgImage);
      return;
    }
    const g = ctx.createRadialGradient(w * 0.5, h * 0.38, 12, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    g.addColorStop(0, "#2f9a55");
    g.addColorStop(0.45, "#1d7040");
    g.addColorStop(1, "#0f3d24");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, w, 10);
    ctx.fillRect(0, h - 8, w, 8);
  }

  function draw() {
    if (!canvas || !ctx || !container) return;
    const { w, h } = beginCanvasFrame(canvas, ctx, container);
    viewW = w;
    viewH = h;
    paintFelt(w, h);
    const piles = SOLITAIRE_TABLEAU_PILES;
    const pad = 4;
    const gap = 3;
    // Portrait slots match cropped Kenney art (~42×60).
    const cardW = Math.max(36, Math.min(56, (w - pad * 2 - gap * (piles - 1)) / piles));
    const cardH = cardW * KENNEY_CARD_ASPECT;
    const maxLen = Math.max(7, ...tableau.map((p) => p.length), 1);
    const tabY = CANVAS_HUD_H + 12 + cardH;
    const fan = Math.max(12, Math.min(cardH * 0.28, (h - tabY - cardH - 8) / Math.max(1, maxLen - 1)));
    layout = {
      cardW,
      cardH,
      pad,
      gap,
      stockX: pad,
      wasteX: pad + cardW + gap,
      foundX: w - pad - 4 * cardW - 3 * gap,
      tabY,
      fan,
      radius: Math.max(5, cardW * 0.12),
    };
    const list = rounds();
    drawCanvasHud(ctx, {
      w,
      roundText: `R${Math.min(roundIndex + 1, list.length)}/${list.length}`,
      coinsText: `${earned}`,
      extraText: `${foundationCount()}/${currentRound().cardsToWin}`,
      coinImage,
      transparent: config.hudTransparent,
    });
    const top = CANVAS_HUD_H + 8;
    if (stock.length) drawCard({ id: -1, suit: 0, rank: 1, faceUp: false }, layout.stockX, top);
    else drawWell(layout.stockX, top);
    if (waste.length) {
      const show = waste.slice(-2);
      show.forEach((card, i) => {
        const isTop = i === show.length - 1;
        if (drag?.src === "waste" && isTop) return;
        drawCard(card, layout.wasteX + i * 3, top);
      });
    } else drawWell(layout.wasteX, top);
    for (let i = 0; i < 4; i++) {
      const fx = layout.foundX + i * (cardW + gap);
      const pile = foundations[i];
      if (!pile.length) drawWell(fx, top, SUIT[i]);
      else if (drag?.src === "foundation" && drag.foundation === i) {
        if (pile.length > 1) drawCard(pile[pile.length - 2], fx, top);
        else drawWell(fx, top, SUIT[i]);
      } else drawCard(pile[pile.length - 1], fx, top);
    }
    for (let c = 0; c < tableau.length; c++) {
      const px = pad + c * (cardW + gap);
      const pile = tableau[c];
      const hideFrom = drag && drag.src === c ? drag.from : -1;
      if (!pile.length) drawWell(px, layout.tabY);
      pile.forEach((card, i) => {
        if (hideFrom >= 0 && i >= hideFrom) return;
        drawCard(card, px, layout.tabY + i * fan);
      });
    }
    if (drag) {
      drag.cards.forEach((card, i) => {
        drawCard(card, drag!.x - drag!.ox, drag!.y - drag!.oy + i * fan, true);
      });
    }
    const now = performance.now();
    if (!drag && config.hintHandEnabled && hintHandVisible && now - lastInputAt >= config.hintDelayMs) {
      const hint = findHint();
      if (hint) drawHintHand(ctx, handImage, hint.x, hint.y, cardW * 0.85, now);
    }
  }

  function loop() {
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function mediaUrl(ref: string) {
    // Export fills `assets` with data URIs; editor leaves it empty and serves /public.
    return resolveRuntimeUrl(ref, assets) || (Object.keys(assets).length === 0 ? ref : "");
  }

  async function load(extra: Extra) {
    if (extra.background) background = extra.background;
    if (extra.orientation) orientation = extra.orientation;
    const token = ++loadToken;
    const bgUrl = canvasBgUrl(background, orientation);
    const faceLoads: Promise<void>[] = [];
    for (let s = 0; s < 4; s++) {
      for (let r = 1; r <= 13; r++) {
        const key = cardUrl(s, r);
        faceLoads.push(
          loadImage(mediaUrl(key)).then((img) => {
            faceImgs.set(key, img);
          }),
        );
      }
    }
    const [bg, hand, coin, back] = await Promise.all([
      background?.type === "image" && bgUrl ? loadImage(mediaUrl(bgUrl)) : Promise.resolve(null),
      hintHandUrl ? loadImage(mediaUrl(hintHandUrl)) : Promise.resolve(null),
      config.coinImageUrl ? loadImage(mediaUrl(config.coinImageUrl)) : Promise.resolve(null),
      loadImage(mediaUrl(CARD_BACK_URL)),
      Promise.all(faceLoads).then(() => null),
    ]);
    if (token !== loadToken) return;
    bgImage = bg;
    handImage = hand;
    coinImage = coin;
    backImg = back;
  }

  return {
    id: "solitaire",
    name: "Solitaire",
    initialize(ctxInit: EngineInitContext) {
      const extra = ctxInit as EngineInitContext & Extra;
      container = ctxInit.container;
      const attached = attachPlayableCanvas(ctxInit.container);
      canvas = attached.canvas;
      ctx = attached.ctx;
      orientation = ctxInit.orientation;
      assets = ctxInit.assets || {};
      if (extra.solitaire) config = extra.solitaire;
      playAllRounds = extra.playAllRounds !== false;
      roundIndex = typeof extra.parkingRoundIndex === "number" ? extra.parkingRoundIndex : 0;
      hintHandUrl = extra.hintHandUrl || "";
      hintHandVisible = extra.hintHandVisible !== false;
      background = extra.background;
      deal();
      void load(extra).then(() => draw());
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
    },
    setOptions(options) {
      const extra = options as Extra;
      if (extra.solitaire) config = extra.solitaire;
      if (typeof extra.playAllRounds === "boolean") playAllRounds = extra.playAllRounds;
      if (typeof extra.parkingRoundIndex === "number") {
        const nextIdx = extra.parkingRoundIndex;
        if (nextIdx !== roundIndex) {
          roundIndex = nextIdx;
          deal();
        }
      }
      if (tableau.length !== SOLITAIRE_TABLEAU_PILES) deal();
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
      cancelAnimationFrame(raf);
      canvas?.removeEventListener("pointerdown", onDown);
      canvas?.removeEventListener("pointermove", onMove);
      canvas?.removeEventListener("pointerup", onUp);
      canvas?.removeEventListener("pointercancel", onUp);
      container = null;
      canvas = null;
      ctx = null;
      faceImgs.clear();
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
