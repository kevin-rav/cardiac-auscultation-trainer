import type { Manifest } from '../engine/schema';

export class SampleLoader {
  private readonly bufferCache = new Map<string, AudioBuffer>();
  private readonly audioContext: AudioContext;

  public constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Preloads and decodes an individual audio file from a URL.
   */
  public async loadSample(id: string, url: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(id);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to load audio sample ${id} from ${url}: ${response.statusText}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.bufferCache.set(id, decodedBuffer);
      return decodedBuffer;
    } catch (err) {
      console.error(`Error decoding audio sample ${id} from ${url}:`, err);
      return null;
    }
  }

  /**
   * Preloads all samples listed in an audio Manifest.
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
  }
}
