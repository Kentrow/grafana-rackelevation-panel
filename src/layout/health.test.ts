import { Alert, Device, Rack } from '../types';
import { placeDevices } from './place';
import { rackHealth } from './health';

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
});
