import { TOWER_RECIPES, type TowerKind } from "@/playable-runtime/engines/tower-defense/combat";

export type TdHudState = {
  lives: number;
  gold: number;
  selected: TowerKind;
  costs: Record<TowerKind, number>;
  hint: string;
};

export type TdHud = {
  mount(container: HTMLElement): void;
  setState(state: TdHudState): void;
  onSelect(cb: (kind: TowerKind) => void): void;
  destroy(): void;
};

export function createTdHud(): TdHud {
  let root: HTMLElement | null = null;
  let livesEl: HTMLElement | null = null;
  let goldEl: HTMLElement | null = null;
  let hintEl: HTMLElement | null = null;
  let onPick: (kind: TowerKind) => void = () => undefined;
  const buttons = new Map<TowerKind, HTMLButtonElement>();

  function paint(state: TdHudState) {
    if (livesEl) livesEl.textContent = `❤ ${state.lives}`;
    if (goldEl) goldEl.textContent = `Gold ${state.gold}`;
    if (hintEl) {
      hintEl.textContent = state.hint;
      hintEl.style.opacity = state.hint ? "1" : "0";
    }
    for (const kind of Object.keys(TOWER_RECIPES) as TowerKind[]) {
      const btn = buttons.get(kind);
      if (!btn) continue;
      const cost = state.costs[kind];
      const recipe = TOWER_RECIPES[kind];
      btn.textContent = `${recipe.label}  ${cost}`;
      btn.style.borderColor = state.selected === kind ? recipe.color : "transparent";
      btn.style.opacity = state.gold >= cost ? "1" : "0.45";
    }
  }

  return {
    mount(container) {
      if (!container.style.position) container.style.position = "relative";
      root = document.createElement("div");
      root.style.cssText =
        "position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;font-family:system-ui,sans-serif;";

      const top = document.createElement("div");
      top.style.cssText =
        "display:flex;justify-content:flex-end;gap:10px;padding:8px 10px 0;pointer-events:none;";
      livesEl = document.createElement("div");
      livesEl.style.cssText =
        "color:#e85d4c;font-weight:800;font-size:14px;text-shadow:0 1px 4px rgba(0,0,0,0.65);";
      goldEl = document.createElement("div");
      goldEl.style.cssText =
        "color:#e0b04a;font-weight:800;font-size:14px;text-shadow:0 1px 4px rgba(0,0,0,0.65);";
      top.append(livesEl, goldEl);

      hintEl = document.createElement("div");
      hintEl.style.cssText =
        "position:absolute;left:0;right:0;top:42%;text-align:center;color:#f3ede0;font-weight:800;font-size:18px;letter-spacing:0.04em;text-shadow:0 2px 8px rgba(0,0,0,0.7);transition:opacity 0.2s;pointer-events:none;";

      const tray = document.createElement("div");
      tray.style.cssText =
        "display:flex;justify-content:center;gap:8px;padding:0 10px 10px;pointer-events:auto;";
      for (const kind of Object.keys(TOWER_RECIPES) as TowerKind[]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.cssText =
          "min-width:92px;border:2px solid transparent;border-radius:12px;padding:8px 10px;background:rgba(18,20,26,0.78);color:#f3ede0;font-weight:700;font-size:12px;cursor:pointer;";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          onPick(kind);
        });
        buttons.set(kind, btn);
        tray.appendChild(btn);
      }

      root.append(top, hintEl, tray);
      container.appendChild(root);
    },
    setState(state) {
      paint(state);
    },
    onSelect(cb) {
      onPick = cb;
    },
    destroy() {
      root?.remove();
      root = null;
      livesEl = null;
      goldEl = null;
      hintEl = null;
      buttons.clear();
    },
  };
}
