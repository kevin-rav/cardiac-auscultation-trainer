import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {
  AuscultationPointDefinition,
  AuscultationPointId,
  AuscultationPointInstance,
  TorsoViewerOptions,
} from './types.ts';

// The model is served from public/, so resolve it against Vite's base URL to
// work under the GitHub Pages subpath as well as at / in dev.
export const DEFAULT_MODEL_URL = `${import.meta.env.BASE_URL}Auscultation_Torso_v1.glb`;

export const AUSCULTATION_POINTS: AuscultationPointDefinition[] = [
  {
    id: 'aortic',
    name: 'Aortic Area',
    anchorNodeName: 'ANCHOR_AORTIC_VALVE',
    landmark: '2nd Intercostal Space, Right Sternal Border',
    soundDescription: 'S2 louder than S1 (closure of aortic valve A2)',
    clinicalSignificance: 'Best site to detect Aortic Stenosis and Aortic Regurgitation',
    primaryCondition: 'Systolic ejection murmur of Aortic Stenosis radiates to carotids',
    color: '#ef4444',
    defaultPosition: [-0.08, 1.442, 0.264],
  },
  {
    id: 'pulmonic',
    name: 'Pulmonic Area',
    anchorNodeName: 'ANCHOR_PULMONIC_VALVE',
    landmark: '2nd Intercostal Space, Left Sternal Border',
    soundDescription: 'Physiological splitting of S2 during inspiration',
    clinicalSignificance:
      'Best site to hear Pulmonic Stenosis, Pulmonary Flow Murmur, and fixed S2 split (ASD)',
    primaryCondition: 'Systolic murmur of pulmonic valve stenosis or innocent flow',
    color: '#3b82f6',
    defaultPosition: [0.205, 1.446, 0.278],
  },
  {
    id: 'tricuspid',
    name: 'Tricuspid Area',
    anchorNodeName: 'ANCHOR_TRICUSPID_VALVE',
    landmark: '4th - 5th Intercostal Space, Left Lower Sternal Border',
    soundDescription: 'Tricuspid valve closure (T1 component of S1)',
    clinicalSignificance:
      'Best site for Tricuspid Regurgitation (increases with inspiration / Carvallo sign) and VSD',
    primaryCondition: 'Holosystolic murmur of tricuspid regurgitation or VSD',
    color: '#10b981',
    defaultPosition: [0.004, 1.109, 0.316],
  },
  {
    id: 'mitral',
    name: 'Mitral Area (Cardiac Apex)',
    anchorNodeName: 'ANCHOR_MITRAL_VALVE',
    landmark: '5th Intercostal Space, Left Midclavicular Line',
    soundDescription: 'S1 louder than S2 (M1 closure); point of maximal impulse (PMI)',
    clinicalSignificance:
      'Best site for Mitral Regurgitation (radiates to axilla), Mitral Stenosis, S3, and S4 gallops',
    primaryCondition:
      'Pansystolic murmur of Mitral Regurgitation; diastolic rumble of Mitral Stenosis',
    color: '#a855f7',
    defaultPosition: [0.321, 1.023, 0.299],
  },
];

export class Torso3DViewer {
  private readonly container: HTMLElement;
  private readonly options: TorsoViewerOptions;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;

  private torsoGroup!: THREE.Group;
  private modelRoot: THREE.Object3D | null = null;
  private readonly pointInstances = new Map<AuscultationPointId, AuscultationPointInstance>();
  private readonly pointButtonElements = new Map<AuscultationPointId, HTMLElement>();

  private selectedPointId: AuscultationPointId = 'aortic';
  private hoveredPointId: AuscultationPointId | null = null;
  private isAutoRotating = false;
  private isRotationLocked = false;
  private isDarkMode = true;
  private isWireframe = false;

  private readonly raycaster = new THREE.Raycaster();
  private readonly mouse = new THREE.Vector2();

  private animationFrameId: number | null = null;
  private isDestroyed = false;

  private readonly defaultCameraPosition = new THREE.Vector3(0, 0, 5.8);
  private readonly defaultControlsTarget = new THREE.Vector3(0, 0, 0);

