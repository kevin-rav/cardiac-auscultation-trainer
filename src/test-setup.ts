if (typeof window !== 'undefined') {
  // In Node 24+/25+, globalThis.localStorage defaults to an unbacked experimental object
  // without Storage methods (clear, getItem, setItem). Provide a conformant in-memory storage.
  if (typeof window.localStorage.clear !== 'function') {
    class MemoryStorage implements Storage {
      private readonly store = new Map<string, string>();
      get length(): number {
        return this.store.size;
      }
      clear(): void {
        this.store.clear();
      }
      getItem(key: string): string | null {
        return this.store.get(key) ?? null;
      }
      key(index: number): string | null {
        return Array.from(this.store.keys())[index] ?? null;
      }
      removeItem(key: string): void {
        this.store.delete(key);
      }
      setItem(key: string, value: string): void {
        this.store.set(key, value);
      }
    }
    const storage = new MemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    });
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
