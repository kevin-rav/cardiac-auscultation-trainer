if (typeof window !== 'undefined') {
  // In Node 24+, globalThis.localStorage defaults to an unbacked experimental object.
  // Replace it with jsdom's window.localStorage so tests have full Web Storage API support.
  try {
    const jsdomStorage = window.localStorage;
    delete (globalThis as Record<string, unknown>)['localStorage'];
    (globalThis as Record<string, unknown>)['localStorage'] = jsdomStorage;
  } catch {
    // Fall back to existing localStorage if deletion is not allowed
  }

  class MockResizeObserver implements ResizeObserver {
    observe(): void {
      // No-op mock for jsdom environment
    }
    unobserve(): void {
      // No-op mock for jsdom environment
    }
    disconnect(): void {
      // No-op mock for jsdom environment
    }
  }

  window.ResizeObserver = MockResizeObserver;
}
