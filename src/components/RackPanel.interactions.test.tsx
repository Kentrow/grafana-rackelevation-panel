import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DataFrame, LinkModel } from '@grafana/data';
import { loadFixture } from '../testing/fixtures';
import { panelProps } from '../testing/panel';
import { Rack } from './Rack';
import { locationService } from '@grafana/runtime';
import { RackPanel } from './RackPanel';

// Counts the renders of the racks, to check that hovering does not redraw the SVG.
jest.mock('./Rack', () => {
  const actual = jest.requireActual('./Rack');
  return { Rack: jest.fn(actual.Rack) };
});

const hover = (name: string) => fireEvent.mouseMove(screen.getByTestId(`device-${name}`).querySelector('rect')!);
const click = (name: string) => fireEvent.click(screen.getByTestId(`device-${name}`).querySelector('rect')!);

/** Gives every field of the devices frame data links, as the field config defaults do. */
function withLinks(frames: DataFrame[], links: (device: string) => LinkModel[]): DataFrame[] {
  return frames.map((frame) => {
    const device = frame.fields.find((f) => f.name === 'device');
    if (!device || frame.name !== 'devices') {
      return frame;
    }
    return {
      ...frame,
      fields: frame.fields.map((f) => ({
        ...f,
        config: { ...f.config, links: [{ title: 'link', url: '' }] },
        getLinks: ({ valueRowIndex }: { valueRowIndex?: number }) => links(device.values[valueRowIndex!]),
      })),
    };
  });
}

const link = (title: string, href: string, onClick = jest.fn()): LinkModel => ({
  title,
  href,
  target: '_self',
  origin: {},
  onClick,
});

describe('tooltip', () => {
  it('shows the device card on hover, with extra columns, alerts and children', () => {
    render(<RackPanel {...panelProps(loadFixture('multi-rack'))} />);
    hover('sw-a3-tor-01');
    const tooltip = screen.getByTestId('device-tooltip');
    expect(tooltip).toHaveTextContent('sw-a3-tor-01');
    expect(tooltip).toHaveTextContent('Arista 7050SX3');
    expect(tooltip).toHaveTextContent('Paris A3');
    expect(tooltip).toHaveTextContent('U46');
    expect(within(screen.getByTestId('device-tooltip-alerts')).getByText(/InterfaceErrors/)).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByTestId('rack-svg').parentElement!);
    expect(screen.queryByTestId('device-tooltip')).toBeNull();
  });

  it('lists the columns that are not in the contract, and the child devices', () => {
    render(<RackPanel {...panelProps(loadFixture('children'))} />);
    hover('chassis-01');
    expect(screen.getByTestId('device-tooltip-children')).toHaveTextContent('blade-03 · Dell MX760c · Out of service');
  });

  it('does not redraw the racks on hover', () => {
    render(<RackPanel {...panelProps(loadFixture('basic'))} />);
    const renders = jest.mocked(Rack).mock.calls.length;
    hover('fw-hq-01');
    hover('sw-hq-core-01');
    expect(screen.getByTestId('device-tooltip')).toHaveTextContent('sw-hq-core-01');
    expect(jest.mocked(Rack).mock.calls.length).toBe(renders);
  });

  it('can be switched off', () => {
    render(<RackPanel {...panelProps(loadFixture('basic'), { showTooltip: false })} />);
    hover('fw-hq-01');
    expect(screen.queryByTestId('device-tooltip')).toBeNull();
  });
});

describe('data links', () => {
  it('follows the only link of a device on click, with the values of its row', () => {
    const follow = jest.fn();
    const frames = withLinks(loadFixture('collisions'), (device) => [link('NetBox', `/nb/${device}`, follow)]);
    render(<RackPanel {...panelProps(frames)} />);
    click('sw-b');
    expect(follow).toHaveBeenCalledTimes(1);
  });

  it('opens the menu of the links when there are several', () => {
    const frames = withLinks(loadFixture('collisions'), (device) => [
      link('NetBox', `https://netbox.example.com/dcim/devices/?q=${device}`),
      link('Dashboard', `/d/device?var-device=${device}`),
    ]);
    render(<RackPanel {...panelProps(frames)} />);
    click('sw-b');
    expect(screen.getByRole('menuitem', { name: 'NetBox' })).toHaveAttribute(
      'href',
      'https://netbox.example.com/dcim/devices/?q=sw-b'
    );
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toBeInTheDocument();
  });
});

