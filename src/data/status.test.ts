import { MappingType, SpecialValueMatch, ValueMapping } from '@grafana/data';
import { DEFAULT_UP_VALUES, deviceState, mappedStatusColor } from './status';

describe('deviceState', () => {
  it.each([
    ['up', 'up'],
    ['UP ', 'up'],
    [1, 'up'],
    ['1', 'up'],
    [true, 'up'],
    ['active', 'up'],
    ['down', 'down'],
    [0, 'down'],
    ['offline', 'down'],
    [false, 'down'],
    [null, 'unknown'],
    [undefined, 'unknown'],
    ['', 'unknown'],
    [NaN, 'unknown'],
  ])('reads %p as %s', (raw, state) => {
    expect(deviceState(raw, DEFAULT_UP_VALUES)).toBe(state);
  });

  it('uses the configured values', () => {
    expect(deviceState('online', ['ok', 'online'])).toBe('up');
    expect(deviceState('up', ['ok', 'online'])).toBe('down');
  });
});

describe('mappedStatusColor', () => {
  const mappings: ValueMapping[] = [
    { type: MappingType.ValueToText, options: { maintenance: { color: 'orange', text: 'Maintenance' } } },
    { type: MappingType.RangeToText, options: { from: 2, to: 5, result: { color: 'purple' } } },
    { type: MappingType.RegexToText, options: { pattern: '/^plan/i', result: { color: 'blue' } } },
    { type: MappingType.SpecialValue, options: { match: SpecialValueMatch.Null, result: { color: 'gray' } } },
  ];

  it.each([
    ['maintenance', 'orange'],
    [3, 'purple'],
    ['Planned', 'blue'],
    [null, 'gray'],
    ['down', undefined],
  ])('maps %p to %p', (raw, color) => {
    expect(mappedStatusColor(mappings, raw)).toBe(color);
  });

  it('ignores a matching mapping without a colour', () => {
    const textOnly: ValueMapping[] = [{ type: MappingType.ValueToText, options: { '0': { text: 'Down' } } }];
    expect(mappedStatusColor(textOnly, 0)).toBeUndefined();
  });
});
