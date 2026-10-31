import { toDataFrame } from '@grafana/data';
import { csvToFrame, loadFixture } from '../testing/fixtures';
import { identifyFrames } from './identify';

const devices = csvToFrame('device,rack,position\nsw-01,R1,1\n', 'A');
const racks = csvToFrame('rack,u_height\nR1,42\n', 'B');
const alerts = csvToFrame('device,alertname\nsw-01,HighCpu\n', 'C');

describe('identifyFrames', () => {
  it('finds each frame by its columns, whatever the order', () => {
    const found = identifyFrames([alerts, racks, devices], {}, {});
    expect([found.devices, found.racks, found.alerts]).toEqual([devices, racks, alerts]);
    expect(found.errors).toEqual([]);
  });

  it('takes a frame with device and rack when none has a position', () => {
    const inventory = csvToFrame('device,rack\nsw-01,R1\n', 'A');
    expect(identifyFrames([inventory], {}, {}).devices).toBe(inventory);
  });

  it('uses the mapped column names', () => {
    const inventory = csvToFrame('name,rack_name,pos\nsw-01,R1,1\n', 'A');
    expect(identifyFrames([inventory], {}, { device: 'name', rack: 'rack_name', position: 'pos' }).devices).toBe(
      inventory
    );
  });

  it('takes the frames picked in the options, by refId or name', () => {
    const other = csvToFrame('device,rack,position\nsw-02,R2,1\n', 'Z');
    const found = identifyFrames([devices, other], { devices: 'Z' }, {});
    expect(found.devices).toBe(other);
    expect(found.errors.map((e) => e.kind)).toEqual(['unjoined-frame']);
  });

  it('reports a picked frame that does not exist, without guessing another one', () => {
    const found = identifyFrames([devices, racks], { racks: 'nope' }, {});
    expect(found.racks).toBeUndefined();
    expect(found.errors.map((e) => e.message)).toEqual(['No frame named "nope" for the racks.']);
  });

  it('reports when there is no devices frame, and skips empty frames', () => {
    const found = identifyFrames([toDataFrame({ refId: 'A', fields: [] }), racks], {}, {});
    expect(found.devices).toBeUndefined();
    expect(found.errors.map((e) => e.kind)).toEqual(['no-devices-frame']);
  });

  it('points unjoined Prometheus frames to the Join by field transformation', () => {
    const found = identifyFrames(loadFixture('prometheus-auto'), {}, {});
    expect(found.devices?.name).toBe('device_info');
    expect(found.errors.map((e) => e.message)).toEqual([
      'Frame "temperature" also has a device column and is ignored. Join it to the devices frame with the "Join by field" transformation (mode OUTER (TABULAR), field device).',
      'Frame "up" also has a device column and is ignored. Join it to the devices frame with the "Join by field" transformation (mode OUTER (TABULAR), field device).',
    ]);
  });
});