describe('highlight and role filter', () => {
  it('highlights the device of the variable and fades the others', () => {
    render(<RackPanel {...panelProps(loadFixture('basic'), {}, { device: ['sw-hq-core-01'] })} />);
    expect(screen.getByTestId('device-sw-hq-core-01')).toHaveAttribute('data-emphasis', 'highlight');
    expect(screen.getByTestId('device-fw-hq-01')).toHaveAttribute('data-emphasis', 'dim');
  });

  it('does nothing when the dashboard has no highlight variable', () => {
    render(<RackPanel {...panelProps(loadFixture('basic'))} />);
    expect(screen.getByTestId('device-fw-hq-01')).not.toHaveAttribute('data-emphasis');
    expect(screen.queryByTestId('clear-highlight')).toBeNull();
  });

  it('leaves a panel without the highlighted device as it is', () => {
    render(<RackPanel {...panelProps(loadFixture('multi-rack'), {}, { device: ['sw-hq-core-01'] })} />);
    expect(screen.getByTestId('device-sw-a1-tor-01')).not.toHaveAttribute('data-emphasis');
    expect(screen.queryByTestId('clear-highlight')).toBeNull();
  });

  it('clears the highlight variable with the clear button', () => {
    const partial = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    render(<RackPanel {...panelProps(loadFixture('basic'), {}, { device: ['sw-hq-core-01'] })} />);
    fireEvent.click(screen.getByTestId('clear-highlight'));
    expect(partial).toHaveBeenCalledWith({ 'var-device': '' }, true);
  });

  it('fades and disables devices out of the role filter, which follows a variable', () => {
    render(<RackPanel {...panelProps(loadFixture('basic'), { roles: ['$role'] }, { role: ['wireless', 'server'] })} />);
    expect(screen.getByTestId('device-wlc-hq-01')).not.toHaveAttribute('data-emphasis');
    const firewall = screen.getByTestId('device-fw-hq-01');
    expect(firewall).toHaveAttribute('data-emphasis', 'filtered');
    expect(firewall).toHaveAttribute('pointer-events', 'none');
    // Still drawn: the rack keeps its shape.
    expect(screen.getByTestId('rack-RACK-HQ-01').querySelectorAll('[data-testid^="device-"]')).toHaveLength(6);
  });
});

describe('alerts badge', () => {
  it('counts the active alerts of a device', () => {
    render(<RackPanel {...panelProps(loadFixture('multi-rack'))} />);
    expect(within(screen.getByTestId('device-sw-a3-tor-01')).getByTestId('alert-badge')).toHaveAttribute(
      'data-count',
      '2'
    );
    expect(within(screen.getByTestId('device-sw-a3-tor-02')).queryByTestId('alert-badge')).toBeNull();
  });
});

describe('empty state', () => {
  it('says what is expected when the data does not follow the contract', () => {
    render(<RackPanel {...panelProps(loadFixture('basic').map((f) => ({ ...f, fields: f.fields.slice(2) })))} />);
    expect(screen.getByTestId('rack-empty')).toHaveTextContent('No rack to draw');
    expect(screen.getByTestId('rack-empty')).toHaveTextContent('device and rack columns');
  });
});

describe('tooltip extra columns', () => {
  it('shows the extra columns as they are, without the unit of the colour field', () => {
    const frames = loadFixture('prometheus-auto');
    render(<RackPanel {...panelProps(frames, { frames: { devices: 'device_info' } })} />);
    fireEvent.mouseMove(screen.getByTestId('device-fw-hq-01').querySelector('rect')!);
    const tooltip = screen.getByTestId('device-tooltip');
    expect(tooltip).toHaveTextContent('Value #A1');
    expect(tooltip).not.toHaveTextContent('Time');
  });
});

