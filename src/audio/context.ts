let sharedContext: AudioContext | null = null;

/**
 * Returns a singleton AudioContext instance, lazily created upon first call.
 */
export function getAudioContext(): AudioContext {
  if (typeof AudioContext === 'undefined') {
    throw new Error('Web Audio API AudioContext is not available in this environment');
  }
  sharedContext ??= new AudioContext();
  return sharedContext;
}

/**
 * Resumes the AudioContext timeline if it is suspended (e.g. by browser autoplay restrictions).
 */
export async function resumeAudioContext(ctx?: AudioContext): Promise<void> {
  const context = ctx ?? getAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
}

/**
 * Closes and resets the singleton AudioContext. Primarily used for test teardown.
 */
export async function closeAudioContext(): Promise<void> {
  if (sharedContext) {
    if (sharedContext.state !== 'closed') {
      await sharedContext.close();
    }
    sharedContext = null;
  }
}
