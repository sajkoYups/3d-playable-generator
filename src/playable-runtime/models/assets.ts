import {
  Box3,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
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

const gltfLoader = new GLTFLoader();
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
};

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
  if (LIBRARY_CAR_URLS[ref]) return LIBRARY_CAR_URLS[ref];
  if (!/kenney_car-kit|\/models\/kenney\//i.test(ref)) return "";
  const file = ref.match(/(?:^|\/)([a-z0-9-]+)\.glb$/i)?.[1]?.toLowerCase();
  if (file && LIBRARY_CAR_URLS[file]) return LIBRARY_CAR_URLS[file];
  return "";
}

export function resolveRuntimeUrl(ref: string, assets: Record<string, string>) {
  if (!ref) return "";
  if (assets[ref]) return assets[ref];
  if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("data:")) return ref;
  const bundled = bundledKenneyUrl(ref);
  if (bundled) return bundled;
  if (ref.startsWith("/")) return encodeURI(ref);
  return "";
}

export function longCarUrl(ref: string, assets: Record<string, string>) {
  if (ref === "van" || ref === "truck") return resolveRuntimeUrl(ref, assets);
  if (ref.startsWith("/") || ref.startsWith("http") || ref.startsWith("data:")) {
    return resolveRuntimeUrl(ref, assets);
  }
  return LIBRARY_CAR_URLS.van;
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
