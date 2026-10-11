import {
  Box3,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { ResourceTracker } from "@/playable-runtime/three/resources";

const loadingManager = new LoadingManager();
let runtimeAssets: Record<string, string> = {};

export function setRuntimeAssets(assets: Record<string, string>) {
  runtimeAssets = assets;
}

loadingManager.setURLModifier((url) => {
  if (runtimeAssets[url]) return runtimeAssets[url];
  if (/colormap\.png(?:\?|$)/i.test(url)) {
    const td = "/models/kenney/td/colormap.png";
    const food = "/models/kenney/food/colormap.png";
    if (/kenney\/td/i.test(url) || /td-colormap/i.test(url)) {
      return runtimeAssets[td] || td;
    }
    if (runtimeAssets[td] && !/kenney\/food/i.test(url)) {
      return runtimeAssets[td];
    }
    return runtimeAssets[food] || food;
  }
  return url;
});
const gltfLoader = new GLTFLoader(loadingManager);
const textureLoader = new TextureLoader();
const gltfCache = new Map<string, Group>();
const textureCache = new Map<string, Texture>();

const LIBRARY_CAR_URLS: Record<string, string> = {
  sedan: "/models/kenney/sedan.glb",
  suv: "/models/kenney/suv.glb",
  van: "/models/kenney/van.glb",
  taxi: "/models/kenney/taxi.glb",
  police: "/models/kenney/police.glb",
  truck: "/models/kenney/truck.glb",
  cone: "/models/kenney/cone.glb",
};

const LIBRARY_FOOD_URLS: Record<string, string> = {
  apple: "/models/kenney/food/apple.glb",
  banana: "/models/kenney/food/banana.glb",
  strawberry: "/models/kenney/food/strawberry.glb",
  orange: "/models/kenney/food/orange.glb",
  lemon: "/models/kenney/food/lemon.glb",
  pear: "/models/kenney/food/pear.glb",
  cherries: "/models/kenney/food/cherries.glb",
  donut: "/models/kenney/food/donut.glb",
  croissant: "/models/kenney/food/croissant.glb",
  cupcake: "/models/kenney/food/cupcake.glb",
  cookie: "/models/kenney/food/cookie.glb",
  taco: "/models/kenney/food/taco.glb",
  bacon: "/models/kenney/food/bacon.glb",
  burger: "/models/kenney/food/burger.glb",
  "soda-can": "/models/kenney/food/soda-can.glb",
  "soda-bottle": "/models/kenney/food/soda-bottle.glb",
  carrot: "/models/kenney/food/carrot.glb",
  tomato: "/models/kenney/food/tomato.glb",
  muffin: "/models/kenney/food/muffin.glb",
  lollypop: "/models/kenney/food/lollypop.glb",
  honey: "/models/kenney/food/honey.glb",
  soda: "/models/kenney/food/soda.glb",
  "cutting-board": "/models/kenney/food/cutting-board.glb",
  bottle: "/models/kenney/food/soda-bottle.glb",
  can: "/models/kenney/food/soda-can.glb",
  coin: "/models/kenney/food/cookie.glb",
  gem: "/models/kenney/food/lollypop.glb",
  key: "/models/kenney/food/honey.glb",
  star: "/models/kenney/food/cupcake.glb",
  hammer: "/models/kenney/food/carrot.glb",
  potion: "/models/kenney/food/soda.glb",
  crown: "/models/kenney/food/muffin.glb",
};

export const TD_COLORMAP_URL = "/models/kenney/td/colormap.png";

export const LIBRARY_TD_URLS: Record<string, string> = {
  tile: "/models/kenney/td/tile.glb",
  "tile-straight": "/models/kenney/td/tile-straight.glb",
  "tile-corner-round": "/models/kenney/td/tile-corner-round.glb",
  "tile-spawn": "/models/kenney/td/tile-spawn.glb",
  "tile-end": "/models/kenney/td/tile-end.glb",
  "tile-crystal": "/models/kenney/td/tile-crystal.glb",
  "tile-tree": "/models/kenney/td/tile-tree.glb",
  "tile-rock": "/models/kenney/td/tile-rock.glb",
  "tile-hill": "/models/kenney/td/tile-hill.glb",
  "tile-slope": "/models/kenney/td/tile-slope.glb",
  "tile-dirt": "/models/kenney/td/tile-dirt.glb",
  "tile-river-bridge": "/models/kenney/td/tile-river-bridge.glb",
  "tile-tree-double": "/models/kenney/td/tile-tree-double.glb",
  "tile-tree-quad": "/models/kenney/td/tile-tree-quad.glb",
  "detail-tree": "/models/kenney/td/detail-tree.glb",
  "detail-tree-large": "/models/kenney/td/detail-tree-large.glb",
  "detail-rocks": "/models/kenney/td/detail-rocks.glb",
  "wood-structure": "/models/kenney/td/wood-structure.glb",
  "wood-structure-high": "/models/kenney/td/wood-structure-high.glb",
  "wood-structure-part": "/models/kenney/td/wood-structure-part.glb",
  "tower-square-roof-a": "/models/kenney/td/tower-square-roof-a.glb",
  "tower-square-roof-b": "/models/kenney/td/tower-square-roof-b.glb",
  "selection-a": "/models/kenney/td/selection-a.glb",
  "spawn-round": "/models/kenney/td/spawn-round.glb",
  "tower-round-base": "/models/kenney/td/tower-round-base.glb",
  "tower-round-bottom-a": "/models/kenney/td/tower-round-bottom-a.glb",
  "tower-round-middle-a": "/models/kenney/td/tower-round-middle-a.glb",
  "tower-round-top-a": "/models/kenney/td/tower-round-top-a.glb",
  "tower-square-bottom-a": "/models/kenney/td/tower-square-bottom-a.glb",
  "tower-square-middle-a": "/models/kenney/td/tower-square-middle-a.glb",
  "tower-square-top-a": "/models/kenney/td/tower-square-top-a.glb",
  "weapon-ballista": "/models/kenney/td/weapon-ballista.glb",
  "weapon-cannon": "/models/kenney/td/weapon-cannon.glb",
  "weapon-turret": "/models/kenney/td/weapon-turret.glb",
  "weapon-ammo-arrow": "/models/kenney/td/weapon-ammo-arrow.glb",
  "weapon-ammo-cannonball": "/models/kenney/td/weapon-ammo-cannonball.glb",
  "weapon-ammo-bullet": "/models/kenney/td/weapon-ammo-bullet.glb",
  "ground-grass": "/models/kenney/nature/ground_grass.glb",
  "path-straight": "/models/kenney/nature/ground_pathStraight.glb",
  "path-corner": "/models/kenney/nature/ground_pathCorner.glb",
  "path-bend": "/models/kenney/nature/ground_pathBend.glb",
  "path-end": "/models/kenney/nature/ground_pathEnd.glb",
  "river-straight": "/models/kenney/nature/ground_riverStraight.glb",
  "river-corner": "/models/kenney/nature/ground_riverCorner.glb",
  "river-bend": "/models/kenney/nature/ground_riverBend.glb",
  "river-end": "/models/kenney/nature/ground_riverEnd.glb",
  "bridge-wood": "/models/kenney/nature/bridge_woodNarrow.glb",
  "tree-pine": "/models/kenney/nature/tree_pineSmallA.glb",
  "tree-pine-tall": "/models/kenney/nature/tree_pineDefaultA.glb",
  "tree-oak": "/models/kenney/nature/tree_oak.glb",
  "tree-round": "/models/kenney/nature/tree_default.glb",
  "tent-open": "/models/kenney/nature/tent_smallOpen.glb",
  "tent-detailed": "/models/kenney/nature/tent_detailedOpen.glb",
  "tent-closed": "/models/kenney/nature/tent_smallClosed.glb",
  "rock-small": "/models/kenney/nature/rock_smallA.glb",
  "rock-large": "/models/kenney/nature/rock_largeA.glb",
  "campfire": "/models/kenney/nature/campfire_logs.glb",
  "stump": "/models/kenney/nature/stump_round.glb",
  "mushroom": "/models/kenney/nature/mushroom_red.glb",
  "flower-red": "/models/kenney/nature/flower_redA.glb",
  "flower-yellow": "/models/kenney/nature/flower_yellowA.glb",
  lily: "/models/kenney/nature/lily_small.glb",
  sign: "/models/kenney/nature/sign.glb",
  "cliff-block": "/models/kenney/nature/cliff_block_rock.glb",
  "cliff-block-stone": "/models/kenney/nature/cliff_block_stone.glb",
  "cliff-large": "/models/kenney/nature/cliff_large_rock.glb",
  "cliff-face": "/models/kenney/nature/cliff_rock.glb",
  "cliff-corner": "/models/kenney/nature/cliff_corner_rock.glb",
  "cliff-slope": "/models/kenney/nature/cliff_blockSlope_rock.glb",
  "cliff-steps": "/models/kenney/nature/cliff_steps_rock.glb",
  "cliff-waterfall": "/models/kenney/nature/cliff_waterfall_rock.glb",
  "cliff-waterfall-top": "/models/kenney/nature/cliff_waterfallTop_rock.glb",
  "fence-simple": "/models/kenney/nature/fence_simple.glb",
  "fence-planks": "/models/kenney/nature/fence_planks.glb",
  "fence-corner": "/models/kenney/nature/fence_corner.glb",
  "fence-gate": "/models/kenney/nature/fence_gate.glb",
  "cactus-tall": "/models/kenney/nature/cactus_tall.glb",
  "cactus-short": "/models/kenney/nature/cactus_short.glb",
  palm: "/models/kenney/nature/tree_palm.glb",
  "palm-short": "/models/kenney/nature/tree_palmShort.glb",
  bush: "/models/kenney/nature/plant_bush.glb",
  "bush-large": "/models/kenney/nature/plant_bushLarge.glb",
  log: "/models/kenney/nature/log.glb",
  "log-stack": "/models/kenney/nature/log_stack.glb",
  "mushroom-group": "/models/kenney/nature/mushroom_redGroup.glb",
  "mushroom-tan": "/models/kenney/nature/mushroom_tanGroup.glb",
  "flower-purple": "/models/kenney/nature/flower_purpleA.glb",
  wheat: "/models/kenney/nature/crops_wheatStageB.glb",
  obelisk: "/models/kenney/nature/statue_obelisk.glb",
  "rock-tall": "/models/kenney/nature/rock_tallA.glb",
  "rock-peak": "/models/kenney/nature/rock_tallB.glb",
  "stump-old": "/models/kenney/nature/stump_old.glb",
  "campfire-stones": "/models/kenney/nature/campfire_stones.glb",
};

export const LIBRARY_BESTIARY_URLS: Record<string, string> = {
  "goblin-male": "/models/characters/goblin-male.gltf",
  "goblin-female": "/models/characters/goblin-female.gltf",
  "zombie-male": "/models/characters/zombie-male.gltf",
  "zombie-female": "/models/characters/zombie-female.gltf",
};

export const CUTTING_BOARD_URL = LIBRARY_FOOD_URLS["cutting-board"];

export function isUploadedAsset(ref: string) {
  return (
    ref.startsWith("http://") ||
    ref.startsWith("https://") ||
    ref.startsWith("data:") ||
    ref.startsWith("/api/") ||
    ref.startsWith("/")
  );
}

function bundledKenneyUrl(ref: string) {
  if (LIBRARY_FOOD_URLS[ref]) return LIBRARY_FOOD_URLS[ref];
  if (LIBRARY_CAR_URLS[ref]) return LIBRARY_CAR_URLS[ref];
  if (LIBRARY_TD_URLS[ref]) return LIBRARY_TD_URLS[ref];
  if (LIBRARY_BESTIARY_URLS[ref]) return LIBRARY_BESTIARY_URLS[ref];
  const file = ref.match(/(?:^|\/)([a-z0-9-]+)\.glb$/i)?.[1]?.toLowerCase();
  if (file && LIBRARY_FOOD_URLS[file]) return LIBRARY_FOOD_URLS[file];
  if (file && LIBRARY_CAR_URLS[file]) return LIBRARY_CAR_URLS[file];
  if (file && LIBRARY_TD_URLS[file]) return LIBRARY_TD_URLS[file];
  if (file && LIBRARY_BESTIARY_URLS[file]) return LIBRARY_BESTIARY_URLS[file];
  return "";
}

export function resolveRuntimeUrl(ref: string, assets: Record<string, string>) {
  if (!ref) return "";
  if (assets[ref]) return assets[ref];
  if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("data:")) return ref;
  const bundled = bundledKenneyUrl(ref);
  if (bundled && assets[bundled]) return assets[bundled];
  // Standalone HTML has no /public files. Empty assets = editor, where Next serves them.
  if (Object.keys(assets).length > 0) return "";
  if (bundled) return bundled;
  if (ref.startsWith("/")) {
    // Paths may already include %20 (Kenney packs). encodeURI would turn that into %2520.
    return /%[0-9A-Fa-f]{2}/.test(ref) ? ref : encodeURI(ref);
  }
  return "";
}

