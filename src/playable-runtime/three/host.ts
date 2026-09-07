import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  Scene,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
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
      add(new HemisphereLight(0xcfe4ff, 0x4a5568, 1.05));
      const dir = add(new DirectionalLight(0xffffff, 0.7));
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

  /** Parking Jam lighting: each preset keeps volume, with a different mood. */
  applyParkingJamLighting(preset: LightingPreset) {
    for (const light of this.lights) this.scene.remove(light);
    this.lights = [];
    this.scene.background = null;
    const add = <T extends AmbientLight | DirectionalLight | HemisphereLight | PointLight>(light: T) => {
      this.scene.add(light);
      this.lights.push(light);
      return light;
    };

    if (preset === "sunset") {
      add(new HemisphereLight(0xffc38a, 0x3a1c3a, 0.42));
      const key = add(new DirectionalLight(0xffd0a0, 1.45));
      key.position.set(-8, 6, 5);
      const fill = add(new DirectionalLight(0x6a4a88, 0.28));
      fill.position.set(7, 4, -4);
      this.setEnvironmentMood("sunset");
      return;
    }
    if (preset === "overcast") {
      add(new HemisphereLight(0xd7e4f2, 0x4a5568, 0.82));
      const key = add(new DirectionalLight(0xf2f6fb, 0.55));
      key.position.set(-4, 10, 3);
      const fill = add(new DirectionalLight(0xc5d0dc, 0.22));
      fill.position.set(5, 6, -2);
      this.setEnvironmentMood("overcast");
      return;
    }
    if (preset === "neon") {
      add(new AmbientLight(0x1a1028, 0.22));
      const a = add(new PointLight(0xff4d8d, 6, 0, 0));
      a.position.set(-4.5, 3, 3);
      const b = add(new PointLight(0x2ee6ff, 6, 0, 0));
      b.position.set(4.5, 2.6, 1.2);
      const key = add(new DirectionalLight(0xdfe8ff, 0.3));
      key.position.set(-5, 8, 4);
      this.setEnvironmentMood("neon");
      return;
    }

    add(new HemisphereLight(0xf7f1e8, 0x2c3540, 0.38));
    const key = add(new DirectionalLight(0xfff1dd, 1.55));
    key.position.set(-9, 7, 4);
    const fill = add(new DirectionalLight(0xb9c9dc, 0.22));
    fill.position.set(7, 4, -4);
    this.setEnvironmentMood("studio");
  }

  enableStudioEnvironment() {
    if (this.scene.environment) return;
    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    this.scene.environment = env.texture;
    this.tracker.trackTarget(env);
    room.dispose();
    pmrem.dispose();
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.setEnvironmentMood("studio");
  }

  setEnvironmentMood(preset: LightingPreset) {
    if (preset === "sunset") {
      this.scene.environmentIntensity = 0.5;
      this.renderer.toneMappingExposure = 1.12;
      return;
    }
    if (preset === "overcast") {
      this.scene.environmentIntensity = 0.28;
      this.renderer.toneMappingExposure = 1.0;
      return;
    }
    if (preset === "neon") {
      this.scene.environmentIntensity = 0.18;
      this.renderer.toneMappingExposure = 1.2;
      return;
    }
    this.scene.environmentIntensity = 0.9;
    this.renderer.toneMappingExposure = 1.05;
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
      try {
        this.onFrame?.(dt);
      } catch {
        /* keep the loop alive so round payouts can finish */
      }
      try {
        this.renderer.render(this.scene, this.camera);
      } catch {
        /* WebGL hiccup during rebuild */
      }
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
    this.scene.environment = null;
    this.tracker.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
