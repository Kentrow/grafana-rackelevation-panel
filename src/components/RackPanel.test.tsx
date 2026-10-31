import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { DataFrame } from '@grafana/data';
import { RackPanel } from './RackPanel';
import { loadFixture } from '../testing/fixtures';
import { panelProps } from '../testing/panel';
import { RackElevationOptions } from '../types';

const props = (series: DataFrame[], options: Partial<RackElevationOptions> = {}) =>
  panelProps(series, options, { rack: ['PAR1-A1', 'PAR1-A2'] });

describe('RackPanel', () => {
  it('draws the front of a rack: every device, unit numbers, free units', () => {
    render(<RackPanel {...props(loadFixture('basic'))} />);
    const rack = screen.getByTestId('rack-RACK-HQ-01');
    expect(within(rack).getByTestId('unit-numbers').childNodes).toHaveLength(42);
    expect(within(rack).getByTestId('unit-numbers').firstChild).toHaveTextContent('42');
    expect(within(rack).getByTestId('device-wlc-hq-02')).toHaveAttribute('data-state', 'down');
    expect(within(rack).getByTestId('device-patch-hq-01')).toHaveAttribute('data-state', 'unknown');
    expect(within(rack).getByTestId('device-fw-hq-01')).toHaveTextContent('fw-hq-01');
    expect(rack.querySelectorAll('[data-testid^="device-"]')).toHaveLength(6);
  });

  it('numbers a descending rack from the top', () => {
    render(<RackPanel {...props(loadFixture('desc-units'), { racks: ['RACK-DESC'] })} />);
    const numbers = within(screen.getByTestId('rack-RACK-DESC')).getByTestId('unit-numbers');
    expect(numbers.firstChild).toHaveTextContent('0');
    expect(numbers.lastChild).toHaveTextContent('11');
  });

  it('composes the labels from the options and hides them on small units', () => {
    const fixed = { autoUnitHeight: false };
    const { rerender } = render(
      <RackPanel {...props(loadFixture('basic'), { ...fixed, label: ['name', 'model'], unitHeight: 30 })} />
    );
    expect(screen.getByTestId('device-srv-hq-01').querySelector('text')).toHaveTextContent('srv-hq-01 · Dell R760');
    rerender(<RackPanel {...props(loadFixture('basic'), { ...fixed, unitHeight: 8 })} />);
    expect(screen.getByTestId('device-srv-hq-01').querySelector('text')).toBeNull();
  });

  it('fits the tallest rack to the panel height with the auto unit height', () => {
    // 300 px panel, legend included: a 12U rack gets units of 18 px, a 42U rack units of 5 px.
    const tenInch = render(<RackPanel {...props(loadFixture('ten-inch'))} />);
    const svg = tenInch.getByTestId('rack-svg');
    expect(Number(svg.getAttribute('height'))).toBeLessThanOrEqual(300 - 24);
    expect(Number(svg.getAttribute('height'))).toBeGreaterThan(300 - 24 - 12);
  });

  it('shows the racks of the options, variables replaced, side by side', () => {
    render(<RackPanel {...props(loadFixture('multi-rack'), { racks: ['$rack', 'PAR1-A5'] })} />);
    expect(screen.getAllByTestId(/^rack-PAR1/).map((r) => r.dataset.testid)).toEqual([
      'rack-PAR1-A1',
      'rack-PAR1-A2',
      'rack-PAR1-A5',
    ]);
  });
});

describe('RackPanel faces, 0U band and conflicts', () => {
  const devicesOf = (rack: HTMLElement) =>
    [...rack.querySelectorAll<SVGGElement>('[data-testid^="device-"]')].map(
      (g) => `${g.dataset.testid!.slice(7)}${g.getAttribute('opacity') === '1' ? '' : ' (back)'}`
    );

  it('draws the rear face, full-depth devices of the front dimmed', () => {
    render(<RackPanel {...props(loadFixture('two-faces'), { face: 'rear' })} />);
    expect(devicesOf(screen.getByTestId('rack-RACK-2F'))).toEqual([
      'patch-rear-01',
      'srv-full-01 (back)',
      'ups-rear-01',
      'srv-noface-01 (back)',
      'fw-rear-01',
    ]);
  });

  it('draws both faces of each rack side by side', () => {
    render(<RackPanel {...props(loadFixture('two-faces'), { face: 'both' })} />);
    const views = screen.getAllByTestId('rack-RACK-2F');
    expect(views.map((v) => v.dataset.face)).toEqual(['front', 'rear']);
    expect(views[0]).toHaveTextContent('Front');
  });

  it('stacks 0U devices in the band right of the rack, dimmed when they hang on the other face', () => {
    render(<RackPanel {...props(loadFixture('zero-u'))} />);
    const band = screen.getByTestId('zero-u-band');
    expect(devicesOf(band)).toEqual(['pdu-a (back)', 'pdu-b (back)', 'cable-mgr-01', 'pdu-c (back)']);
  });

  it('hides the 0U band with the option', () => {
    render(<RackPanel {...props(loadFixture('zero-u'), { showZeroU: false })} />);
    expect(screen.queryByTestId('zero-u-band')).toBeNull();
  });

  it('hatches conflicting devices and lists the problems in the corner', () => {
    render(<RackPanel {...props(loadFixture('collisions'))} />);
    expect(screen.getByTestId('device-sw-b')).toHaveAttribute('data-conflict', 'overlap');
    expect(screen.getByTestId('device-srv-big-c')).toHaveAttribute('data-conflict', 'overflow');
    expect(screen.getByTestId('device-sw-a')).not.toHaveAttribute('data-conflict');
    expect(screen.getByTestId('rack-errors')).toHaveTextContent('5');
  });

  it('shows no error indicator when the data is clean', () => {
    render(<RackPanel {...props(loadFixture('basic'))} />);
    expect(screen.queryByTestId('rack-errors')).toBeNull();
  });

  it('scales the drawing to the panel with the fit option', () => {
    render(<RackPanel {...props(loadFixture('multi-rack'), { fitToPanel: true })} />);
    const svg = screen.getByTestId('rack-svg');
    expect(svg).toHaveAttribute('width', '400');
    // The legend takes the bottom of the panel.
    expect(svg).toHaveAttribute('height', String(300 - 24));
    expect(svg.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
    // Five racks scaled down to 400 px: units are too small on screen for labels.
    expect(screen.getByTestId('device-sw-a1-tor-01').querySelector('text')).toBeNull();
  });
});
