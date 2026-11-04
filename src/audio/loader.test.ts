import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSampleUrl, SampleLoader } from './loader';

const PAGES_BASE = '/cardiac-auscultation-trainer/';

describe('resolveSampleUrl', () => {
  it('leaves root-relative URLs unchanged at the root base', () => {
    expect(resolveSampleUrl('/sounds/s1-apex.wav', '/')).toBe('/sounds/s1-apex.wav');
  });

  it('prefixes root-relative URLs with a subpath base', () => {
    expect(resolveSampleUrl('/sounds/s1-apex.wav', PAGES_BASE)).toBe(
      '/cardiac-auscultation-trainer/sounds/s1-apex.wav',
    );
  });

  it.each(['blob:http://localhost/abc', 'https://example.com/s1.wav'])(
    'leaves %s unchanged',
    (url) => {
      expect(resolveSampleUrl(url, PAGES_BASE)).toBe(url);
    },
  );
});

describe('SampleLoader', () => {
  const fetchFn = vi.fn<(url: string) => Promise<Response>>();
  const decodedBuffer = { duration: 1 } as AudioBuffer;
  const audioContext = {
    decodeAudioData: vi.fn(() => Promise.resolve(decodedBuffer)),
  } as unknown as AudioContext;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchFn);
    fetchFn.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('fetches samples under the deployed subpath', async () => {
    // Reproduces GitHub Pages, where the app is served from a subpath.
    vi.stubEnv('BASE_URL', PAGES_BASE);
    fetchFn.mockResolvedValue(new Response(new ArrayBuffer(8)));

    const buffer = await new SampleLoader(audioContext).loadSample(
      's1-apex',
      '/sounds/s1-apex.wav',
    );

    expect(fetchFn).toHaveBeenCalledWith('/cardiac-auscultation-trainer/sounds/s1-apex.wav');
    expect(buffer).toBe(decodedBuffer);
  });

  it('reports the URL it actually requested when loading fails', async () => {
    vi.stubEnv('BASE_URL', PAGES_BASE);
    fetchFn.mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' }));

    await expect(
      new SampleLoader(audioContext).loadSample('s1-apex', '/sounds/s1-apex.wav'),
    ).rejects.toThrow(
      'Failed to load audio sample "s1-apex" from /cardiac-auscultation-trainer/sounds/s1-apex.wav: 404',
    );
  });
});
