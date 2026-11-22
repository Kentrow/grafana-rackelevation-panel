import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('follows the pointer without drawing the racks again', () => {
    render(<RackPanel {...panelProps(frames)} />);
    const devices = [...document.querySelectorAll('[data-device] rect')].slice(0, 40);
    let i = 0;
    // From device to device: the card changes, the racks stay as they are.
    const change =
      best(() => devices.forEach((d) => fireEvent.mouseMove(d, { clientX: 10 + (i++ % 7), clientY: 10 }))) / 40;
    // Within a device: only the card moves, nothing is rendered again.
    const within =
      best(() => devices.forEach((_, k) => fireEvent.mouseMove(devices[0], { clientX: 10 + k, clientY: 10 }))) / 40;
    expect(change).toBeLessThan(2);
    expect(within).toBeLessThan(1);
  });

  it('changes the highlight in less than 60 ms', () => {
    const { rerender } = render(<RackPanel {...panelProps(frames, {}, { device: [] })} />);
    let n = 0;
    // A family of devices with a wildcard, a different rack each time.
    const time = best(() =>
      rerender(
        <RackPanel {...panelProps(frames, {}, { device: [`DC1-R${String((n++ % 9) + 1).padStart(2, '0')}-*`] })} />
      )
    );
    expect(document.querySelectorAll('[data-emphasis="highlight"]').length).toBeGreaterThan(0);
    expect(time).toBeLessThan(60);
  });
});