export function longCarUrl(ref: string, assets: Record<string, string>) {
  if (ref === "van" || ref === "truck") return resolveRuntimeUrl(ref, assets);
  if (ref.startsWith("/") || ref.startsWith("http") || ref.startsWith("data:")) {
    return resolveRuntimeUrl(ref, assets);
  }
  return resolveRuntimeUrl("van", assets);
}

export function libraryCarKind(ref: string): "sedan" | "suv" | "van" {
  if (ref === "suv") return "suv";
  if (ref === "van" || ref === "truck") return "van";
  return "sedan";
}

export const KENNEY_GRASS_URL = "/kenney_road-textures/PNG/Retina/roadTexture_25.png";
export const KENNEY_ASPHALT = "#344143";
export const KENNEY_PAVEMENT = "#bfd5d9";

export function loadTexture(url: string): Promise<Texture> {
  const hit = textureCache.get(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = 2;
        tex.wrapS = RepeatWrapping;
        tex.wrapT = RepeatWrapping;
        textureCache.set(url, tex);
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

/** Meshes that share a bone name steal the clip. Animation tracks bind by name. */
function uniqueMeshNames(root: Object3D) {
  const byName = new Map<string, Object3D[]>();
  root.traverse((obj) => {
    if (!obj.name) return;
    const list = byName.get(obj.name);
    if (list) list.push(obj);
    else byName.set(obj.name, [obj]);
  });
  for (const [name, list] of byName) {
    if (list.length < 2) continue;
    let n = 0;
    for (const obj of list) {
      if ((obj as Mesh).isMesh) obj.name = `${name}Mesh${++n}`;
    }
  }
}

export function loadGltfScene(url: string): Promise<Group> {
  const hit = gltfCache.get(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        uniqueMeshNames(gltf.scene);
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.userData.clips = gltf.animations;
        gltfCache.set(url, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      reject,
    );
  });
}

function isWheelMesh(mesh: Object3D) {
  let node: Object3D | null = mesh;
  while (node) {
    if (/wheel/i.test(node.name)) return true;
    node = node.parent;
  }
  return false;
}

const kenneyTintMaps = new Map<string, CanvasTexture>();
const hsl = { h: 0, s: 0, l: 0 };

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hue2rgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) return [l, l, l] as const;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)] as const;
}

