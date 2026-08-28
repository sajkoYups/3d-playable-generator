import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  ConeGeometry,
  Color,
  type Material,
} from "three";
import type { ResourceTracker } from "@/playable-runtime/three/resources";

function mat(color: string, finish: "matte" | "glossy" | "metallic" = "glossy") {
  return new MeshStandardMaterial({
    color: new Color(color),
    roughness: finish === "matte" ? 0.85 : finish === "metallic" ? 0.28 : 0.35,
    metalness: finish === "metallic" ? 0.75 : finish === "glossy" ? 0.15 : 0.05,
  });
}

function add(
  tracker: ResourceTracker,
  group: Group,
  geometry: BoxGeometry | SphereGeometry | CylinderGeometry | TorusGeometry | ConeGeometry,
  material: Material,
  x = 0,
  y = 0,
  z = 0,
  sx = 1,
  sy = 1,
  sz = 1,
) {
  tracker.track(geometry);
  tracker.track(material);
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  return mesh;
}

export function createProceduralModel(
  id: string,
  tracker: ResourceTracker,
  tint?: string,
): Group {
  const g = new Group();
  g.name = id;
  const c = tint || defaultColor(id);

  switch (id) {
    case "apple":
      add(tracker, g, new SphereGeometry(0.42, 16, 12), mat(c), 0, 0.1, 0);
      add(tracker, g, new CylinderGeometry(0.03, 0.04, 0.22, 8), mat("#3d2a18"), 0, 0.52, 0);
      break;
    case "banana":
      add(tracker, g, new CylinderGeometry(0.1, 0.12, 0.9, 10), mat(c), 0, 0.1, 0, 1, 1, 0.6);
      g.rotation.z = 0.4;
      break;
    case "bottle":
      add(tracker, g, new CylinderGeometry(0.18, 0.2, 0.55, 12), mat(c), 0, 0.05, 0);
      add(tracker, g, new CylinderGeometry(0.08, 0.1, 0.22, 10), mat(c), 0, 0.42, 0);
      add(tracker, g, new CylinderGeometry(0.09, 0.09, 0.06, 10), mat("#f3ede0"), 0, 0.55, 0);
      break;
    case "can":
      add(tracker, g, new CylinderGeometry(0.2, 0.2, 0.5, 16), mat(c));
      add(tracker, g, new CylinderGeometry(0.2, 0.2, 0.04, 16), mat("#d0d4dc"), 0, 0.27, 0);
      break;
    case "coin":
      add(tracker, g, new CylinderGeometry(0.32, 0.32, 0.06, 20), mat(c, "metallic"));
      g.rotation.x = Math.PI / 2;
      break;
    case "gem":
      add(tracker, g, new ConeGeometry(0.32, 0.28, 6), mat(c, "metallic"), 0, 0.22, 0);
      add(tracker, g, new ConeGeometry(0.32, 0.22, 6), mat(c, "metallic"), 0, -0.02, 0, 1, -1, 1);
      break;
    case "key":
      add(tracker, g, new TorusGeometry(0.16, 0.045, 8, 16), mat(c, "metallic"), -0.18, 0.05, 0);
      add(tracker, g, new BoxGeometry(0.42, 0.07, 0.07), mat(c, "metallic"), 0.18, 0.05, 0);
      add(tracker, g, new BoxGeometry(0.08, 0.16, 0.07), mat(c, "metallic"), 0.32, -0.02, 0);
      break;
    case "star": {
      const star = add(tracker, g, new ConeGeometry(0.22, 0.4, 5), mat(c, "metallic"), 0, 0.08, 0);
      star.rotation.y = Math.PI / 5;
      add(tracker, g, new ConeGeometry(0.22, 0.4, 5), mat(c, "metallic"), 0, 0.08, 0, 1, -1, 1);
      break;
    }
    case "donut":
      add(tracker, g, new TorusGeometry(0.28, 0.14, 10, 18), mat(c));
      break;
    case "hammer":
      add(tracker, g, new CylinderGeometry(0.05, 0.05, 0.7, 8), mat("#6b4f3a"), 0, -0.05, 0);
      add(tracker, g, new BoxGeometry(0.42, 0.18, 0.16), mat(c, "metallic"), 0, 0.32, 0);
      break;
    case "potion":
      add(tracker, g, new SphereGeometry(0.26, 14, 12), mat(c), 0, -0.02, 0);
      add(tracker, g, new CylinderGeometry(0.08, 0.12, 0.22, 10), mat("#f3ede0"), 0, 0.28, 0);
      break;
    case "crown":
      add(tracker, g, new CylinderGeometry(0.3, 0.34, 0.16, 8, 1, true), mat(c, "metallic"));
      add(tracker, g, new ConeGeometry(0.08, 0.16, 4), mat(c, "metallic"), 0, 0.18, 0.22);
      add(tracker, g, new ConeGeometry(0.08, 0.2, 4), mat(c, "metallic"), 0.22, 0.2, 0);
      add(tracker, g, new ConeGeometry(0.08, 0.16, 4), mat(c, "metallic"), -0.22, 0.2, 0);
      break;
    case "runner":
      add(tracker, g, new CylinderGeometry(0.18, 0.22, 0.5, 10), mat(c), 0, 0.55, 0);
      add(tracker, g, new SphereGeometry(0.18, 12, 10), mat("#f1c7a3"), 0, 0.95, 0);
      add(tracker, g, new BoxGeometry(0.12, 0.4, 0.12), mat("#2a2e3a"), -0.1, 0.12, 0);
      add(tracker, g, new BoxGeometry(0.12, 0.4, 0.12), mat("#2a2e3a"), 0.1, 0.12, 0);
      break;
    case "crate":
      add(tracker, g, new BoxGeometry(0.9, 0.9, 0.9), mat(c, "matte"));
      break;
    case "barrier":
      add(tracker, g, new BoxGeometry(1.4, 0.18, 0.18), mat(c), 0, 0.35, 0);
      add(tracker, g, new BoxGeometry(0.12, 0.7, 0.12), mat("#f3ede0"), -0.5, 0.1, 0);
      add(tracker, g, new BoxGeometry(0.12, 0.7, 0.12), mat("#f3ede0"), 0.5, 0.1, 0);
      break;
    case "cone":
      add(tracker, g, new ConeGeometry(0.28, 0.7, 12), mat(c));
      add(tracker, g, new CylinderGeometry(0.3, 0.3, 0.06, 12), mat("#f3ede0"), 0, -0.34, 0);
      break;
    case "sedan":
    case "suv":
    case "van":
    case "car":
      createCar(tracker, g, c, id === "suv" ? 1.15 : id === "van" ? 1.25 : 1);
      break;
    default:
      add(tracker, g, new BoxGeometry(0.6, 0.6, 0.6), mat(c));
  }

  return g;
}

