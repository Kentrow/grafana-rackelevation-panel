import {
  createTheme,
  DataFrame,
  FieldConfig,
  getDisplayProcessor,
  MappingType,
  ThresholdsMode,
  ValueMapping,
} from '@grafana/data';
import { DEFAULT_UP_VALUES } from '../data/status';
import { buildModel } from '../model';
import { csvToFrame, loadFixture } from '../testing/fixtures';
import { Device } from '../types';
import { deviceLabel, deviceLooks } from './deviceLook';

const theme = createTheme();

const THRESHOLDS: FieldConfig = {
  unit: 'celsius',
  color: { mode: 'thresholds' },
  thresholds: {
    mode: ThresholdsMode.Absolute,
    steps: [
      { color: 'green', value: -Infinity },
      { color: 'red', value: 60 },
    ],
  },
};

/**
 * Frames as a panel receives them: config set on every field, display processors created. Grafana's
 * applyFieldOverrides needs the editor registry of a running Grafana, so do what it does for plain defaults.
 */
const withFieldConfig = (frames: DataFrame[], defaults: FieldConfig, byName: Record<string, FieldConfig> = {}) =>
  frames.map((frame) => ({
    ...frame,
    fields: frame.fields.map((f) => {
      const field = { ...f, config: { ...defaults, ...byName[f.name] } };
      return { ...field, display: getDisplayProcessor({ field, theme }) };
    }),
  }));

function looksOf(frames: DataFrame[]) {
  const model = buildModel(frames, {
    frames: {},
    columns: {},
    valueFields: [],
    upValues: DEFAULT_UP_VALUES,
    racks: [],
  });
  const devices = model.racks.flatMap((r) => r.front.map((p) => p.device));
  const looks = deviceLooks(devices, model.devicesFrame, {}, theme);
  return (name: string) => {
    const device = devices.find((d) => d.name === name) as Device;
    return { device, look: looks.get(device)! };
  };
}

describe('deviceLooks', () => {
  it('colours a device in service with the thresholds of the field config, and formats its value', () => {
    const look = looksOf(withFieldConfig(loadFixture('basic'), THRESHOLDS));
    expect(look('wlc-hq-01').look).toMatchObject({
      fill: theme.visualization.getColorByName('red'),
      valueText: '62 °C',
    });
    expect(look('fw-hq-01').look).toMatchObject({
      fill: theme.visualization.getColorByName('green'),
      valueText: '41 °C',
    });
  });

  it('draws the other states with the theme colours', () => {
    const look = looksOf(withFieldConfig(loadFixture('basic'), THRESHOLDS));
    expect(look('wlc-hq-02').look).toMatchObject({ fill: theme.colors.error.main, strike: true });
    expect(look('patch-hq-01').look).toMatchObject({ hatched: true, stroke: theme.colors.border.medium });
  });

  it('borders a device in service without value in green', () => {
    const look = looksOf(
      withFieldConfig([csvToFrame('device,rack,position,status\nsw-01,R1,1,up\n', 'A')], THRESHOLDS)
    );
    expect(look('sw-01').look).toMatchObject({
      fill: theme.colors.background.elevated,
      stroke: theme.colors.success.main,
      strokeWidth: 2,
    });
  });

  it('colours a device with a value even without a status column', () => {
    const look = looksOf(
      withFieldConfig([csvToFrame('device,rack,position,value\nsrv-01,R1,1,70\n', 'A')], THRESHOLDS)
    );
    expect(look('srv-01').look).toMatchObject({ fill: theme.visualization.getColorByName('red'), hatched: false });
  });

  it('takes the colour of a value mapping on the status field instead of the red of a device out of service', () => {
    const mappings: ValueMapping[] = [
      { type: MappingType.ValueToText, options: { down: { color: 'orange', text: 'Down' } } },
    ];
    const look = looksOf(withFieldConfig(loadFixture('basic'), THRESHOLDS, { status: { mappings } }));
    expect(look('wlc-hq-02').look.fill).toBe(theme.visualization.getColorByName('orange'));
  });

  it('works on raw frames, without field config', () => {
    const look = looksOf(loadFixture('basic'));
    expect(look('fw-hq-01').look).toMatchObject({ fill: theme.colors.background.elevated, valueText: '41' });
  });
});

describe('deviceLabel', () => {
  it('joins the chosen parts in their order', () => {
    const { device, look } = looksOf(withFieldConfig(loadFixture('basic'), THRESHOLDS))('sw-hq-core-01');
    expect(deviceLabel(device, look, ['name', 'value', 'model'], '·')).toBe('sw-hq-core-01 · 45 °C · Cisco C9300-48P');
    expect(deviceLabel(device, look, ['role', 'name'], '')).toBe('switch sw-hq-core-01');
  });
});
