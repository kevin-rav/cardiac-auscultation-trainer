import { useRef, useState } from 'react';
import { HeartIcon, RotateCcwIcon, UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SceneView } from '../../scene';
import { SceneCanvas, type SceneCanvasHandle } from './SceneCanvas';

type LoadState =
  | { status: 'loading'; progress: number }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export function TrainerView() {
  const sceneRef = useRef<SceneCanvasHandle>(null);
  const [view, setView] = useState<SceneView>('chest');
  const [load, setLoad] = useState<LoadState>({ status: 'loading', progress: 0 });

  return (
    <main className="relative flex-1 overflow-hidden">
      <SceneCanvas
        ref={sceneRef}
        view={view}
        onProgress={(progress) => {
          setLoad((prev) => (prev.status === 'loading' ? { status: 'loading', progress } : prev));
        }}
        onLoaded={() => {
          setLoad({ status: 'ready' });
        }}
        onError={(error) => {
          setLoad({ status: 'error', message: error.message });
        }}
      />

      {load.status === 'loading' && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          role="status"
        >
          Loading heart model… {Math.round(load.progress * 100)}%
        </div>
      )}

      {load.status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p
            className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            Could not load the 3D models: {load.message}
          </p>
        </div>
      )}

      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            setView(view === 'chest' ? 'heart' : 'chest');
          }}
          aria-label={view === 'chest' ? 'Show heart' : 'Show chest'}
          title={view === 'chest' ? 'Show heart' : 'Show chest'}
          data-testid="toggle-view-btn"
        >
          {view === 'chest' ? <HeartIcon /> : <UserIcon />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => sceneRef.current?.resetCamera()}
          aria-label="Reset view"
          title="Reset view"
          data-testid="reset-view-btn"
        >
          <RotateCcwIcon />
        </Button>
      </div>
    </main>
  );
}
