import type { Orientation } from "@/types/project";
import { TOWER_RECIPES, type TowerKind } from "@/playable-runtime/engines/tower-defense/combat";

export type TdHudState = {
  lives: number;
  gold: number;
  selected: TowerKind;
  costs: Record<TowerKind, number>;
  hint: string;
  coinUrl: string;
  canStart: boolean;
};

export type TdHud = {
  mount(container: HTMLElement): void;
  setOrientation(orientation: Orientation): void;
  setState(state: TdHudState): void;
  setThumbs(urls: Partial<Record<TowerKind, string>>): void;
  onSelect(cb: (kind: TowerKind) => void): void;
  onStart(cb: () => void): void;
  destroy(): void;
};

export function createTdHud(): TdHud {
  let root: HTMLElement | null = null;
  let livesEl: HTMLElement | null = null;
  let goldEl: HTMLElement | null = null;
  let hintEl: HTMLElement | null = null;
  let startEl: HTMLButtonElement | null = null;
  let onPick: (kind: TowerKind) => void = () => undefined;
  let onStartWave: () => void = () => undefined;
  let topEl: HTMLElement | null = null;
  let bottom: HTMLElement | null = null;
  let tray: HTMLElement | null = null;
  let orientation: Orientation = "portrait";
  const buttons = new Map<TowerKind, { root: HTMLButtonElement; shot: HTMLImageElement; cost: HTMLElement; coin: HTMLImageElement }>();
  const thumbs = new Map<TowerKind, string>();
  let lastState: TdHudState | null = null;

  function layout() {
    if (!root || !topEl || !bottom || !tray || !hintEl) return;
    const landscape = orientation === "landscape";
    if (landscape) {
      bottom.style.cssText =
        "position:absolute;top:8px;right:8px;bottom:8px;width:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;pointer-events:none;z-index:2;";
      tray.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:auto;";
      topEl.style.paddingRight = "116px";
      hintEl.style.right = "116px";
    } else {
      bottom.style.cssText =
        "display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 10px 10px;pointer-events:none;";
      tray.style.cssText = "display:flex;justify-content:center;gap:8px;pointer-events:auto;";
      topEl.style.paddingRight = "10px";
      hintEl.style.right = "0";
    }
    const shot = landscape ? 46 : 68;
    for (const btn of buttons.values()) {
      btn.root.style.width = landscape ? "88px" : "84px";
      btn.shot.style.width = `${shot}px`;
      btn.shot.style.height = `${shot}px`;
    }
  }

  function paint(state: TdHudState) {
    if (livesEl) livesEl.textContent = `❤ ${state.lives}`;
    if (goldEl) goldEl.textContent = `Gold ${state.gold}`;
    if (hintEl) {
      hintEl.textContent = state.hint;
      hintEl.style.opacity = state.hint ? "1" : "0";
    }
    if (startEl) startEl.style.display = state.canStart ? "block" : "none";
    for (const kind of Object.keys(TOWER_RECIPES) as TowerKind[]) {
      const btn = buttons.get(kind);
      if (!btn) continue;
      const cost = state.costs[kind];
      const recipe = TOWER_RECIPES[kind];
      const shot = thumbs.get(kind);
      if (shot && btn.shot.dataset.src !== shot) {
        btn.shot.dataset.src = shot;
        btn.shot.src = shot;
      }
      btn.shot.style.background = shot ? "transparent" : recipe.color;
      if (state.coinUrl && btn.coin.dataset.src !== state.coinUrl) {
        btn.coin.dataset.src = state.coinUrl;
        btn.coin.src = state.coinUrl;
      }
      btn.cost.textContent = String(cost);
      btn.root.style.borderColor = state.selected === kind ? recipe.color : "rgba(255,255,255,0.14)";
      btn.root.style.opacity = state.gold >= cost ? "1" : "0.45";
      btn.root.setAttribute("aria-label", `${recipe.label}, ${cost} coins`);
    }
  }

  return {
    mount(container) {
      if (!container.style.position) container.style.position = "relative";
      root = document.createElement("div");
      root.style.cssText =
        "position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;font-family:system-ui,sans-serif;";

      topEl = document.createElement("div");
      topEl.style.cssText =
        "display:flex;justify-content:flex-end;gap:10px;padding:8px 10px 0;pointer-events:none;";
      livesEl = document.createElement("div");
      livesEl.style.cssText =
        "color:#e85d4c;font-weight:800;font-size:14px;text-shadow:0 1px 4px rgba(0,0,0,0.65);";
      goldEl = document.createElement("div");
      goldEl.style.cssText =
        "color:#e0b04a;font-weight:800;font-size:14px;text-shadow:0 1px 4px rgba(0,0,0,0.65);";
      topEl.append(livesEl, goldEl);

      hintEl = document.createElement("div");
      hintEl.style.cssText =
        "position:absolute;left:0;right:0;top:42%;text-align:center;color:#f3ede0;font-weight:800;font-size:18px;letter-spacing:0.04em;text-shadow:0 2px 8px rgba(0,0,0,0.7);transition:opacity 0.2s;pointer-events:none;";

      bottom = document.createElement("div");
      startEl = document.createElement("button");
      startEl.type = "button";
      startEl.textContent = "Start wave";
      startEl.style.cssText =
        "display:none;pointer-events:auto;border:0;border-radius:999px;padding:10px 22px;background:#f3ede0;color:#1a140c;font-weight:800;font-size:15px;letter-spacing:0.02em;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.35);";
      startEl.addEventListener("click", (e) => {
        e.stopPropagation();
        onStartWave();
      });

      tray = document.createElement("div");
      for (const kind of Object.keys(TOWER_RECIPES) as TowerKind[]) {
        const recipe = TOWER_RECIPES[kind];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.cssText =
          "display:flex;flex-direction:column;align-items:center;width:84px;border:2px solid rgba(255,255,255,0.14);border-radius:14px;padding:6px 6px 8px;background:rgba(18,20,26,0.82);cursor:pointer;";
        const shot = document.createElement("img");
        shot.alt = "";
        shot.draggable = false;
        shot.style.cssText =
          "width:68px;height:68px;object-fit:contain;border-radius:10px;background:" + recipe.color + ";pointer-events:none;";
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:center;gap:4px;margin-top:4px;pointer-events:none;";
        const coin = document.createElement("img");
        coin.alt = "";
        coin.draggable = false;
        coin.style.cssText = "width:14px;height:14px;object-fit:contain;";
        const cost = document.createElement("span");
        cost.style.cssText = "color:#e0b04a;font-weight:800;font-size:13px;";
        row.append(coin, cost);
        btn.append(shot, row);
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          onPick(kind);
        });
        buttons.set(kind, { root: btn, shot, cost, coin });
        tray.appendChild(btn);
      }
      bottom.append(startEl, tray);

      root.append(topEl, hintEl, bottom);
      container.appendChild(root);
      layout();
    },
    setOrientation(next) {
      orientation = next;
      layout();
    },
    setState(state) {
      lastState = state;
      paint(state);
    },
    setThumbs(urls) {
      for (const kind of Object.keys(urls) as TowerKind[]) {
        const url = urls[kind];
        if (url) thumbs.set(kind, url);
      }
      if (lastState) paint(lastState);
    },
    onSelect(cb) {
      onPick = cb;
    },
    onStart(cb) {
      onStartWave = cb;
    },
    destroy() {
      root?.remove();
      root = null;
      livesEl = null;
      goldEl = null;
      hintEl = null;
      startEl = null;
      topEl = null;
      bottom = null;
      tray = null;
      buttons.clear();
      thumbs.clear();
    },
  };
}
