import { FieldType, LinkModel, toDataFrame } from '@grafana/data';
import { deviceLinks, hasLinks, rackLinks } from './links';

const link = (title: string, href: string): LinkModel => ({ title, href, target: '_self', origin: {} });

describe('deviceLinks', () => {
  it('collects the links of a row once, whether set on every field or on one', () => {
    const shared = { links: [{ title: 'NetBox', url: '' }] };
    const frame = toDataFrame({
      fields: [
        { name: 'device', type: FieldType.string, values: ['sw-01', 'sw-02'], config: shared },
        { name: 'rack', type: FieldType.string, values: ['R1', 'R1'], config: shared },
        { name: 'value', type: FieldType.number, values: [1, 2], config: { links: [{ title: 'Dashboard', url: '' }] } },
      ],
    });
    frame.fields[0].getLinks = ({ valueRowIndex }) => [link('NetBox', `/nb/${frame.fields[0].values[valueRowIndex!]}`)];
    frame.fields[1].getLinks = frame.fields[0].getLinks;
    frame.fields[2].getLinks = ({ valueRowIndex }) => [link('Dashboard', `/d/x?var-row=${valueRowIndex}`)];

    expect(deviceLinks(frame, 1).map((l) => l.href)).toEqual(['/nb/sw-02', '/d/x?var-row=1']);
    expect(hasLinks(frame)).toBe(true);
  });

  it('has no links without data links in the field config', () => {
    const frame = toDataFrame({ fields: [{ name: 'device', type: FieldType.string, values: ['sw-01'] }] });
    expect(deviceLinks(frame, 0)).toEqual([]);
    expect(deviceLinks(undefined, 0)).toEqual([]);
    expect(hasLinks(frame)).toBe(false);
  });
});

describe('rackLinks', () => {
  it('keeps the links set on the racks frame by an override, not those of the defaults', () => {
    const fromDefaults = { title: 'Device', url: '/d/device?var-device=${__data.fields.device}' };
    const own = { title: 'Rack in NetBox', url: 'https://netbox/dcim/racks/?q=${__data.fields.rack}' };
    const frame = toDataFrame({
      fields: [
        { name: 'rack', type: FieldType.string, values: ['R1', 'R2'], config: { links: [fromDefaults, own] } },
        { name: 'u_height', type: FieldType.number, values: [42, 48], config: { links: [fromDefaults] } },
      ],
    });
    frame.fields.forEach((f) => {
      f.getLinks = ({ valueRowIndex }) =>
        (f.config.links ?? []).map((l) => link(l.title, `${l.title}:${frame.fields[0].values[valueRowIndex!]}`));
    });
    expect(rackLinks(frame, 1, [fromDefaults]).map((l) => l.href)).toEqual(['Rack in NetBox:R2']);
    expect(rackLinks(frame, undefined, [fromDefaults])).toEqual([]);
    expect(rackLinks(undefined, 0)).toEqual([]);
  });
});
