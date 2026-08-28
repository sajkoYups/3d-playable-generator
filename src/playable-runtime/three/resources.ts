import type { BufferGeometry, Material, Texture, Object3D, WebGLRenderTarget } from "three";

type Disposable = {
  dispose?: () => void;
};

function isMaterial(obj: Disposable): obj is Material {
  return Boolean(obj) && "isMaterial" in obj;
}

/**
 * Tracks GPU resources so destroy() can release them.
 * Three.js does not free GPU memory on garbage collection.
 */
export class ResourceTracker {
  private resources = new Set<Disposable>();

  track<T extends Disposable>(resource: T): T {
    if (!resource) return resource;
    this.resources.add(resource);
    if (isMaterial(resource)) {
      const mat = resource as Material & Record<string, unknown>;
      for (const key of Object.keys(mat)) {
        const value = mat[key];
        if (value && typeof value === "object" && "isTexture" in (value as object)) {
          this.resources.add(value as Disposable);
        }
      }
    }
    return resource;
  }

  trackObject(object: Object3D) {
    object.traverse((child) => {
      const mesh = child as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
      if (mesh.geometry) this.track(mesh.geometry);
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) this.track(m);
      }
    });
  }

  trackTexture(tex: Texture) {
    this.track(tex);
  }

  trackTarget(rt: WebGLRenderTarget) {
    this.track(rt);
  }

  dispose() {
    for (const resource of this.resources) {
      try {
        resource.dispose?.();
      } catch {
        /* ignore */
      }
    }
    this.resources.clear();
  }
}
