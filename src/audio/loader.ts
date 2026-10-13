import type { Manifest } from '../engine/schema';

export class SampleLoader {
  private readonly bufferCache = new Map<string, AudioBuffer>();
  private readonly inFlightLoads = new Map<string, Promise<AudioBuffer>>();
  private readonly audioContext: AudioContext;

  public constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Preloads and decodes an individual audio file from a URL.
   * Throws an error if the URL is missing, cannot be fetched, or cannot be decoded.
   */
  public async loadSample(id: string, url: string): Promise<AudioBuffer> {
    if (!url) {
      throw new Error(`Missing audio URL for sample ID "${id}"`);
    }

    const cached = this.bufferCache.get(id);
    if (cached) {
      return cached;
    }

    const inFlight = this.inFlightLoads.get(id);
    if (inFlight) {
      return inFlight;
    }

    const loadPromise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to load audio sample "${id}" from ${url}: ${response.status.toString()} ${response.statusText}`,
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.bufferCache.set(id, decodedBuffer);
        return decodedBuffer;
      } finally {
        this.inFlightLoads.delete(id);
      }
    })();

    this.inFlightLoads.set(id, loadPromise);
    return loadPromise;
  }

  /**
   * Preloads all samples listed in an audio Manifest.
   * Rejects immediately if any required sample fails to load.
   */
  public async preloadManifest(manifest: Manifest): Promise<void> {
    await Promise.all(
      manifest.samples.map(async (sample) => {
        await this.loadSample(sample.id, sample.url);
      }),
    );
  }

  /**
   * Retrieves a cached decoded AudioBuffer by sample ID.
   */
  public getBuffer(id: string): AudioBuffer | undefined {
    return this.bufferCache.get(id);
  }

  /**
   * Stores a pre-decoded buffer in the cache (useful for custom audio uploads or unit tests).
   */
  public setBuffer(id: string, buffer: AudioBuffer): void {
    this.bufferCache.set(id, buffer);
  }

  /**
   * Clears the sample cache.
   */
  public clear(): void {
    this.bufferCache.clear();
    this.inFlightLoads.clear();
  }
}
