import { InterpolateFunction } from '@grafana/data';
import { Device } from '../types';
import { Emphasis } from './DeviceRect';

/** Option list entries with variables replaced, multi-value variables split. */
export function resolveList(values: string[] | undefined, replaceVariables: InterpolateFunction): string[] {
  return (values ?? [])
    .flatMap((v) => replaceVariables(v, undefined, 'csv').split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Variable name of an option, written with or without $ and braces. */
export const variableName = (name: string | undefined) => name?.trim().replace(/^\$\{?|\}$/g, '') ?? '';

/** Values of a dashboard variable, several for a multi-value one; none when the dashboard has no such variable. */
export function variableValues(name: string | undefined, replaceVariables: InterpolateFunction): string[] {
  const variable = variableName(name);
  if (!variable) {
    return [];
  }
  const expression = `\${${variable}:csv}`;
  const value = replaceVariables(expression);
  if (value === expression) {
    return [];
  }
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
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