  constructor(container: HTMLElement, options: TorsoViewerOptions = {}) {
    this.container = container;
    this.options = options;
    if (options.initialPoint) {
      this.selectedPointId = options.initialPoint;
    }
    if (typeof options.isDarkMode === 'boolean') {
      this.isDarkMode = options.isDarkMode;
    }
    if (typeof options.enableAutoRotate === 'boolean') {
      this.isAutoRotating = options.enableAutoRotate;
    }
    if (typeof options.lockRotation === 'boolean') {
      this.isRotationLocked = options.lockRotation;
    }

    this.initScene();
    this.initLights();
    this.bindEvents();
    this.startAnimationLoop();

    const modelToLoad = this.options.modelUrl ?? DEFAULT_MODEL_URL;
    this.loadModel(modelToLoad);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.isDarkMode ? 0x121212 : 0xf4f4f5);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / Math.max(height, 1);

    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1000);
    this.camera.position.copy(this.defaultCameraPosition);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Clear previous canvas if any
    const existingCanvas = this.container.querySelector('canvas');
    if (existingCanvas) {
      existingCanvas.remove();
    }
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 10.0;
    this.controls.target.copy(this.defaultControlsTarget);

    this.applyRotationConstraints();

    this.torsoGroup = new THREE.Group();
    this.scene.add(this.torsoGroup);
  }

  private initLights(): void {
    // Ambient light for base visibility (matching CON-XR)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    ambientLight.name = 'ambientLight';
    this.scene.add(ambientLight);

    // Key directional light with shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(5, 5, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    keyLight.name = 'keyLight';
    this.scene.add(keyLight);

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.4);
    fillLight.position.set(-5, -3, -4);
    fillLight.name = 'fillLight';
    this.scene.add(fillLight);

    // Overhead light
    const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
    topLight.position.set(0, 8, 2);
    topLight.name = 'topLight';
    this.scene.add(topLight);

    // Warm & Cool accent point lights (CON-XR signature touch)
    const warmLight = new THREE.PointLight(0xff9944, 0.9, 25);
    warmLight.position.set(3, 1, 3);
    warmLight.name = 'warmLight';
    this.scene.add(warmLight);

    const coolLight = new THREE.PointLight(0x4499ff, 0.7, 25);
    coolLight.position.set(-3, 1, 3);
    coolLight.name = 'coolLight';
    this.scene.add(coolLight);
  }

  private applyRotationConstraints(): void {
    if (this.isRotationLocked) {
      // Constrained frontal view for anatomical training
      this.controls.minPolarAngle = Math.PI * 0.35;
      this.controls.maxPolarAngle = Math.PI * 0.62;
      this.controls.minAzimuthAngle = -Math.PI * 0.32;
      this.controls.maxAzimuthAngle = Math.PI * 0.32;
    } else {
      // Free orbit for full examination
      this.controls.minPolarAngle = 0.1;
      this.controls.maxPolarAngle = Math.PI - 0.1;
      this.controls.minAzimuthAngle = -Infinity;
      this.controls.maxAzimuthAngle = Infinity;
    }
  }

  public loadModel(url: string): void {
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        if (this.isDestroyed) return;

        this.modelRoot = gltf.scene;

        // Auto-scale and center the torso (similar to CON-XR's Box3 logic)
        const box = new THREE.Box3().setFromObject(this.modelRoot);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const targetScale = 5.6 / maxDim;

        this.modelRoot.scale.setScalar(targetScale);
        this.modelRoot.position.set(
          -center.x * targetScale,
          -center.y * targetScale,
          -center.z * targetScale,
        );

        // Apply materials and shadows
        this.modelRoot.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const mat = child.material as unknown;
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.roughness = 0.7;
              mat.metalness = 0.1;
              mat.side = THREE.DoubleSide;
            }
          }
        });

        this.torsoGroup.add(this.modelRoot);
        this.torsoGroup.updateMatrixWorld(true);

        // Setup auscultation points and 3D visual markers
        this.setupAuscultationPoints();

        this.options.onModelLoaded?.();
        this.notifyPointSelected(this.selectedPointId);
      },
      (xhr) => {
        if (xhr.lengthComputable && xhr.total > 0) {
          const percent = Math.round((xhr.loaded / xhr.total) * 100);
          this.options.onLoadingProgress?.(percent);
        }
      },
      (error) => {
        console.error('Failed to load 3D torso model:', error);
        // If a custom URL failed, fall back to the bundled model.
        if (url !== DEFAULT_MODEL_URL) {
          console.log(`Attempting fallback load from ${DEFAULT_MODEL_URL}...`);
          this.loadModel(DEFAULT_MODEL_URL);
          return;
        }
        const err = error instanceof Error ? error : new Error(String(error));
        this.options.onError?.(err);
      },
    );
  }

  private setupAuscultationPoints(): void {
    if (!this.modelRoot) return;

    // Clear previous instances
    this.pointInstances.forEach((inst) => {
      this.torsoGroup.remove(inst.markerGroup);
      inst.markerSphere.geometry.dispose();
      (inst.markerSphere.material as THREE.Material).dispose();
      inst.markerRing.geometry.dispose();
      (inst.markerRing.material as THREE.Material).dispose();
    });
    this.pointInstances.clear();

    for (const def of AUSCULTATION_POINTS) {
      // Find the anchor object embedded in the GLB
      const anchorObj = this.modelRoot.getObjectByName(def.anchorNodeName) ?? null;
      const worldPos = new THREE.Vector3();

      if (anchorObj) {
        anchorObj.getWorldPosition(worldPos);
      } else {
        // Fallback default coordinate transformed by torso group
        worldPos.set(...def.defaultPosition);
        this.torsoGroup.localToWorld(worldPos);
      }

      // Convert world position to torsoGroup local space for parenting
      const localPos = worldPos.clone();
      this.torsoGroup.worldToLocal(localPos);

      // Create interactive 3D marker group
      const markerGroup = new THREE.Group();
      markerGroup.position.copy(localPos);
      markerGroup.name = `marker_${def.id}`;

      // Central glowing marker sphere
      const sphereGeo = new THREE.SphereGeometry(0.045, 20, 20);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(def.color),
        depthTest: true,
      });
      const markerSphere = new THREE.Mesh(sphereGeo, sphereMat);
      markerSphere.userData = { auscultationPointId: def.id, type: 'marker' };
      markerGroup.add(markerSphere);

      // Outer pulsing ring indicator
      const ringGeo = new THREE.RingGeometry(0.065, 0.085, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(def.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const markerRing = new THREE.Mesh(ringGeo, ringMat);
      markerRing.position.z = 0.01;
      markerGroup.add(markerRing);

      this.torsoGroup.add(markerGroup);

      const instance: AuscultationPointInstance = {
        definition: def,
        anchorObject: anchorObj,
        markerGroup,
        markerSphere,
        markerRing,
        worldPosition: worldPos,
        screenPosition: { x: 0, y: 0, visible: true },
      };

      this.pointInstances.set(def.id, instance);
    }

    this.updateMarkerVisuals();
  }

  public registerButtonElement(id: AuscultationPointId, element: HTMLElement): void {
    this.pointButtonElements.set(id, element);
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectAuscultationPoint(id);
    });
  }

  public selectAuscultationPoint(id: AuscultationPointId): void {
    if (!this.pointInstances.has(id)) return;
    this.selectedPointId = id;
    this.updateMarkerVisuals();
    this.notifyPointSelected(id);
  }

  private notifyPointSelected(id: AuscultationPointId): void {
    const inst = this.pointInstances.get(id);
    if (!inst) return;
    this.options.onPointSelected?.(inst.definition);

    // Update 2D button classes
    this.pointButtonElements.forEach((btn, btnId) => {
      if (btnId === id) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });
  }

  private updateMarkerVisuals(): void {
    this.pointInstances.forEach((inst, id) => {
      const isSelected = id === this.selectedPointId;
      const isHovered = id === this.hoveredPointId;

      const scale = isSelected ? 1.4 : isHovered ? 1.2 : 1.0;
      inst.markerSphere.scale.setScalar(scale);

      const sphereMat = inst.markerSphere.material as THREE.MeshBasicMaterial;
      if (isSelected) {
        sphereMat.color.set(0xffffff);
      } else {
        sphereMat.color.set(inst.definition.color);
      }
    });
  }

  private updateButtonPositions(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.pointInstances.forEach((inst, id) => {
      // Re-calculate world position of marker
      const pos = new THREE.Vector3();
      inst.markerGroup.getWorldPosition(pos);
      inst.worldPosition.copy(pos);

      // Project 3D coordinate to 2D screen coordinate
      const projected = pos.clone().project(this.camera);

      // Determine visibility: check camera depth clip and if facing front
      const isVisible = projected.z < 1.0;
      inst.screenPosition.visible = isVisible;

      // Convert NDC (-1 to +1) to container pixels
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      inst.screenPosition.x = x;
      inst.screenPosition.y = y;

      const btn = this.pointButtonElements.get(id);
      if (btn) {
        if (isVisible) {
          btn.style.display = 'flex';
          btn.style.left = `${String(Math.round(x))}px`;
          btn.style.top = `${String(Math.round(y))}px`;
        } else {
          btn.style.display = 'none';
        }
      }
    });
  }

  private startAnimationLoop(): void {
    const loop = (timestamp: number): void => {
      if (this.isDestroyed) return;
      this.animationFrameId = requestAnimationFrame(loop);

      this.controls.update();

      if (this.isAutoRotating) {
        this.torsoGroup.rotation.y += 0.005;
      }

      // Animate pulsing outer rings
      const pulseTime = timestamp * 0.003;
      this.pointInstances.forEach((inst, id) => {
        const isSelected = id === this.selectedPointId;
        const basePulse = Math.sin(pulseTime + (isSelected ? 2 : 0)) * 0.15 + 1.0;
        const ringScale = isSelected ? basePulse * 1.3 : basePulse;
        inst.markerRing.scale.setScalar(ringScale);

        // Make outer ring billboard towards the camera
        inst.markerRing.quaternion.copy(this.camera.quaternion);
      });

      this.updateButtonPositions();
      this.renderer.render(this.scene, this.camera);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
  }

  private readonly handleResize = (): void => {
    if (this.isDestroyed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const markerMeshes = Array.from(this.pointInstances.values()).map((p) => p.markerSphere);
    const intersects = this.raycaster.intersectObjects(markerMeshes, false);

    if (intersects.length > 0 && intersects[0]?.object.userData) {
      const hitId = (intersects[0].object.userData as { auscultationPointId?: AuscultationPointId })
        .auscultationPointId;
      if (hitId && hitId !== this.hoveredPointId) {
        this.hoveredPointId = hitId;
        this.renderer.domElement.style.cursor = 'pointer';
        this.updateMarkerVisuals();
      }
    } else if (this.hoveredPointId !== null) {
      this.hoveredPointId = null;
      this.renderer.domElement.style.cursor = 'default';
      this.updateMarkerVisuals();
    }
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const markerMeshes = Array.from(this.pointInstances.values()).map((p) => p.markerSphere);
    const intersects = this.raycaster.intersectObjects(markerMeshes, false);

    if (intersects.length > 0 && intersects[0]?.object.userData) {
      const hitId = (intersects[0].object.userData as { auscultationPointId?: AuscultationPointId })
        .auscultationPointId;
      if (hitId) {
        this.selectAuscultationPoint(hitId);
      }
    }
  };

  // Public control methods
  public resetCamera(): void {
    this.camera.position.copy(this.defaultCameraPosition);
    this.controls.target.copy(this.defaultControlsTarget);
    this.controls.reset();
    this.torsoGroup.rotation.set(0, 0, 0);
  }

  public toggleDarkMode(): boolean {
    this.isDarkMode = !this.isDarkMode;
    this.scene.background = new THREE.Color(this.isDarkMode ? 0x121212 : 0xf4f4f5);
    return this.isDarkMode;
  }

  public toggleAutoRotate(): boolean {
    this.isAutoRotating = !this.isAutoRotating;
    return this.isAutoRotating;
  }

  public toggleRotationLock(): boolean {
    this.isRotationLocked = !this.isRotationLocked;
    this.applyRotationConstraints();
    return this.isRotationLocked;
  }

  public toggleWireframe(): boolean {
    this.isWireframe = !this.isWireframe;
    if (this.modelRoot) {
      this.modelRoot.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat: unknown = child.material;
          const setWireframe = (m: unknown): void => {
            if (m && typeof m === 'object' && 'wireframe' in m) {
              (m as { wireframe: boolean }).wireframe = this.isWireframe;
            }
          };
          if (Array.isArray(mat)) {
            mat.forEach(setWireframe);
          } else {
            setWireframe(mat);
          }
        }
      });
    }
    return this.isWireframe;
  }

  public getSelectedPoint(): AuscultationPointDefinition | null {
    return this.pointInstances.get(this.selectedPointId)?.definition ?? null;
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);

    this.controls.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
