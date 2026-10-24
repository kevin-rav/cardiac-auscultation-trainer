import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Torso3DViewer } from './test-3d.ts';

// Mock WebGLRenderer for jsdom headless testing via vi.hoisted
const { MockWebGLRenderer } = vi.hoisted(() => {
  class MockWebGLRenderer {
    public domElement: HTMLCanvasElement;
    public shadowMap = { enabled: false, type: 0 };
    public setSize = vi.fn();
    public setPixelRatio = vi.fn();
    public render = vi.fn();
    public dispose = vi.fn();

    constructor() {
      this.domElement = document.createElement('canvas');
      this.domElement.getBoundingClientRect = () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        bottom: 600,
        right: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      this.domElement.setPointerCapture = vi.fn();
      this.domElement.releasePointerCapture = vi.fn();
    }
  }

  return { MockWebGLRenderer };
});

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

describe('Torso3DViewer - Red-Dot Pin-Drop Raycasting', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Mock GLTFLoader.prototype.load via vi.spyOn to cleanly supply a mock torso mesh
    vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(
      (_url: string, onLoad: (data: GLTF) => void) => {
        const scene = new THREE.Group();
        scene.name = 'TorsoScene';

        // Create a box mesh to serve as the torso model
        const geometry = new THREE.BoxGeometry(1, 2, 0.5);
        const material = new THREE.MeshStandardMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'torso_mesh';
        scene.add(mesh);

        // Add mock anchor nodes
        const anchorAortic = new THREE.Object3D();
        anchorAortic.name = 'ANCHOR_AORTIC_VALVE';
        anchorAortic.position.set(-0.08, 0.44, 0.25);
        scene.add(anchorAortic);

        const mockGltf: GLTF = {
          scene,
          scenes: [scene],
          animations: [],
          cameras: [],
          asset: {},
          userData: {},
          parser: {} as GLTF['parser'],
        };

        onLoad(mockGltf);
      },
    );
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('initializes with pin-drop enabled by default and reports model coordinates on coordinate drop', () => {
    const onPinDrop = vi.fn();
    const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(vi.fn());
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
    const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(vi.fn());

    const viewer = new Torso3DViewer(container, {
      enablePinDrop: true,
      onPinDrop,
    });

    expect(viewer.isPinDropEnabled()).toBe(true);
    expect(viewer.getLastPinDrop()).toBeNull();

    // Drop pin at explicit model coordinates
    const pin = viewer.dropPinAtCoordinates(0.12, 0.34, 0.25);
    expect(pin).not.toBeNull();
    expect(pin?.modelPosition).toEqual([0.12, 0.34, 0.25]);

    // Verify onPinDrop callback
    expect(onPinDrop).toHaveBeenCalledTimes(1);
    expect(onPinDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPosition: [0.12, 0.34, 0.25],
      }),
    );

    // Verify console reporting
    expect(consoleGroupSpy).toHaveBeenCalledWith(
      expect.stringContaining('📍 Model Pin Dropped'),
      expect.any(String),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Model Coordinates (Local):',
      expect.objectContaining({ x: 0.12, y: 0.34, z: 0.25 }),
    );
    expect(consoleGroupEndSpy).toHaveBeenCalled();

    // Verify getLastPinDrop
    expect(viewer.getLastPinDrop()).toEqual(pin);

    viewer.destroy();
  });

  it('performs raycasting from screen pixels to the 3D model surface', () => {
    const onPinDrop = vi.fn();
    const viewer = new Torso3DViewer(container, {
      onPinDrop,
    });

    // Raycast through center of screen (400, 300) which points at (0, 0, 0)
    // The box is at center with front face at z = 0.25 * scale
    const pin = viewer.dropPinAtScreen(400, 300);
    expect(pin).not.toBeNull();
    if (pin) {
      expect(typeof pin.modelPosition[0]).toBe('number');
      expect(typeof pin.modelPosition[1]).toBe('number');
      expect(typeof pin.modelPosition[2]).toBe('number');
      expect(pin.normal).toBeDefined();
      expect(pin.distance).toBeGreaterThan(0);
    }

    expect(onPinDrop).toHaveBeenCalledTimes(1);
    expect(viewer.getLastPinDrop()).toBe(pin);

    viewer.destroy();
  });

  it('clears pin state and allows toggling pin-drop mode', () => {
    const viewer = new Torso3DViewer(container);

    viewer.dropPinAtCoordinates(-0.05, 0.2, 0.1);
    expect(viewer.getLastPinDrop()).not.toBeNull();

    // Clear pin
    viewer.clearPin();
    expect(viewer.getLastPinDrop()).toBeNull();

    // Toggle pin drop
    const newState = viewer.togglePinDrop();
    expect(newState).toBe(false);
    expect(viewer.isPinDropEnabled()).toBe(false);

    viewer.destroy();
  });

  it('handles click vs drag pointer events correctly', () => {
    const onPinDrop = vi.fn();
    const viewer = new Torso3DViewer(container, {
      onPinDrop,
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    if (!canvas) return;

    // Simulate a clean click (pointerdown then pointerup with < 5px delta)
    const downEvent = new PointerEvent('pointerdown', {
      clientX: 350,
      clientY: 250,
      bubbles: true,
    });
    const upEvent = new PointerEvent('pointerup', {
      clientX: 351,
      clientY: 250,
      bubbles: true,
    });

    canvas.dispatchEvent(downEvent);
    canvas.dispatchEvent(upEvent);

    expect(onPinDrop).toHaveBeenCalledTimes(1);

    // Simulate a drag (delta > 6px, e.g. OrbitControls orbit manipulation)
    onPinDrop.mockClear();
    const dragDownEvent = new PointerEvent('pointerdown', {
      clientX: 350,
      clientY: 250,
      bubbles: true,
    });
    const dragUpEvent = new PointerEvent('pointerup', {
      clientX: 420,
      clientY: 320,
      bubbles: true,
    });

    canvas.dispatchEvent(dragDownEvent);
    canvas.dispatchEvent(dragUpEvent);

    // Should NOT have dropped a pin on drag
    expect(onPinDrop).not.toHaveBeenCalled();

    viewer.destroy();
  });
});
