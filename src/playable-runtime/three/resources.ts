import type { BufferGeometry, Material, Texture, Object3D, WebGLRenderTarget } from "three";

type Disposable = {
  dispose?: () => void;
};

/**
 * Tracks GPU resources so destroy() can release them.
 * Three.js does not free GPU memory on garbage collection.
 *
 * Do not track geometries or textures that belong to the GLTF cache —
 * disposing those on preview restart leaves cached cars black/invisible.
 */
export class ResourceTracker {
  private resources = new Set<Disposable>();

  track<T extends Disposable>(resource: T): T {
    if (!resource) return resource;
    this.resources.add(resource);
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