/** Keep windows, chrome, tires, and lights; recolor the saturated body strips. */
function isKenneyTrimPixel(h: number, s: number, l: number) {
  if (l < 0.08) return true;
  if (s < 0.2) return true;
  const hue = h * 360;
  if (hue >= 38 && hue <= 72 && l > 0.38) return true;
  if (hue >= 185 && hue <= 235 && l > 0.32 && s < 0.58) return true;
  return false;
}

function tintKenneyColormap(source: Texture, tintHex: string) {
  const key = `${source.uuid}:${tintHex.toLowerCase()}`;
  const hit = kenneyTintMaps.get(key);
  if (hit) return hit;
  const image = source.image as CanvasImageSource | undefined;
  const width = Number((image as { width?: number } | undefined)?.width) || 0;
  const height = Number((image as { height?: number } | undefined)?.height) || 0;
  if (!image || !width || !height) return source;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return source;
  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  const { data } = pixels;
  new Color(tintHex).getHSL(hsl);
  const tintH = hsl.h;
  const tintS = hsl.s;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const pixel = rgbToHsl(r, g, b);
    if (isKenneyTrimPixel(pixel.h, pixel.s, pixel.l)) continue;
    const [nr, ng, nb] = hslToRgb(tintH, Math.min(1, Math.max(pixel.s, tintS * 0.72)), pixel.l);
    data[i] = Math.round(nr * 255);
    data[i + 1] = Math.round(ng * 255);
    data[i + 2] = Math.round(nb * 255);
  }
  ctx.putImageData(pixels, 0, 0);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = source.flipY;
  tex.wrapS = source.wrapS;
  tex.wrapT = source.wrapT;
  tex.magFilter = source.magFilter;
  tex.minFilter = source.minFilter;
  tex.needsUpdate = true;
  kenneyTintMaps.set(key, tex);
  return tex;
}

