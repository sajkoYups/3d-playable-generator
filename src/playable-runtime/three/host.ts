import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  PointLight,
  Scene,
  WebGLRenderer,
} from "three";
import type { CameraConfig, LightingPreset, Orientation } from "@/types/project";
import { ResourceTracker } from "@/playable-runtime/three/resources";

const MAX_DPR = 2;

export class ThreeHost {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly tracker = new ResourceTracker();
  private lights: Array<AmbientLight | DirectionalLight | HemisphereLight | PointLight> = [];
  private raf = 0;
  private running = false;
  private onFrame: ((dt: number) => void) | null = null;
  private last = 0;
  readonly canvas: HTMLCanvasElement;

  constructor(container: HTMLElement) {
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(50, 1, 0.1, 200);
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = false;
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.touchAction = "none";
    container.appendChild(this.canvas);
    this.resize(container.clientWidth || 320, container.clientHeight || 568);
  }

  applyCamera(config: CameraConfig, orientation: Orientation, aspect: number) {
    this.camera.fov = orientation === "landscape" ? config.fov : config.fov;
    this.camera.aspect = aspect;
    this.camera.position.set(config.position.x, config.position.y, config.position.z);
    this.camera.lookAt(config.target.x, config.target.y, config.target.z);
    this.camera.updateProjectionMatrix();
  }

  applyLighting(preset: LightingPreset) {
    for (const light of this.lights) {
      this.scene.remove(light);
    }
    this.lights = [];

    const add = <T extends AmbientLight | DirectionalLight | HemisphereLight | PointLight>(light: T) => {
      this.scene.add(light);
      this.lights.push(light);
      return light;
    };

    this.scene.background = null;

    if (preset === "sunset") {
      add(new HemisphereLight(0xffc58f, 0x2a1a3a, 0.7));
      const dir = add(new DirectionalLight(0xffd0a0, 1.1));
      dir.position.set(6, 8, 4);
      return;
    }
    if (preset === "overcast") {
      add(new HemisphereLight(0xcfe4ff, 0x4a5568, 0.9));
      const dir = add(new DirectionalLight(0xffffff, 0.45));
      dir.position.set(2, 10, 2);
      return;
    }
    if (preset === "neon") {
      add(new AmbientLight(0x221133, 0.5));
      const a = add(new PointLight(0xff4d8d, 18, 40));
      a.position.set(-6, 4, 4);
      const b = add(new PointLight(0x2ee6ff, 18, 40));
      b.position.set(6, 3, 2);
      const dir = add(new DirectionalLight(0xffffff, 0.25));
      dir.position.set(0, 8, 6);
      return;
    }

    add(new HemisphereLight(0xf3ede0, 0x2a2e3a, 0.55));
    const dir = add(new DirectionalLight(0xffffff, 0.95));
    dir.position.set(5, 10, 6);
  }

  setBackgroundColor(hex: string) {
    this.scene.background = new Color(hex);
  }

  resize(width: number, height: number) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  start(onFrame: (dt: number) => void) {
    this.onFrame = onFrame;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.onFrame?.(dt);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.pause();
    this.tracker.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
