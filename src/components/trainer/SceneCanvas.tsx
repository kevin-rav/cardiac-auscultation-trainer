import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { HeartScene, type HeartSceneOptions, type SceneView } from '../../scene';

export interface SceneCanvasHandle {
  resetCamera: () => void;
}

interface SceneCanvasProps extends Omit<HeartSceneOptions, 'view'> {
  view: SceneView;
  ref?: Ref<SceneCanvasHandle>;
}

export function SceneCanvas({ view, onProgress, onLoaded, onError, ref }: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HeartScene | null>(null);

  // The scene is created once per mount, so it reads callbacks through a ref
  // to always reach the latest props.
  const callbacksRef = useRef({ onProgress, onLoaded, onError });
  useEffect(() => {
    callbacksRef.current = { onProgress, onLoaded, onError };
  });

  // Read the initial view through a ref too; later changes go through setView.
  const initialViewRef = useRef(view);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new HeartScene(container, {
      view: initialViewRef.current,
      onProgress: (fraction) => callbacksRef.current.onProgress?.(fraction),
      onLoaded: () => callbacksRef.current.onLoaded?.(),
      onError: (error) => callbacksRef.current.onError?.(error),
    });
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setView(view);
  }, [view]);

  useImperativeHandle(ref, () => ({
    resetCamera: () => sceneRef.current?.resetCamera(),
  }));

  return <div ref={containerRef} className="absolute inset-0" data-testid="scene-canvas" />;
}