function prepareCarMaterial(source: MeshStandardMaterial, tint: string, isWheel: boolean) {
  const next = source.clone();
  next.side = DoubleSide;
  next.transparent = false;
  next.opacity = 1;
  const sourceMap = source.map;
  if (sourceMap) sourceMap.colorSpace = SRGBColorSpace;
  next.userData.kenneySourceMap = sourceMap ?? null;
  if (isWheel) {
    next.color.set("#ffffff");
    next.metalness = 0.12;
    next.roughness = 0.52;
    next.envMapIntensity = 0.4;
    if (sourceMap) next.map = sourceMap;
  } else if (sourceMap) {
    next.color.set("#ffffff");
    next.map = tintKenneyColormap(sourceMap, tint);
    next.metalness = 0.12;
    next.roughness = 0.28;
    next.envMapIntensity = 1.15;
  } else {
    next.color.set(tint);
    next.metalness = 0.12;
    next.roughness = 0.28;
    next.envMapIntensity = 1.15;
  }
  next.needsUpdate = true;
  return next;
}

export function tintCarMaterials(root: Object3D, tint: string) {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || isWheelMesh(mesh)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!(m instanceof MeshStandardMaterial)) continue;
      if (m.transparent || m.emissiveIntensity > 0.2) continue;
      const sourceMap = (m.userData.kenneySourceMap as Texture | null | undefined) ?? m.map;
      if (sourceMap) {
        m.map = tintKenneyColormap(sourceMap, tint);
        m.color.set("#ffffff");
      } else {
        m.color.set(tint);
      }
      m.needsUpdate = true;
    }
  });
}

