import { FieldType, toDataFrame } from '@grafana/data';
import { csvToFrame } from '../testing/fixtures';
import { withLabelledSeries } from './series';

const devices = csvToFrame('device,rack,position\nsw-01,R1,40\nsw-02,R1,39\npp-01,R1,42\n', 'A');
const values = (frame: ReturnType<typeof withLabelledSeries>, name: string) =>
  frame.fields.find((f) => f.name === name)?.values;

describe('withLabelledSeries', () => {
  it('adds a column per metric from one wide frame of labelled series, as Zabbix sends it', () => {
    const wide = toDataFrame({
      refId: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        {
          name: 'sw-01: Device up',
          type: FieldType.number,
          values: [1, 1],
          labels: { host: 'sw-01', item: 'Device up' },
        },
        {
          name: 'sw-01: Temperature',
          type: FieldType.number,
          values: [40, 41],
          labels: { host: 'sw-01', item: 'Temperature' },
          config: { unit: 'celsius' },
        },
        {
          name: 'sw-02: Device up',
          type: FieldType.number,
          values: [1, 0],
          labels: { host: 'sw-02', item: 'Device up' },
        },
        {
          name: 'sw-02: Temperature',
          type: FieldType.number,
          values: [50, null],
          labels: { host: 'sw-02', item: 'Temperature' },
        },
      ],
    });
    const frame = withLabelledSeries(devices, [wide], devices.fields[0], ['device', 'host']);
    expect(values(frame, 'Device up')).toEqual([1, 0, undefined]);
    // The last value that is not empty.
    expect(values(frame, 'Temperature')).toEqual([41, 50, undefined]);
    expect(frame.fields.find((f) => f.name === 'Temperature')?.config.unit).toBe('celsius');
  });

  it('reads one frame per series, the metric from __name__, as Prometheus sends them', () => {
    const series = ['sw-01', 'sw-02'].map((device, i) =>
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000] },
          { name: 'Value', type: FieldType.number, values: [i], labels: { __name__: 'up', device, job: 'snmp' } },
        ],
      })
    );
    expect(values(withLabelledSeries(devices, series, devices.fields[0], ['device', 'host']), 'up')).toEqual([
      0,
      1,
      undefined,
    ]);
  });

  it('leaves the devices frame as it is without labelled series, and keeps its own columns first', () => {
    const table = csvToFrame('device,temperature\nsw-01,40\n', 'C');
    expect(withLabelledSeries(devices, [table], devices.fields[0], ['device', 'host'])).toBe(devices);
    const position = toDataFrame({
      fields: [{ name: 'Value', type: FieldType.number, values: [7], labels: { host: 'sw-01', item: 'position' } }],
    });
    expect(values(withLabelledSeries(devices, [position], devices.fields[0], ['host']), 'position')).toEqual(
      devices.fields[2].values
    );
  });
});
