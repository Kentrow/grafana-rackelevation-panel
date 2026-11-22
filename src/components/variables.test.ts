import { dashboardVariables } from '../testing/panel';
import { Device } from '../types';
import { emphasisOf, matchingNames, resolveList, variableValues } from './variables';

const dashboard = dashboardVariables;

const device = (name: string, role?: string) => ({ name, role }) as Device;

describe('resolveList', () => {
  it('splits multi-value variables and drops empty entries', () => {
    expect(resolveList(['$rack', ' ', 'C'], dashboard({ rack: ['A', ' B'] }))).toEqual(['A', 'B', 'C']);
  });

  it('keeps the commas of names, typed or in variables', () => {
    expect(
      resolveList(['Paris, DC1', '$rack', '$site'], dashboard({ rack: ['Lyon, B', 'Nice'], site: ['Lille, 2'] }))
    ).toEqual(['Paris, DC1', 'Lyon, B', 'Nice', 'Lille, 2']);
  });
});

describe('variableValues', () => {
  const replace = dashboard({ device: ['sw-01', 'sw-02'], empty: [] });

  it('reads the values of a variable, written with or without $', () => {
    expect(variableValues('device', replace)).toEqual(['sw-01', 'sw-02']);
    expect(variableValues('$device', replace)).toEqual(['sw-01', 'sw-02']);
    expect(variableValues('${device}', replace)).toEqual(['sw-01', 'sw-02']);
  });

  it('keeps the commas of the values', () => {
    expect(variableValues('device', dashboard({ device: ['Paris, sw-01', 'sw-02'] }))).toEqual([
      'Paris, sw-01',
      'sw-02',
    ]);
    expect(variableValues('device', dashboard({ device: ['Paris, sw-01'] }))).toEqual(['Paris, sw-01']);
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

describe('matchingNames', () => {
  const names = ['sw-a1-tor-01', 'sw-a1-tor-02', 'srv-a1-01', 'sw.core', 'swXcore'];

  it('keeps the names given in full, in the order of the devices', () => {
    expect(matchingNames(['srv-a1-01', 'sw-a1-tor-01', 'nope'], names)).toEqual(['sw-a1-tor-01', 'srv-a1-01']);
  });

  it('matches * as any run of characters, the rest of the value literally', () => {
    expect(matchingNames(['sw-a1-*'], names)).toEqual(['sw-a1-tor-01', 'sw-a1-tor-02']);
    expect(matchingNames(['*-01'], names)).toEqual(['sw-a1-tor-01', 'srv-a1-01']);
    expect(matchingNames(['sw.*'], names)).toEqual(['sw.core']);
    expect(matchingNames(['*'], names)).toEqual(names);
  });
});