export function cloneTintedModel(source: Object3D, tint: string, tracker: ResourceTracker): Group {
  const root = new Group();
  const cloned = source.clone(true);
  cloned.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const wheel = isWheelMesh(mesh);
    const next = mats.map((m) => {
      const prepared =
        m instanceof MeshStandardMaterial
          ? prepareCarMaterial(m, tint, wheel)
          : new MeshStandardMaterial({
              color: wheel ? "#1a1a1a" : tint,
              metalness: 0.12,
              roughness: 0.28,
              envMapIntensity: 1.15,
              side: DoubleSide,
            });
      tracker.track(prepared);
      return prepared;
    });
    mesh.material = next.length === 1 ? next[0] : next;
    mesh.frustumCulled = false;
  });
  root.add(cloned);
  return root;
}

export function cloneTexturedModel(source: Object3D, tracker: ResourceTracker): Group {
  const root = new Group();
  const cloned = source.clone(true);
  cloned.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((m) => {
      if (m instanceof MeshStandardMaterial) {
        const prepared = m.clone();
        prepared.metalness = Math.min(prepared.metalness, 0.15);
        prepared.side = DoubleSide;
        prepared.envMapIntensity = 0;
        if (prepared.map) prepared.map.colorSpace = SRGBColorSpace;
        prepared.needsUpdate = true;
        tracker.track(prepared);
        return prepared;
      }
      const fallback = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.55, metalness: 0, side: DoubleSide });
      tracker.track(fallback);
      return fallback;
    });
    mesh.material = next.length === 1 ? next[0] : next;
    mesh.frustumCulled = false;
  });
  root.add(cloned);
  return root;
}