function createCar(tracker: ResourceTracker, g: Group, color: string, bodyScale: number) {
  add(tracker, g, new BoxGeometry(1.8 * bodyScale, 0.38, 0.9), mat(color), 0, 0.28, 0);
  add(tracker, g, new BoxGeometry(1.0, 0.32, 0.82), mat("#d8e4ef"), 0.05, 0.52, 0);
  const wheel = (x: number, z: number) =>
    add(tracker, g, new CylinderGeometry(0.16, 0.16, 0.12, 10), mat("#1a1a1a"), x, 0.16, z);
  wheel(-0.5, 0.48);
  wheel(0.5, 0.48);
  wheel(-0.5, -0.48);
  wheel(0.5, -0.48);
  g.children.forEach((ch) => {
    if (ch instanceof Mesh && ch.geometry instanceof CylinderGeometry && ch.position.y < 0.2) {
      ch.rotation.x = Math.PI / 2;
    }
  });
}

function defaultColor(id: string) {
  const map: Record<string, string> = {
    apple: "#e85d4c",
    banana: "#f4c430",
    bottle: "#2bb5a0",
    can: "#8a8494",
    coin: "#e0b04a",
    gem: "#7c5cff",
    key: "#d4a017",
    star: "#f3ede0",
    donut: "#e07a3d",
    hammer: "#8a8494",
    potion: "#3d7cff",
    crown: "#e0b04a",
    runner: "#e07a3d",
    crate: "#8b5a2b",
    barrier: "#e85d4c",
    cone: "#e07a3d",
    sedan: "#e07a3d",
    suv: "#2bb5a0",
    van: "#7c5cff",
  };
  return map[id] || "#e07a3d";
}

export function blobShadow(tracker: ResourceTracker, radius = 0.5) {
  const g = new Group();
  const mesh = add(
    tracker,
    g,
    new CylinderGeometry(radius, radius, 0.02, 16),
    new MeshStandardMaterial({ color: "#000000", transparent: true, opacity: 0.28, roughness: 1 }),
    0,
    0.01,
    0,
  );
  mesh.receiveShadow = false;
  return g;
}
