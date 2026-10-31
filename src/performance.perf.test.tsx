import React from 'react';
import { render, screen } from '@testing-library/react';
import { RackPanel } from './components/RackPanel';
import { buildModel } from './model';
import { DEFAULT_OPTIONS } from './types';
import { loadFixture } from './testing/fixtures';
import { panelProps } from './testing/panel';

// Performance budget: large.csv, 30 racks and 1000 devices, drawn in less than 100 ms after
// the first mount. Run apart and in band with `npm run test:perf`: timings mean nothing while other tests share the CPU.
// Each measure is the best of five after a warm-up, the least disturbed by the rest of the machine.

const best = (run: () => void) => {
  run();
  return Math.min(
    ...Array.from({ length: 5 }, () => {
      const start = performance.now();
      run();
      return performance.now() - start;
    })
  );
};

describe('large.csv', () => {
  const frames = loadFixture('large');

  it('is laid out in a fraction of the budget', () => {
    const options = { ...DEFAULT_OPTIONS, racks: [] };
    const model = buildModel(frames, options);
    expect(model.racks).toHaveLength(30);
    expect(model.racks.reduce((n, r) => n + r.front.length + r.zeroU.length, 0)).toBe(1000);
    expect(model.errors).toEqual([]);
    expect(best(() => buildModel(frames, options))).toBeLessThan(20);
  });

  it('is drawn in less than 100 ms on a refresh', () => {
    const { rerender } = render(<RackPanel {...panelProps(frames)} />);
    // New data, as on a dashboard refresh: everything is laid out and drawn again.
    const time = best(() =>
      rerender(<RackPanel {...panelProps(frames.map((f) => ({ ...f, fields: [...f.fields] })))} />)
    );
    expect(screen.getAllByTestId(/^rack-DC1-/)).toHaveLength(30);
    expect(time).toBeLessThan(100);
  });
});
