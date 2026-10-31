import { DEFAULT_UP_VALUES } from './data/status';
import { buildModel, ModelOptions } from './model';
import { describeModel, loadFixture } from './testing/fixtures';

const options = (o: Partial<ModelOptions> = {}): ModelOptions => ({
  frames: {},
  columns: {},
  valueFields: [],
  upValues: DEFAULT_UP_VALUES,
  racks: [],
  ...o,
});

const model = (fixture: string, o?: Partial<ModelOptions>) => buildModel(loadFixture(fixture), options(o));

describe('fixtures', () => {
  // The snapshots are the reviewed reference layouts: positions, faces, heights, errors.
  it.each([
    'basic',
    'two-faces',
    'desc-units',
    'zero-u',
    'collisions',
    'auto-height',
    'multi-rack',
    'prometheus-auto',
    'children',
    'ten-inch',
  ])('%s', (fixture) => {
    expect(describeModel(model(fixture))).toMatchSnapshot();
  });

  it('multi-rack, racks ordered by the options', () => {
    const m = model('multi-rack', { racks: ['PAR1-A5', 'Paris A1', 'PAR1-A3'] });
    expect(m.racks.map((r) => r.rack.id)).toEqual(['PAR1-A5', 'PAR1-A1', 'PAR1-A3']);
    expect(m.errors).toEqual([]);
  });

  it('basic, every state', () => {
    const states = model('basic').racks[0].front.map((p) => p.device.state);
    expect(new Set(states)).toEqual(new Set(['up', 'down', 'unknown']));
  });

  it('multi-rack, temperature for most devices and current for the PDUs', () => {
    const m = model('multi-rack', { valueFields: ['value', 'current'] });
    const pdu = m.racks[0].zeroU.find((d) => d.name === 'pdu-a3-a');
    const sw = m.racks[0].front.find((p) => p.device.name === 'sw-a3-tor-01')?.device;
    expect([pdu?.value, m.devicesFrame?.fields[pdu!.valueField!].name]).toEqual([10.3, 'current']);
    expect([sw?.value, m.devicesFrame?.fields[sw!.valueField!].name]).toEqual([48.4, 'value']);
  });

  it('multi-rack, alerts on their devices', () => {
    const devices = model('multi-rack').racks.flatMap((r) => r.front.map((p) => p.device));
    const sw = devices.find((d) => d.name === 'sw-a3-tor-01');
    expect(sw?.alerts.map((a) => a.name)).toEqual(['InterfaceErrors', 'HighCpu']);
  });
});
