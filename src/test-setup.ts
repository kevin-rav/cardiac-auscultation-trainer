if (typeof window !== 'undefined') {
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
