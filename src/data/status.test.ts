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

describe('mappedStatusColor, every kind of match', () => {
  const special = (match: SpecialValueMatch, color: string): ValueMapping => ({
    type: MappingType.SpecialValue,
    options: { match, result: { color } },
  });

  it.each([
    [SpecialValueMatch.True, true, 'green'],
    [SpecialValueMatch.True, 'TRUE', 'green'],
    [SpecialValueMatch.False, false, 'red'],
    [SpecialValueMatch.False, 'false', 'red'],
    [SpecialValueMatch.NaN, NaN, 'gray'],
    [SpecialValueMatch.Null, undefined, 'gray'],
    [SpecialValueMatch.NullAndNaN, null, 'gray'],
    [SpecialValueMatch.NullAndNaN, NaN, 'gray'],
    [SpecialValueMatch.Empty, '', 'gray'],
  ])('matches the special value %s with %p', (match, raw, color) => {
    expect(mappedStatusColor([special(match, color)], raw)).toBe(color);
  });

  it.each([
    [SpecialValueMatch.True, 'yes'],
    [SpecialValueMatch.NaN, 'NaN text'],
    [SpecialValueMatch.Null, ''],
    [SpecialValueMatch.Empty, null],
  ])('does not match %s with %p', (match, raw) => {
    expect(mappedStatusColor([special(match, 'gray')], raw)).toBeUndefined();
  });

  it('anchors a regex written without slashes, and skips an invalid one', () => {
    const anchored: ValueMapping[] = [
      { type: MappingType.RegexToText, options: { pattern: 'plan.*', result: { color: 'blue' } } },
    ];
    expect(mappedStatusColor(anchored, 'planned')).toBe('blue');
    expect(mappedStatusColor(anchored, 'unplanned')).toBeUndefined();
    const invalid: ValueMapping[] = [
      { type: MappingType.RegexToText, options: { pattern: '/(/', result: { color: 'blue' } } },
    ];
    expect(mappedStatusColor(invalid, '(')).toBeUndefined();
  });

  it('reads open ranges and numbers sent as text', () => {
    const ranges: ValueMapping[] = [
      { type: MappingType.RangeToText, options: { from: null, to: 0, result: { color: 'red' } } },
      { type: MappingType.RangeToText, options: { from: 100, to: null, result: { color: 'purple' } } },
    ];
    expect(mappedStatusColor(ranges, -5)).toBe('red');
    expect(mappedStatusColor(ranges, '250')).toBe('purple');
    expect(mappedStatusColor(ranges, 50)).toBeUndefined();
    expect(mappedStatusColor(ranges, 'down')).toBeUndefined();
  });

  it('takes the first matching mapping', () => {
    const both: ValueMapping[] = [
      { type: MappingType.ValueToText, options: { '1': { color: 'green' } } },
      { type: MappingType.RangeToText, options: { from: 0, to: 10, result: { color: 'yellow' } } },
    ];
    expect(mappedStatusColor(both, 1)).toBe('green');
    expect(mappedStatusColor(both, 2)).toBe('yellow');
  });
});
