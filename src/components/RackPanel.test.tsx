import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { DataFrame } from '@grafana/data';
import { RackPanel } from './RackPanel';
import { csvToFrame, loadFixture } from '../testing/fixtures';
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

  it('shows the worst device state and the active alerts of each rack next to its name', () => {
    const series = [
      csvToFrame(
        'device,rack,position,status,role\nsw-01,R1,1,down,switch\nsrv-01,R1,2,up,server\nsrv-02,R2,1,up,server\n',
        'A'
      ),
      csvToFrame('device,alertname,severity\nsrv-02,HighTemp,warning\nsrv-02,DiskFull,warning\n', 'C'),
    ];
    const { rerender } = render(<RackPanel {...props(series)} />);
    const header = (rack: string) => within(screen.getByTestId(`rack-${rack}`)).getByTestId('rack-header');
    expect(within(header('R1')).getByTestId('rack-state')).toHaveAttribute('data-state', 'down');
    expect(within(header('R1')).queryByTestId('rack-alerts')).toBeNull();
    expect(within(header('R2')).getByTestId('rack-state')).toHaveAttribute('data-state', 'up');
    expect(within(header('R2')).getByTestId('rack-alerts')).toHaveTextContent('2');
    expect(header('R1').querySelector('title')).toHaveTextContent('1 device out of service');
    // The role filter and the hidden 0U band leave their devices out, as in the legend.
    rerender(<RackPanel {...props(series, { roles: ['server'] })} />);
    expect(within(header('R1')).getByTestId('rack-state')).toHaveAttribute('data-state', 'up');
    rerender(<RackPanel {...props(series, { showRackState: false })} />);
    expect(screen.queryByTestId('rack-state')).toBeNull();
  });

  it('numbers the overflow zone, except the units of a device drawn there far from its position', () => {
    const series = [
      csvToFrame('device,rack,position\ntypo,R1,1000\nnear,R1,44\n', 'A'),
      csvToFrame('rack,u_height\nR1,42\n', 'B'),
    ];
    render(<RackPanel {...props(series)} />);
    const numbers = within(screen.getByTestId('rack-R1')).getByTestId('overflow-numbers');
    // Slots -1 to -4 above U42: U43, U44 and U45, then typo at the outer edge, without a number.
    expect([...numbers.childNodes].map((n) => n.textContent)).toEqual(['43', '44', '45']);
  });

  it('outlines the free blocks where a new device fits, from the option or a variable', () => {
    // basic: U42 patch (half depth), U40, U38, U35, U34, U20-21 taken on the front of a 42U rack.
    const space = (options: Partial<RackElevationOptions>, variables: Record<string, string[]> = {}) => {
      const { unmount } = render(<RackPanel {...panelProps(loadFixture('basic'), options, variables)} />);
      const blocks = [...screen.queryAllByTestId('free-block')].map((b) => b.getAttribute('data-units'));
      unmount();
      return blocks;
    };
    expect(space({})).toEqual([]);
    const { unmount } = render(<RackPanel {...panelProps(loadFixture('basic'), { freeSpace: '4U' })} />);
    expect(screen.getByTestId('rack-header').querySelector('title')).toHaveTextContent(
      'a 4 U device fits in 2 free blocks'
    );
    unmount();
    expect(space({ freeSpace: '4' })).toEqual(['U1-19', 'U22-33']);
    expect(space({ freeSpace: '$space' }, { space: ['13'] })).toEqual(['U1-19']);
    // From the rear, U41-42 is free behind the half-depth patch panel of the front: for a half-depth device only.
    expect(space({ face: 'rear', freeSpace: '2' })).toEqual(['U1-19', 'U22-33', 'U36-37']);
    expect(space({ face: 'rear', freeSpace: '2', freeSpaceFullDepth: false })).toEqual([
      'U1-19',
      'U22-33',
      'U36-37',
      'U41-42',
    ]);
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

  it('writes the labels from the template when one is set', () => {
    const fixed = { autoUnitHeight: false, unitHeight: 30 };
    render(<RackPanel {...props(loadFixture('basic'), { ...fixed, labelTemplate: '{device} ({role})' })} />);
    expect(screen.getByTestId('device-srv-hq-01').querySelector('text')).toHaveTextContent('srv-hq-01 (server)');
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
    expect(screen.getByRole('button', { name: '5 data problems' })).toBeInTheDocument();
  });

  it('names a single problem in the singular', () => {
    render(<RackPanel {...props([csvToFrame('device,rack,position\nsw-01,R1,1\nsw-01,R1,2\n', 'A')])} />);
    expect(screen.getByRole('button', { name: '1 data problem' })).toBeInTheDocument();
  });

  it('shows no error indicator when the data is clean', () => {
    render(<RackPanel {...props(loadFixture('basic'))} />);
    expect(screen.queryByTestId('rack-errors')).toBeNull();
  });

  it('counts in the legend only the devices drawn, without the hidden 0U band', () => {
    const { rerender } = render(<RackPanel {...props(loadFixture('zero-u'))} />);
    expect(screen.getByTestId('rack-legend')).toHaveTextContent('4 in service1 out of service1 not monitored');
    rerender(<RackPanel {...props(loadFixture('zero-u'), { showZeroU: false })} />);
    expect(screen.getByTestId('rack-legend')).toHaveTextContent('2 in service0 out of service0 not monitored');
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
