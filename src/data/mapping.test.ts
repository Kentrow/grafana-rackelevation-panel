import { FieldType, toDataFrame } from '@grafana/data';
import { csvToFrame } from '../testing/fixtures';
import { DEFAULT_UP_VALUES } from './status';
import { extraFields, readAlerts, readDevices, readRacks, toBoolean, toNumber } from './mapping';

describe('readDevices', () => {
  it('applies the NetBox defaults: 1U, front, full depth, no status means unknown', () => {
    const frame = csvToFrame('device,rack\nsrv-01,R1\n', 'A');
    const { devices, errors } = readDevices(frame, {}, DEFAULT_UP_VALUES);
    expect(errors).toEqual([]);
    expect(devices[0]).toMatchObject({
      name: 'srv-01',
      rack: 'R1',
      position: undefined,
      uHeight: 1,
      face: 'front',
      fullDepth: true,
      state: 'unknown',
      row: 0,
    });
  });

  it('keeps full depth when only the face is given', () => {
    const frame = csvToFrame('device,rack,position,face\nsrv-01,R1,10,rear\n', 'A');
    expect(readDevices(frame, {}, DEFAULT_UP_VALUES).devices[0]).toMatchObject({ face: 'rear', fullDepth: true });
  });

  it('matches column names ignoring case, and mapped names first', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.string, values: ['sw-01'] },
        { name: 'Rack', type: FieldType.string, values: ['R1'] },
        { name: 'Value #B', type: FieldType.number, values: [0] },
        { name: 'temp', type: FieldType.number, values: [41.5], config: { displayName: 'Temperature' } },
      ],
    });
    const { devices } = readDevices(
      frame,
      { device: 'name', status: 'Value #B', value: 'temperature' },
      DEFAULT_UP_VALUES
    );
    expect(devices[0]).toMatchObject({ name: 'sw-01', rack: 'R1', state: 'down', value: 41.5 });
  });

  it('does not take a mapped field again by the default name of another column', () => {
    const frame = csvToFrame('device,rack,Value\nsw-01,R1,0\n', 'A');
    expect(readDevices(frame, {}, DEFAULT_UP_VALUES).devices[0]).toMatchObject({ state: 'unknown', value: 0 });
    const device = readDevices(frame, { status: 'Value' }, DEFAULT_UP_VALUES).devices[0];
    expect(device.state).toBe('down');
    expect(device.value).toBeUndefined();
  });

  it('reads the faces and widths of NetBox labels and GraphQL enums', () => {
    const devices = csvToFrame('device,rack,face\na,R1,FACE_REAR\nb,R1,Front\n', 'A');
    expect(readDevices(devices, {}, DEFAULT_UP_VALUES).devices.map((d) => d.face)).toEqual(['rear', 'front']);
    const racks = csvToFrame('rack,width\nR1,WIDTH_10IN\nR2,19 inches\nR3,23\n', 'B');
    expect(readRacks(racks, {}).map((r) => r.width)).toEqual([10, 19, 23]);
  });

  it('reads values sent as strings, as Infinity does', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'device', type: FieldType.string, values: ['srv-01'] },
        { name: 'rack', type: FieldType.string, values: ['R1'] },
        { name: 'position', type: FieldType.string, values: ['12'] },
        { name: 'u_height', type: FieldType.string, values: ['2'] },
        { name: 'is_full_depth', type: FieldType.string, values: ['false'] },
        { name: 'face', type: FieldType.string, values: ['Rear'] },
      ],
    });
    expect(readDevices(frame, {}, DEFAULT_UP_VALUES).devices[0]).toMatchObject({
      position: 12,
      uHeight: 2,
      fullDepth: false,
      face: 'rear',
    });
  });

  it('skips rows without a name or a rack, but keeps children without a rack', () => {
    const frame = csvToFrame('device,rack,parent_device\n,R1,\nsrv-01,,\nblade-01,,chassis-01\nchassis-01,R1,\n', 'A');
    const { devices, errors } = readDevices(frame, {}, DEFAULT_UP_VALUES);
    expect(devices.map((d) => d.name)).toEqual(['blade-01', 'chassis-01']);
    expect(errors.map((e) => e.kind)).toEqual(['missing-name', 'missing-rack']);
  });

  it('reports the missing required columns', () => {
    const frame = csvToFrame('name,position\nsrv-01,1\n', 'A');
    const { devices, errors } = readDevices(frame, {}, DEFAULT_UP_VALUES);
    expect(devices).toEqual([]);
    expect(errors[0].message).toBe('Devices frame has no "device" or "rack" column.');
  });
});

