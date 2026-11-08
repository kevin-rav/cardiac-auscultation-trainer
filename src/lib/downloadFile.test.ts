import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from './downloadFile';

// jsdom has no file support, so stand in for the browser's blob URL functions.
const createObjectURL = vi.fn(() => 'blob:fake-url');
const revokeObjectURL = vi.fn();

describe('downloadTextFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it('saves the text under the given file name and cleans up', () => {
    const downloads: string[] = [];
    const onClick = (event: Event): void => {
      event.preventDefault(); // stops jsdom from trying to navigate
      if (event.target instanceof HTMLAnchorElement) {
        downloads.push(event.target.download);
      }
    };

    document.addEventListener('click', onClick);
    try {
      downloadTextFile('my-quiz.json', '{}');
    } finally {
      document.removeEventListener('click', onClick);
    }

    expect(downloads).toEqual(['my-quiz.json']);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
