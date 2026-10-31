import { dashboardVariables } from '../testing/panel';
import { Device } from '../types';
import { emphasisOf, resolveList, variableValues } from './variables';

const dashboard = dashboardVariables;

const device = (name: string, role?: string) => ({ name, role }) as Device;

describe('resolveList', () => {
  it('splits multi-value variables and drops empty entries', () => {
    expect(resolveList(['$rack', ' ', 'C'], dashboard({ rack: ['A', ' B'] }))).toEqual(['A', 'B', 'C']);
  });
});

describe('variableValues', () => {
  const replace = dashboard({ device: ['sw-01', 'sw-02'], empty: [] });

  it('reads the values of a variable, written with or without $', () => {
    expect(variableValues('device', replace)).toEqual(['sw-01', 'sw-02']);
    expect(variableValues('$device', replace)).toEqual(['sw-01', 'sw-02']);
    expect(variableValues('${device}', replace)).toEqual(['sw-01', 'sw-02']);
  });

  it('returns nothing when the dashboard has no such variable, or it is empty', () => {
    expect(variableValues('host', replace)).toEqual([]);
    expect(variableValues('empty', replace)).toEqual([]);
    expect(variableValues('', replace)).toEqual([]);
  });
});

describe('emphasisOf', () => {
  it('highlights the devices of the variable and fades the others', () => {
    const highlighted = new Set(['sw-01']);
    expect(emphasisOf(device('sw-01'), highlighted, new Set())).toBe('highlight');
    expect(emphasisOf(device('srv-01'), highlighted, new Set())).toBe('dim');
    expect(emphasisOf(device('srv-01'), new Set(), new Set())).toBeUndefined();
  });

  it('filters roles ignoring case, before the highlight', () => {
    const roles = new Set(['switch']);
    expect(emphasisOf(device('sw-01', 'Switch'), new Set(), roles)).toBeUndefined();
    expect(emphasisOf(device('srv-01', 'server'), new Set(['srv-01']), roles)).toBe('filtered');
    expect(emphasisOf(device('pp-01'), new Set(), roles)).toBe('filtered');
  });
});