describe('colour fields', () => {
  it('takes the first colour field with a value, and remembers which one', () => {
    const frame = csvToFrame('device,rack,temperature,current\nsrv-01,R1,41,\npdu-a,R1,,7.5\npp-01,R1,,\n', 'A');
    const { devices } = readDevices(frame, {}, DEFAULT_UP_VALUES, ['temperature', 'current']);
    expect(devices.map((d) => [d.name, d.value, d.valueField])).toEqual([
      ['srv-01', 41, 2],
      ['pdu-a', 7.5, 3],
      ['pp-01', undefined, undefined],
    ]);
  });

  it('ignores the value column when colour fields are set', () => {
    const frame = csvToFrame('device,rack,value,current\nsrv-01,R1,41,\n', 'A');
    expect(readDevices(frame, {}, DEFAULT_UP_VALUES, ['current']).devices[0].value).toBeUndefined();
    expect(extraFields(frame, {}, ['current']).map((f) => f.name)).toEqual(['value']);
  });
});

describe('range queries', () => {
  it('keeps the latest row of each device when the frame has a time field, without duplicate errors', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
        { name: 'device', type: FieldType.string, values: ['sw-01', 'sw-02', 'sw-01', 'sw-02'] },
        { name: 'rack', type: FieldType.string, values: ['R1', 'R1', 'R1', 'R1'] },
        { name: 'status', type: FieldType.number, values: [1, 1, 0, 1] },
      ],
    });
    const { devices, errors } = readDevices(frame, {}, DEFAULT_UP_VALUES);
    expect(devices.map((d) => [d.name, d.state, d.row])).toEqual([
      ['sw-01', 'down', 2],
      ['sw-02', 'up', 3],
    ]);
    expect(errors).toEqual([]);
  });
});

describe('extraFields', () => {
  it('returns the columns that no contract column uses', () => {
    const frame = csvToFrame('device,rack,serial,ip,status\nsrv-01,R1,ABC123,10.0.0.1,up\n', 'A');
    expect(extraFields(frame, {}).map((f) => f.name)).toEqual(['serial', 'ip']);
    expect(extraFields(frame, { status: 'ip' }).map((f) => f.name)).toEqual(['serial', 'status']);
  });

  it('leaves time fields out', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'device', type: FieldType.string, values: ['sw-01'] },
        { name: 'rack', type: FieldType.string, values: ['R1'] },
        { name: 'job', type: FieldType.string, values: ['snmp'] },
      ],
    });
    expect(extraFields(frame, {}).map((f) => f.name)).toEqual(['job']);
  });
});

describe('readRacks', () => {
  it('reads the racks frame with its defaults', () => {
    const frame = csvToFrame(
      'rack,name,u_height,starting_unit,desc_units,width\nR1,,,,,\nR2,Rack two,48,0,true,10\n',
      'B'
    );
    expect(readRacks(frame, {})).toMatchObject([
      { id: 'R1', name: 'R1', uHeight: 42, startingUnit: 1, descUnits: false, fixedHeight: false, width: 19 },
      { id: 'R2', name: 'Rack two', uHeight: 48, startingUnit: 0, descUnits: true, fixedHeight: true, width: 10 },
    ]);
  });
});

describe('readAlerts', () => {
  it('groups the alerts by device', () => {
    const frame = csvToFrame(
      'device,alertname,severity\nsw-01,HighCpu,warning\nsw-01,Down,critical\nsrv-01,Disk,\n',
      'C'
    );
    const alerts = readAlerts(frame, {});
    expect(alerts.get('sw-01')).toEqual([
      { name: 'HighCpu', severity: 'warning' },
      { name: 'Down', severity: 'critical' },
    ]);
    expect(alerts.get('srv-01')).toEqual([{ name: 'Disk', severity: undefined }]);
  });
});

describe('conversions', () => {
  it('reads numbers and booleans from any type', () => {
    expect([toNumber(' 4 '), toNumber(''), toNumber('x'), toNumber(null), toNumber(Infinity)]).toEqual([
      4,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect([toBoolean('True'), toBoolean(0), toBoolean('no'), toBoolean('maybe'), toBoolean(null)]).toEqual([
      true,
      false,
      false,
      undefined,
      undefined,
    ]);
  });
});
