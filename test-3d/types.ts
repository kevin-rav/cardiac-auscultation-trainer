import type * as THREE from 'three';

export type AuscultationPointId = 'aortic' | 'pulmonic' | 'tricuspid' | 'mitral';

export interface AuscultationPointDefinition {
  id: AuscultationPointId;
  name: string;
  anchorNodeName: string;
  landmark: string;
  soundDescription: string;
  clinicalSignificance: string;
  primaryCondition: string;
  color: string;
  defaultPosition: [number, number, number];
}

export interface AuscultationPointInstance {
  definition: AuscultationPointDefinition;
  anchorObject: THREE.Object3D | null;
  markerGroup: THREE.Group;
  markerSphere: THREE.Mesh;
  markerRing: THREE.Mesh;
  worldPosition: THREE.Vector3;
  screenPosition: { x: number; y: number; visible: boolean };
}

export interface TorsoViewerOptions {
  modelUrl?: string;
  initialPoint?: AuscultationPointId;
  enableAutoRotate?: boolean;
  lockRotation?: boolean;
  isDarkMode?: boolean;
  onPointSelected?: (point: AuscultationPointDefinition) => void;
  onLoadingProgress?: (progress: number) => void;
  onModelLoaded?: () => void;
  onError?: (error: Error) => void;
}
