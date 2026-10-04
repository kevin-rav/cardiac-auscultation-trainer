import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export type SceneView = 'chest' | 'heart';

export interface HeartSceneOptions {
  view?: SceneView;
  /** Combined download progress of all scene assets, 0 to 1. */
  onProgress?: (fraction: number) => void;
  onLoaded?: () => void;
  onError?: (error: Error) => void;
}

const MODEL_URLS = {
  heart: `${import.meta.env.BASE_URL}models/heart.fbx`,
  chest: `${import.meta.env.BASE_URL}models/chest.fbx`,
  heartTexture: `${import.meta.env.BASE_URL}models/heart-texture.jpg`,
};

const CAMERA_POSITIONS: Record<SceneView, THREE.Vector3> = {
  heart: new THREE.Vector3(0, 0, 6),
  chest: new THREE.Vector3(0, 0, 8),
};

/**
 * Owns the Three.js renderer, camera, controls, and models for the trainer.
 * Has no React dependency: a component creates one per mount and calls
 * dispose() on unmount.
 */
export class HeartScene {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly resizeObserver: ResizeObserver;
  private readonly heartGroup = new THREE.Group();
  private readonly chestGroup = new THREE.Group();
  private readonly options: HeartSceneOptions;
  private view: SceneView;
  private disposed = false;

  constructor(container: HTMLElement, options: HeartSceneOptions = {}) {
    this.container = container;
    this.options = options;
    this.view = options.view ?? 'chest';

    const { width, height } = this.containerSize();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

    // Transparent so the page background, and its light or dark theme, shows through.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = false;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 10;
    // Allow a slight tilt and about 54 degrees of turn either way.
    this.controls.minPolarAngle = Math.PI * 0.35;
    this.controls.maxPolarAngle = Math.PI * 0.6;
    this.controls.minAzimuthAngle = -Math.PI * 0.3;
    this.controls.maxAzimuthAngle = Math.PI * 0.3;

    this.addLighting();
    this.scene.add(this.heartGroup, this.chestGroup);
    this.applyView();

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(container);

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });

    void this.loadModels();
  }

  setView(view: SceneView): void {
    if (view === this.view) return;
    this.view = view;
    this.applyView();
  }

  resetCamera(): void {
    this.controls.reset();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private containerSize(): { width: number; height: number } {
    // Fall back to 1x1 so the camera aspect is never NaN before layout.
    return {
      width: Math.max(this.container.clientWidth, 1),
      height: Math.max(this.container.clientHeight, 1),
    };
  }

  private handleResize(): void {
    const { width, height } = this.containerSize();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private applyView(): void {
    this.heartGroup.visible = this.view === 'heart';
    this.chestGroup.visible = this.view === 'chest';

    this.camera.position.copy(CAMERA_POSITIONS[this.view]);
    this.controls.target.set(0, 0, 0);
    // Make this the position resetCamera() returns to.
    this.controls.saveState();
    this.controls.update();
  }

  private async loadModels(): Promise<void> {
    const progress = new Map<string, number>();
    const trackProgress = (url: string) => (event: ProgressEvent) => {
      if (!event.lengthComputable) return;
      progress.set(url, event.loaded / event.total);
      const total = [...progress.values()].reduce((sum, p) => sum + p, 0);
      this.options.onProgress?.(total / Object.keys(MODEL_URLS).length);
    };

    const fbxLoader = new FBXLoader();
    const textureLoader = new THREE.TextureLoader();

    try {
      const [heart, chest, heartTexture] = await Promise.all([
        fbxLoader.loadAsync(MODEL_URLS.heart, trackProgress(MODEL_URLS.heart)),
        fbxLoader.loadAsync(MODEL_URLS.chest, trackProgress(MODEL_URLS.chest)),
        textureLoader.loadAsync(MODEL_URLS.heartTexture, trackProgress(MODEL_URLS.heartTexture)),
      ]);

      if (this.disposed) {
        disposeObject(heart);
        disposeObject(chest);
        heartTexture.dispose();
        return;
      }

      heartTexture.colorSpace = THREE.SRGBColorSpace;
      this.setUpHeart(heart, heartTexture);
      this.setUpChest(chest);
      this.options.onLoaded?.();
    } catch (err) {
      if (this.disposed) return;
      this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private setUpHeart(heart: THREE.Group, texture: THREE.Texture): void {
    heart.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = new THREE.MeshPhongMaterial({
          map: texture,
          color: 0xffffff,
          emissive: 0x221111,
          shininess: 80,
          side: THREE.DoubleSide,
        });
      }
    });
    fitToSize(heart, 5);
    heart.position.y += 0.2;
    this.heartGroup.add(heart);
  }

  private setUpChest(chest: THREE.Group): void {
    chest.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshPhongMaterial({
          color: 0xb88e79,
          shininess: 10,
          side: THREE.DoubleSide,
        });
      }
    });
    fitToSize(chest, 6);
    this.chestGroup.add(chest);
  }

  private addLighting(): void {
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(5, 5, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);

    const fill = new THREE.DirectionalLight(0xffffff, 1.5);
    fill.position.set(-5, -5, -5);

    const top = new THREE.DirectionalLight(0xffffff, 1.0);
    top.position.set(0, 10, 0);

    const bottom = new THREE.DirectionalLight(0xffffff, 0.8);
    bottom.position.set(0, -10, 0);

    const front = new THREE.PointLight(0xff0066, 1.0, 50);
    front.position.set(0, 0, 3);

    const warm = new THREE.PointLight(0xffaa44, 0.8, 30);
    warm.position.set(3, 0, 0);

    const cool = new THREE.PointLight(0x4488ff, 0.6, 30);
    cool.position.set(-3, 0, 0);

    this.scene.add(
      new THREE.AmbientLight(0xffffff, 0.8),
      key,
      fill,
      top,
      bottom,
      front,
      warm,
      cool,
    );
  }
}

/** Scale an object so its largest dimension is `size`, and center it on the origin. */
function fitToSize(object: THREE.Object3D, size: number): void {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const dimensions = box.getSize(new THREE.Vector3());
  const scale = size / Math.max(dimensions.x, dimensions.y, dimensions.z);
  object.scale.setScalar(scale);
  object.position.copy(center).multiplyScalar(-scale);
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!isMesh(child)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshPhongMaterial) material.map?.dispose();
      material.dispose();
    }
  });
}

// instanceof alone narrows to Mesh<any>; this guard gives the default type arguments.
function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return object instanceof THREE.Mesh;
}
