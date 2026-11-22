import { Alert, Device, Rack } from '../types';
import { placeDevices } from './place';
import { powerText, rackHealth, rackPower } from './health';

const device = (name: string, d: Partial<Device> = {}): Device => ({
  name,
  rack: 'R1',
  position: 1,
  uHeight: 1,
  face: 'front',
  fullDepth: true,
  state: 'up',
  row: 0,
  children: [],
  alerts: [],
  ...d,
});

const rack: Rack = {
  id: 'R1',
  name: 'R1',
  uHeight: 42,
  startingUnit: 1,
  descUnits: false,
  fixedHeight: true,
  width: 19,
};

const healthOf = (devices: Device[], alerts?: Map<string, Alert[]>) =>
  rackHealth(placeDevices({ devices, racks: [rack], alerts }).racks[0]);

describe('rackHealth', () => {
  it('counts each device once, full-depth ones and the 0U band included', () => {
    expect(
      healthOf([
        device('srv', { position: 1 }),
        device('sw', { position: 2, state: 'down' }),
        device('pdu', { position: undefined, uHeight: 0, state: 'down' }),
        device('patch', { position: 3, state: 'unknown', fullDepth: false }),
      ])
    ).toEqual({ state: 'down', down: 2, alerts: 0, critical: false });
  });

  it('is up when no device is down and one is in service, unknown when none is monitored', () => {
    expect(healthOf([device('srv'), device('patch', { position: 2, state: 'unknown' })]).state).toBe('up');
    expect(healthOf([device('patch', { state: 'unknown' })]).state).toBe('unknown');
    expect(healthOf([]).state).toBeUndefined();
  });

  it('counts the active alerts and tells when one is critical', () => {
    const alerts = new Map([
      [
        'srv',
        [
          { name: 'HighTemp', severity: 'warning' },
          { name: 'Down', severity: 'Critical' },
        ],
      ],
      ['sw', [{ name: 'HighTemp', severity: 'warning' }]],
    ]);
    expect(healthOf([device('srv'), device('sw', { position: 2 })], alerts)).toEqual({
      state: 'up',
      down: 0,
      alerts: 3,
      critical: true,
    });
  });

  it('counts only the devices kept by the filter, as the legend does', () => {
    const health = rackHealth(
      placeDevices({
        devices: [device('srv'), device('nas', { position: 2, state: 'down', role: 'storage' })],
        racks: [rack],
      }).racks[0],
      (d) => d.role !== 'storage'
    );
    expect(health).toEqual({ state: 'up', down: 0, alerts: 0, critical: false });
  });
});

describe('rackPower', () => {
  it('adds the power draw of every device of the rack once, whatever the filter, against its capacity', () => {
    const layout = placeDevices({
      devices: [
        device('srv', { power: 450 }),
        // Full depth: drawn on both faces, counted once.
        device('sw', { position: 2, power: 150 }),
        device('pdu', { position: undefined, uHeight: 0 }),
      ],
      racks: [{ ...rack, powerCapacity: 1000 }],
    }).racks[0];
    expect(rackPower(layout)).toEqual({ draw: 600, capacity: 1000, ratio: 0.6 });
  });

  it('has no draw without power values, and no ratio without capacity', () => {
    const layout = placeDevices({ devices: [device('srv')], racks: [rack] }).racks[0];
    expect(rackPower(layout)).toEqual({});
    const noCapacity = placeDevices({ devices: [device('srv', { power: 200 })], racks: [rack] }).racks[0];
    expect(rackPower(noCapacity)).toEqual({ draw: 200 });
  });
});

describe('powerText', () => {
  it.each([
    [{ draw: 3200, capacity: 5000 }, '3.2 / 5 kW'],
    [{ draw: 850, capacity: 1000 }, '0.85 / 1 kW'],
    [{ draw: 640, capacity: 800 }, '640 / 800 W'],
    [{ draw: 12345 }, '12.3 kW'],
    [{ draw: 850 }, '850 W'],
    [{ capacity: 5000 }, undefined],
    [{}, undefined],
  ])('writes %p as %p', (power, text) => {
    expect(powerText(power)).toBe(text);
  });
});
