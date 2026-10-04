import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('./components/trainer/SceneCanvas', () => ({ SceneCanvas: () => null }));

describe('App', () => {
  afterEach(() => {
    cleanup();
    window.history.pushState({}, '', '/');
  });

  it('renders the heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /Cardiac Auscultation Trainer/i,
    );
  });

  it('navigates to Audio Tuner on nav link click', () => {
    render(<App />);
    const tunerNavBtn = screen.getByTestId('nav-tuner');
    fireEvent.click(tunerNavBtn);

    expect(screen.getByRole('heading', { name: /Audio Filter & Sound Tuner/i })).toBeDefined();

    const mainNavBtn = screen.getByTestId('nav-main');
    fireEvent.click(mainNavBtn);

    expect(screen.getByText(/Welcome to the Cardiac Auscultation Trainer/i)).toBeDefined();
  });

  it('renders the trainer on the dev route', () => {
    window.history.pushState({}, '', '/dev/trainer');
    render(<App />);
    expect(screen.getByTestId('toggle-view-btn')).toBeDefined();
  });
});