export function cloneSkinnedModel(source: Object3D, tracker: ResourceTracker): Group {
  const root = new Group();
  const cloned = cloneSkeleton(source);
  cloned.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((m) => {
      if (m instanceof MeshStandardMaterial) {
        const prepared = m.clone();
        prepared.metalness = 0;
        prepared.metalnessMap = null;
        prepared.envMapIntensity = 0;
        if (prepared.map) prepared.map.colorSpace = SRGBColorSpace;
        if (prepared.emissiveMap) {
          prepared.emissive.set("#ffffff");
          prepared.emissiveIntensity = Math.max(prepared.emissiveIntensity, 1);
        }
        prepared.needsUpdate = true;
        tracker.track(prepared);
        return prepared;
      }
      const fallback = new MeshStandardMaterial({ color: "#6b3a3a", roughness: 0.6, metalness: 0 });
      tracker.track(fallback);
      return fallback;
    });
    mesh.material = next.length === 1 ? next[0] : next;
    mesh.frustumCulled = false;
  });
  root.add(cloned);
  root.userData.clips = source.userData.clips;
  root.userData.mixerRoot = cloned;
  return root;
}

export function orientCarAlongX(object: Object3D) {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  if (size.z > size.x) object.rotateY(Math.PI / 2);
}

function namedMeshCenters(root: Object3D, test: (name: string) => boolean) {
  const sum = new Vector3();
  let n = 0;
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !test(mesh.name.toLowerCase())) return;
    const center = new Box3().setFromObject(mesh).getCenter(new Vector3());
    root.worldToLocal(center);
    sum.add(center);
    n += 1;
  });
  return n ? sum.multiplyScalar(1 / n) : null;
}

/** Local XZ direction the car's nose points. */
export function inferCarForwardXZ(object: Object3D): Vector3 {
  const front = namedMeshCenters(
    object,
    (name) => /front|grill|bumper/.test(name) && !/back|rear/.test(name),
  );
  const back = namedMeshCenters(object, (name) => /back|rear/.test(name) && !/front/.test(name));
  if (front && back) {
    const dir = front.sub(back);
    dir.y = 0;
    if (dir.lengthSq() > 1e-8) return dir.normalize();
  }
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  if (size.x >= size.z) return new Vector3(1, 0, 0);
  return new Vector3(0, 0, 1);
}

/** Yaw so the car's nose points along world XZ (y ignored). */
export function yawObjectTowardXZ(object: Object3D, x: number, z: number) {
  const forward = inferCarForwardXZ(object);
  const current = Math.atan2(forward.x, forward.z);
  const wanted = Math.atan2(x, z);
  object.rotateY(wanted - current);
}

export function fitObjectToFootprint(object: Object3D, lengthX: number, widthZ: number) {
  object.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const sx = lengthX / Math.max(size.x, 1e-4);
  const sz = widthZ / Math.max(size.z, 1e-4);
  object.scale.x *= sx;
  object.scale.z *= sz;
  object.scale.y *= Math.min(sx, sz);
  const seated = new Box3().setFromObject(object);
  object.position.y -= seated.min.y;
}

export function fitObjectToMax(object: Object3D, maxSize: number) {
  object.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const longest = Math.max(size.x, size.y, size.z, 1e-4);
  object.scale.multiplyScalar(maxSize / longest);
  const seated = new Box3().setFromObject(object);
  object.position.y -= seated.min.y;
}

