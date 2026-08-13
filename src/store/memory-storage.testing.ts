/**
 * A `localStorage` that lives in a Map.
 *
 * Vitest runs in the `node` environment here — the deterministic core has no
 * DOM and adding jsdom to test it would be a large dependency bought for one
 * global. So the one global is provided instead.
 *
 * This was copy-pasted into five test files before it was extracted. Named
 * `.testing.ts` rather than `.test.ts` so the runner does not try to execute
 * it as a suite, and it is imported by tests only, so it never reaches a
 * bundle.
 */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  [name: string]: unknown;
}

/** Install a fresh one. Call from `beforeEach`, not once per file: a suite
 *  that shares storage between cases passes or fails on execution order. */
export function installMemoryStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
}
