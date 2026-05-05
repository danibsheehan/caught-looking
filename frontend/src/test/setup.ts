import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

/** Recharts `ResponsiveContainer` measures the parent; jsdom defaults to 0×0 otherwise. */
beforeAll(() => {
  const stubRect: DOMRect = {
    width: 800,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: 800,
    x: 0,
    y: 0,
    toJSON() {
      return '';
    },
  };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => stubRect);

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
});
