import { describe, expect, it } from 'vitest';

describe('app', () => {
  it('renders the heading', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    await import('./main');
    expect(document.querySelector('h1')?.textContent).toBe('Cardiac Auscultation Trainer');
  });
});
