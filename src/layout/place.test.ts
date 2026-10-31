import { Device, Rack } from '../types';
import { placeDevices } from './place';

const device = (name: string, d: Partial<Device> = {}, row = 0): Device => ({
  name,
  rack: 'R1',
  uHeight: 1,
  face: 'front',
  fullDepth: true,
  state: 'up',
  row,
  children: [],
  alerts: [],
  ...d,
});

const rack = (r: Partial<Rack> = {}): Rack => ({
  id: 'R1',
  name: 'R1',
  uHeight: 42,
  startingUnit: 1,
  descUnits: false,
  fixedHeight: true,
  width: 19,
  ...r,
});

describe('placeDevices', () => {
  it('counts slots from the top: U42 is slot 0 of an ascending 42U rack', () => {
    const [layout] = placeDevices({
      devices: [device('top', { position: 42 }), device('srv', { position: 1, uHeight: 2 })],
    }).racks;
    expect(layout.front.map((p) => [p.device.name, p.units, p.top])).toEqual([
      ['top', [42, 42], 0],
      ['srv', [1, 2], 40],
    ]);
  });

  it('puts the starting unit at the top of a descending rack, the device going down from its position (NetBox)', () => {
    const [layout] = placeDevices({
      devices: [device('a', { position: 0 }), device('b', { position: 3, uHeight: 2 })],
      racks: [rack({ uHeight: 12, startingUnit: 0, descUnits: true })],
    }).racks;
    expect(layout.front.map((p) => [p.device.name, p.units, p.top])).toEqual([
      ['a', [0, 0], 0],
      ['b', [3, 4], 3],
    ]);
  });

  it('draws a full-depth device on both faces, dimmed on the opposite one', () => {
    const [layout] = placeDevices({
      devices: [device('ups', { position: 1, face: 'rear' }), device('patch', { position: 2, fullDepth: false })],
    }).racks;
    expect(layout.rear.map((p) => [p.device.name, p.back])).toEqual([['ups', false]]);
    expect(layout.front.map((p) => [p.device.name, p.back])).toEqual([
      ['ups', true],
      ['patch', false],
    ]);
  });

  it('flags the later of two overlapping devices and reports the pair once', () => {
    const { racks, errors } = placeDevices({
      devices: [device('a', { position: 10, uHeight: 2 }, 0), device('b', { position: 11 }, 1)],
    });
    expect(racks[0].front.map((p) => [p.device.name, p.conflict])).toEqual([
      ['a', undefined],
      ['b', 'overlap'],
    ]);
    expect(racks[0].rear.map((p) => p.conflict)).toEqual([undefined, 'overlap']);
    expect(errors.map((e) => e.message)).toEqual(['b overlaps a on the front of R1.']);
  });

  it('lets half-depth devices share a unit on opposite faces', () => {
    const { errors } = placeDevices({
      devices: [
        device('front', { position: 10, fullDepth: false }),
        device('rear', { position: 10, face: 'rear', fullDepth: false }),
      ],
    });
    expect(errors).toEqual([]);
  });

  it('grows a rack without a racks frame to fit its devices, silently', () => {
    const { racks, errors } = placeDevices({ devices: [device('high', { position: 45, uHeight: 2 })] });
    expect(racks[0].rack.uHeight).toBe(46);
    expect(racks[0].front[0].top).toBe(0);
    expect(errors).toEqual([]);
  });

  it('keeps the height of the racks frame and flags devices outside of it', () => {
    const { racks, errors } = placeDevices({
      devices: [device('high', { position: 23, uHeight: 4 }), device('low', { position: 0 })],
      racks: [rack({ uHeight: 24 })],
    });
    expect(racks[0].rack.uHeight).toBe(24);
    expect(racks[0].front.map((p) => [p.device.name, p.top, p.conflict])).toEqual([
      ['high', -2, 'overflow'],
      ['low', 24, 'overflow'],
    ]);
    expect(errors.map((e) => e.message)).toEqual([
      'high (U23-26) is outside R1 (U1-24).',
      'low (U0) is outside R1 (U1-24).',
    ]);
  });

  it('sends devices without position or height to the 0U band', () => {
    const [layout] = placeDevices({
      devices: [device('pdu-a', { uHeight: 0 }), device('pdu-b', { position: 5, uHeight: 0 }), device('cm')],
    }).racks;
    expect(layout.zeroU.map((d) => d.name)).toEqual(['pdu-a', 'pdu-b', 'cm']);
    expect(layout.front).toEqual([]);
  });

  it('keeps the first row of a duplicate device', () => {
    const { racks, errors } = placeDevices({
      devices: [device('a', { position: 1 }, 0), device('a', { position: 5 }, 1)],
    });
    expect(racks[0].front.map((p) => p.units)).toEqual([[1, 1]]);
    expect(errors.map((e) => e.message)).toEqual(['a appears more than once; row 2 is ignored.']);
  });

  it('attaches children to their parent instead of placing them', () => {
    const { racks, errors } = placeDevices({
      devices: [
        device('blade', { parent: 'chassis', rack: '' }),
        device('chassis', { position: 1, uHeight: 10 }),
        device('lost', { parent: 'nowhere', rack: '' }),
      ],
    });
    expect(racks).toHaveLength(1);
    expect(racks[0].front[0].device.children.map((c) => c.name)).toEqual(['blade']);
    expect(errors.map((e) => e.kind)).toEqual(['orphan-child']);
  });

  it('orders and filters racks with the options, by id or name', () => {
    const { racks, errors } = placeDevices({
      devices: [device('a', { rack: 'R1' }), device('b', { rack: 'R2' }), device('c', { rack: 'R3' })],
      racks: [rack({ id: 'R1' }), rack({ id: 'R2', name: 'Second' }), rack({ id: 'R3' })],
      order: ['R3', 'Second', 'R9'],
    });
    expect(racks.map((r) => r.rack.id)).toEqual(['R3', 'R2']);
    expect(errors.map((e) => e.message)).toEqual(['Rack R9 from the options is not in the data.']);
  });

  it('follows the racks frame order, then the devices order, and draws empty racks', () => {
    const { racks, errors } = placeDevices({
      devices: [device('a', { rack: 'R9' }), device('b', { rack: 'R1' })],
      racks: [rack({ id: 'R2' }), rack({ id: 'R1' })],
    });
    expect(racks.map((r) => r.rack.id)).toEqual(['R2', 'R1', 'R9']);
    expect(errors.map((e) => e.message)).toEqual(['Rack R9 is not in the racks frame; drawn with default values.']);
  });
});
