import { InterpolateFunction } from '@grafana/data';
import { Device } from '../types';
import { Emphasis } from './DeviceRect';

/** Between the values of a multi-value variable: names can hold commas, never this control character. */
const SEPARATOR = '\u001f';

/** Format of replaceVariables that keeps the values of a multi-value variable apart. */
const keepApart = (value: unknown) => (Array.isArray(value) ? value.join(SEPARATOR) : String(value));

const split = (text: string) =>
  text
    .split(SEPARATOR)
    .map((v) => v.trim())
    .filter(Boolean);

/** Option list entries with variables replaced, multi-value variables split. */
export function resolveList(values: string[] | undefined, replaceVariables: InterpolateFunction): string[] {
  return (values ?? []).flatMap((v) => split(replaceVariables(v, undefined, keepApart)));
}

/** Variable name of an option, written with or without $ and braces. */
export const variableName = (name: string | undefined) => name?.trim().replace(/^\$\{?|\}$/g, '') ?? '';

/** Values of a dashboard variable, several for a multi-value one; none when the dashboard has no such variable. */
export function variableValues(name: string | undefined, replaceVariables: InterpolateFunction): string[] {
  const variable = variableName(name);
  if (!variable) {
    return [];
  }
  const expression = `\${${variable}}`;
  const value = replaceVariables(expression, undefined, keepApart);
  return value === expression ? [] : split(value);
}

/** Pattern of a variable value: * stands for any run of characters, the rest is literal. */
const patternOf = (value: string) =>
  new RegExp(
    `^${value
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`
  );

/** Names, in their order, given in full by one of the values or matching one with a * wildcard, such as sw-a1-*. */
export function matchingNames(values: string[], names: Iterable<string>): string[] {
  const exact = new Set(values.filter((v) => !v.includes('*')));
  const patterns = values.filter((v) => v.includes('*')).map(patternOf);
  return [...names].filter((name) => exact.has(name) || patterns.some((p) => p.test(name)));
}

/**
 * Emphasis of a device: out of the role filter it is faded and inert, so that the rack keeps its shape;
 * otherwise, while some devices are highlighted, the others are faded.
 */
export function emphasisOf(device: Device, highlighted: Set<string>, roles: Set<string>): Emphasis | undefined {
  if (roles.size > 0 && !roles.has(device.role?.toLowerCase() ?? '')) {
    return 'filtered';
  }
  if (highlighted.size > 0) {
    return highlighted.has(device.name) ? 'highlight' : 'dim';
  }
  return undefined;
}