describe('rack summary and legend', () => {
  it('shows the free units of each face under the rack name', () => {
    render(<RackPanel {...panelProps(loadFixture('basic'), { face: 'both', autoUnitHeight: false })} />);
    const [front, rear] = screen.getAllByTestId('rack-subtitle');
    expect(front).toHaveTextContent('Front · 35 U free');
    expect(rear).toHaveTextContent('Rear · 36 U free');
  });

  it('counts the devices by state, alerts and role filter included', () => {
    const { rerender } = render(<RackPanel {...panelProps(loadFixture('multi-rack'))} />);
    expect(screen.getByTestId('rack-legend')).toHaveTextContent(
      // Counted in the CSV: 52 with a status in service or a value, 4 with status 0, 5 patch panels.
      '52 in service4 out of service5 not monitored5 active alerts'
    );
    rerender(<RackPanel {...panelProps(loadFixture('multi-rack'), { roles: ['firewall'] })} />);
    expect(screen.getByTestId('rack-legend')).toHaveTextContent(
      '1 in service1 out of service0 not monitored1 active alert'
    );
  });

  it('can hide both', () => {
    render(<RackPanel {...panelProps(loadFixture('basic'), { showLegend: false, showRackSummary: false })} />);
    expect(screen.queryByTestId('rack-legend')).toBeNull();
    expect(screen.queryByTestId('rack-subtitle')).toBeNull();
  });
});

describe('keyboard', () => {
  it('shows the card of the focused device and hides it on Escape', () => {
    render(<RackPanel {...panelProps(loadFixture('basic'))} />);
    const device = screen.getByTestId('device-fw-hq-01');
    expect(device).toHaveAttribute('tabindex', '0');
    fireEvent.focus(device);
    expect(screen.getByTestId('device-tooltip')).toHaveTextContent('fw-hq-01');
    fireEvent.keyDown(device, { key: 'Escape' });
    expect(screen.queryByTestId('device-tooltip')).toBeNull();
  });

  it('opens the links of a device with Enter', () => {
    const follow = jest.fn();
    const frames = withLinks(loadFixture('collisions'), (device) => [link('NetBox', `/nb/${device}`, follow)]);
    render(<RackPanel {...panelProps(frames)} />);
    fireEvent.keyDown(screen.getByTestId('device-sw-b'), { key: 'Enter' });
    expect(follow).toHaveBeenCalledTimes(1);
  });

  it('leaves filtered devices out of the tab order', () => {
    render(<RackPanel {...panelProps(loadFixture('basic'), { roles: ['switch'] })} />);
    expect(screen.getByTestId('device-fw-hq-01')).not.toHaveAttribute('tabindex');
  });
});

describe('rack links', () => {
  it('opens the links of the racks frame from the rack name', () => {
    const follow = jest.fn();
    const frames = loadFixture('multi-rack').map((frame) =>
      frame.name !== 'racks'
        ? frame
        : {
            ...frame,
            fields: frame.fields.map((f) => ({
              ...f,
              config: { ...f.config, links: [{ title: 'Rack', url: '' }] },
              getLinks: () => [link('Rack', '/rack', follow)],
            })),
          }
    );
    render(<RackPanel {...panelProps(frames)} />);
    const header = within(screen.getByTestId('rack-PAR1-A3')).getByTestId('rack-header');
    expect(header).toHaveAttribute('role', 'button');
    fireEvent.click(header.querySelector('text')!);
    expect(follow).toHaveBeenCalledTimes(1);
  });

  it('does not make the rack name a link without racks links', () => {
    render(<RackPanel {...panelProps(loadFixture('multi-rack'))} />);
    expect(within(screen.getByTestId('rack-PAR1-A3')).getByTestId('rack-header')).not.toHaveAttribute('role');
  });
});