/** Uniform scale so width/depth match. Caps height so round snacks don't dwarf flat ones. */
export function fitObjectToXZ(object: Object3D, maxXZ: number, maxY = maxXZ) {
  object.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const footprint = Math.max(size.x, size.z, 1e-4);
  let s = maxXZ / footprint;
  if (size.y * s > maxY) s = maxY / Math.max(size.y, 1e-4);
  object.scale.multiplyScalar(s);
  const seated = new Box3().setFromObject(object);
  object.position.y -= seated.min.y;
}

function paintParkingExit(
  ctx: CanvasRenderingContext2D,
  size: number,
  cols: number,
  rows: number,
  exitRow: number,
  vPad: number,
) {
  const pad = Math.max(0, Math.min(0.4, vPad)) * size;
  const innerH = size - pad * 2;
  const cellW = size / cols;
  const cellH = innerH / rows;
  const er = Math.max(0, Math.min(rows - 1, exitRow));
  const cellX = (cols - 1) * cellW;
  const cellY = pad + er * cellH;
  const cx = cellX + cellW * 0.52;
  const cy = cellY + cellH * 0.5;
  ctx.fillStyle = "#ff3b30";
  for (let i = 0; i < 3; i++) {
    const ox = cx - 10 + i * 11;
    ctx.beginPath();
    ctx.moveTo(ox + 10, cy);
    ctx.lineTo(ox, cy - cellH * 0.18);
    ctx.lineTo(ox, cy + cellH * 0.18);
    ctx.closePath();
    ctx.fill();
  }
}

function paintParkingGrid(
  ctx: CanvasRenderingContext2D,
  size: number,
  cols: number,
  rows: number,
  exitRow: number,
  vPad: number,
) {
  const pad = Math.max(0, Math.min(0.4, vPad)) * size;
  const innerH = size - pad * 2;
  const cellW = size / cols;
  const cellH = innerH / rows;
  ctx.strokeStyle = "rgba(232, 236, 242, 0.78)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      ctx.strokeRect(c * cellW + 6, pad + r * cellH + 6, cellW - 12, cellH - 12);
    }
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(210, 216, 224, 0.9)";
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, size - 12, size - 12);

  paintParkingExit(ctx, size, cols, rows, exitRow, vPad);
}

export function createAsphaltTexture(cols: number, rows: number, exitRow: number, vPad = 0): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }

  ctx.fillStyle = KENNEY_ASPHALT;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 44 + Math.random() * 22;
    ctx.fillStyle = `rgba(${shade},${shade + 10},${shade + 12},${0.28 + Math.random() * 0.22})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  paintParkingGrid(ctx, size, cols, rows, exitRow, vPad);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}

/** Neutral warm grain. Tint with MeshStandardMaterial.color (trayColor). */
export function createWoodGrainTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }

  ctx.fillStyle = "#e8d5bc";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 16; i++) {
    const x = (i / 16) * size + Math.sin(i * 1.3) * 10;
    ctx.fillStyle = `rgba(90, 50, 20, ${0.035 + (i % 3) * 0.018})`;
    ctx.fillRect(x, 0, 4 + (i % 2) * 3, size);
  }

  for (let i = 0; i < 70; i++) {
    const x0 = Math.random() * size;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(110, 70, 30, ${0.06 + Math.random() * 0.1})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.8;
    ctx.moveTo(x0, 0);
    for (let y = 0; y <= size; y += 18) {
      ctx.lineTo(x0 + Math.sin(y * 0.018 + i * 0.4) * 12, y);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = 160 + Math.random() * 50;
    ctx.fillStyle = `rgba(${shade}, ${shade - 30}, ${shade - 55}, 0.12)`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 2;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Exit chevrons only — alpha 0 elsewhere so a full-background image shows through. */
export function createParkingGridTexture(cols: number, rows: number, exitRow: number, vPad = 0): CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new CanvasTexture(canvas);
    fallback.colorSpace = SRGBColorSpace;
    return fallback;
  }

  ctx.clearRect(0, 0, size, size);
  paintParkingExit(ctx, size, cols, rows, exitRow, vPad);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}
