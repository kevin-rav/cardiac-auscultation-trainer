import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeartSceneOptions, SceneView } from '../../scene';
import { TrainerView } from './TrainerView';

// jsdom has no WebGL, so the Three.js scene is replaced with a recorder.
// vi.mock is hoisted above imports, so the fake is defined in vi.hoisted.
const { FakeHeartScene, scenes } = vi.hoisted(() => {
  const scenes: InstanceType<typeof FakeHeartScene>[] = [];

  class FakeHeartScene {
    readonly options: HeartSceneOptions;
    readonly setView = vi.fn<(view: SceneView) => void>();
    readonly resetCamera = vi.fn();
    readonly dispose = vi.fn();

    constructor(_container: HTMLElement, options: HeartSceneOptions = {}) {
      this.options = options;
      scenes.push(this);
    }
  }

  return { FakeHeartScene, scenes };
});

vi.mock('../../scene', () => ({ HeartScene: FakeHeartScene }));

function currentScene(): InstanceType<typeof FakeHeartScene> {
  const scene = scenes.at(-1);
  if (!scene) throw new Error('No scene was created');
  return scene;
}

describe('TrainerView', () => {
  beforeEach(() => {
    scenes.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it('creates the scene in chest view and disposes it on unmount', () => {
    const { unmount } = render(<TrainerView />);
    const scene = currentScene();
    expect(scene.options.view).toBe('chest');

    unmount();
    expect(scene.dispose).toHaveBeenCalledOnce();
  });

  it('shows load progress until the models are loaded', () => {
    render(<TrainerView />);
    const scene = currentScene();
    expect(screen.getByRole('status').textContent).toMatch(/0%/);

    act(() => {
      scene.options.onProgress?.(0.42);
    });
    expect(screen.getByRole('status').textContent).toMatch(/42%/);

    act(() => {
      scene.options.onLoaded?.();
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows an error when the models fail to load', () => {
    render(<TrainerView />);

    act(() => {
      currentScene().options.onError?.(new Error('404 heart.fbx'));
    });
    expect(screen.getByRole('alert').textContent).toMatch(/404 heart\.fbx/);
  });

  it('toggles between chest and heart views', () => {
    render(<TrainerView />);
    const scene = currentScene();
    const toggle = screen.getByTestId('toggle-view-btn');

    fireEvent.click(toggle);
    expect(scene.setView).toHaveBeenLastCalledWith('heart');
    expect(toggle.getAttribute('aria-label')).toBe('Show chest');

    fireEvent.click(toggle);
    expect(scene.setView).toHaveBeenLastCalledWith('chest');
  });

  it('resets the camera', () => {
    render(<TrainerView />);
    fireEvent.click(screen.getByTestId('reset-view-btn'));
    expect(currentScene().resetCamera).toHaveBeenCalledOnce();
  });
});
