import { Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, Vector2 } from "three";
import type { TripleMatchConfig } from "@/types/project";
import type { EngineInitContext, Playable3DEngine } from "@/playable-runtime/engines/types";
import { ThreeHost } from "@/playable-runtime/three/host";
import { applyLivePresentation } from "@/playable-runtime/three/presentation";
import { attachPointer } from "@/playable-runtime/three/input";
import { blobShadow, createProceduralModel } from "@/playable-runtime/models/procedural";

type Item = {
  id: string;
  kind: string;
  group: Group;
  col: number;
  row: number;
  taken: boolean;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function solvableDeck(kinds: string[], triples: number): string[] {
  const pool = kinds.length ? kinds : ["apple", "banana", "bottle"];
  const deck: string[] = [];
  for (let i = 0; i < triples; i++) {
    const k = pool[i % pool.length];
    deck.push(k, k, k);
  }
  while (deck.length % 3 !== 0) deck.push(pool[0]);
  return shuffle(deck);
}

export function createTripleMatchEngine(): Playable3DEngine {
  let host: ThreeHost | null = null;
  let config: TripleMatchConfig | null = null;
  let items: Item[] = [];
  let bar: string[] = [];
  let barSlots: Group[] = [];
  let cleared = 0;
  let started = false;
  let ended = false;
  let onWin: () => void = () => undefined;
  let onLose: () => void = () => undefined;
  let detach: (() => void) | null = null;
  let root: Group | null = null;
  let ctx: EngineInitContext | null = null;
  const raycaster = new Raycaster();
  const pointer = new Vector2();

  function finish(kind: "win" | "lose") {
    if (ended) return;
    ended = true;
    started = false;
    if (kind === "win") onWin();
    else onLose();
  }

  function layoutGrid() {
    const cols = 4;
    const gap = 1.15;
    items.forEach((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      it.col = col;
      it.row = row;
      it.group.position.set((col - 1.5) * gap, 0.45, (row - 1.2) * gap);
    });
  }

  function refreshBar() {
    barSlots.forEach((slot, i) => {
      while (slot.children.length) slot.remove(slot.children[0]);
      const kind = bar[i];
      if (!kind || !host) return;
      const model = createProceduralModel(kind, host.tracker);
      model.scale.setScalar(0.7);
      slot.add(model);
    });
  }

  function take(item: Item) {
    if (item.taken || ended || !started) return;
    item.taken = true;
    item.group.visible = false;
    bar.push(item.kind);
    const last = item.kind;
    const count = bar.filter((k) => k === last).length;
    if (count >= 3) {
      let removed = 0;
      bar = bar.filter((k) => {
        if (k === last && removed < 3) {
          removed += 1;
          return false;
        }
        return true;
      });
      cleared += 1;
      if (cleared >= (config?.triplesToWin ?? 6)) {
        refreshBar();
        finish("win");
        return;
      }
    }
    if (bar.length >= (config?.barSlots ?? 7)) {
      refreshBar();
      finish("lose");
      return;
    }
    refreshBar();
  }

  function build() {
    if (!host || !config || !root) return;
    while (root.children.length) root.remove(root.children[0]);
    items = [];
    bar = [];
    barSlots = [];
    cleared = 0;
    ended = false;

    const trayGeo = new PlaneGeometry(6.2, 5.2);
    host.tracker.track(trayGeo);
    const trayMat = new MeshStandardMaterial({ color: new Color(config.trayColor), roughness: 0.7 });
    host.tracker.track(trayMat);
    const tray = new Mesh(trayGeo, trayMat);
    tray.rotation.x = -Math.PI / 2;
    tray.position.y = 0.02;
    root.add(tray);

    const deck = solvableDeck(config.itemSlots, Math.max(config.triplesToWin + 2, 8));
    deck.slice(0, 16).forEach((kind, i) => {
      const group = createProceduralModel(kind, host!.tracker);
      const shadow = blobShadow(host!.tracker, 0.35);
      shadow.position.y = -0.42;
      group.add(shadow);
      root!.add(group);
      items.push({ id: `i${i}`, kind, group, col: 0, row: 0, taken: false });
    });
    layoutGrid();

    const slots = config.barSlots;
    for (let i = 0; i < slots; i++) {
      const slot = new Group();
      slot.position.set((i - (slots - 1) / 2) * 0.85, 0.3, 2.7);
      const padGeo = new PlaneGeometry(0.7, 0.7);
      host.tracker.track(padGeo);
      const padMat = new MeshStandardMaterial({ color: "#1c1f2a", roughness: 0.8 });
      host.tracker.track(padMat);
      const pad = new Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      slot.add(pad);
      root.add(slot);
      barSlots.push(slot);
    }
  }

  return {
    id: "triple-match",
    name: "Triple Match 3D",
    initialize(init) {
      ctx = init;
      config = ((init as EngineInitContext & { tripleMatch?: TripleMatchConfig }).tripleMatch)
        ?? {
          itemSlots: ["apple", "banana", "bottle", "can", "coin", "gem"],
          trayColor: "#c4a574",
          barSlots: 7,
          triplesToWin: 6,
          difficulty: "medium",
        };
      host = new ThreeHost(init.container);
      host.applyLighting(init.lighting);
      host.applyCamera(init.camera, init.orientation, host.camera.aspect);
      root = new Group();
      host.scene.add(root);
      build();
      detach = attachPointer(host.canvas, (e) => {
        if (e.kind !== "tap" || !host) return;
        pointer.set(e.ndcX, e.ndcY);
        raycaster.setFromCamera(pointer, host.camera);
        const meshes = items.filter((it) => !it.taken).flatMap((it) => {
          const list: Mesh[] = [];
          it.group.traverse((ch) => {
            if (ch instanceof Mesh) list.push(ch);
          });
          return list.map((mesh) => ({ mesh, item: it }));
        });
        const hits = raycaster.intersectObjects(meshes.map((m) => m.mesh), false);
        if (!hits.length) return;
        const found = meshes.find((m) => m.mesh === hits[0].object);
        if (found) take(found.item);
      });
    },
    start() {
      started = true;
      host?.start(() => {
        items.forEach((it, i) => {
          if (it.taken) return;
          it.group.rotation.y = Math.sin(performance.now() / 700 + i) * 0.15;
        });
      });
    },
    pause() {
      started = false;
      host?.pause();
    },
    reset() {
      started = true;
      build();
    },
    destroy() {
      detach?.();
      host?.destroy();
      host = null;
      ctx = null;
    },
    onWin(cb) {
      onWin = cb;
    },
    onLose(cb) {
      onLose = cb;
    },
    setOptions(options) {
      const next = options.tripleMatch as TripleMatchConfig | undefined;
      if (next) config = next;
      if (ctx) applyLivePresentation(host, options, ctx);
    },
    resize(w, h) {
      host?.resize(w, h);
    },
  };
}
