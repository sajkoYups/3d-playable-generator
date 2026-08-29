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
import type { ResourceTracker } from "@/playable-runtime/three/resources";

const loadingManager = new LoadingManager();
let runtimeAssets: Record<string, string> = {};

export function setRuntimeAssets(assets: Record<string, string>) {
  runtimeAssets = assets;
}

loadingManager.setURLModifier((url) => {
  if (/colormap\.png(?:\?|$)/i.test(url)) {
    const bundled = "/models/kenney/food/colormap.png";
    return runtimeAssets[bundled] || bundled;
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
  const file = ref.match(/(?:^|\/)([a-z0-9-]+)\.glb$/i)?.[1]?.toLowerCase();
  if (file && LIBRARY_FOOD_URLS[file]) return LIBRARY_FOOD_URLS[file];
  if (file && LIBRARY_CAR_URLS[file]) return LIBRARY_CAR_URLS[file];
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
  if (ref.startsWith("/")) return encodeURI(ref);
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
  if (ref === "suv" || ref === "van") return ref;
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

export function loadGltfScene(url: string): Promise<Group> {
  const hit = gltfCache.get(url);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        gltf.scene.updateMatrixWorld(true);
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

function prepareCarMaterial(source: MeshStandardMaterial, tint: string, isWheel: boolean) {
  const next = source.clone();
  next.metalness = 0;
  next.roughness = 0.45;
  next.side = DoubleSide;
  next.envMapIntensity = 0;
  next.transparent = false;
  next.opacity = 1;
  if (next.map) next.map.colorSpace = SRGBColorSpace;
  if (isWheel) next.color.set(next.map ? "#ffffff" : "#1a1a1a");
  else next.color.set(tint);
  next.needsUpdate = true;
  return next;
}

export function tintCarMaterials(root: Object3D, tint: string) {
  const target = new Color(tint);
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || isWheelMesh(mesh)) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!(m instanceof MeshStandardMaterial)) continue;
      if (m.transparent || m.emissiveIntensity > 0.2) continue;
      m.color.copy(target);
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
              metalness: 0,
              roughness: 0.45,
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

export function orientCarAlongX(object: Object3D) {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  if (size.z > size.x) object.rotateY(Math.PI / 2);
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

  const er = Math.max(0, Math.min(rows - 1, exitRow));
  const cellX = (cols - 1) * cellW;
  const cellY = pad + er * cellH;
  const cx = cellX + cellW * 0.52;
  const cy = cellY + cellH * 0.5;
  ctx.fillStyle = "#e07a3d";
  for (let i = 0; i < 3; i++) {
    const ox = cx - 10 + i * 11;
    ctx.beginPath();
    ctx.moveTo(ox + 10, cy);
    ctx.lineTo(ox, cy - cellH * 0.18);
    ctx.lineTo(ox, cy + cellH * 0.18);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 2;
  tex.needsUpdate = true;
  return tex;
}
