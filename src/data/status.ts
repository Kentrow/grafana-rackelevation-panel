import { MappingType, SpecialValueMatch, ValueMapping, ValueMappingResult } from '@grafana/data';
import { DEFAULT_OPTIONS, DeviceState } from '../types';

export const DEFAULT_UP_VALUES = DEFAULT_OPTIONS.upValues;

/** In service when the value is one of upValues, unknown when there is no value, out of service otherwise. */
export function deviceState(raw: unknown, upValues: string[]): DeviceState {
  if (raw === null || raw === undefined) {
    return 'unknown';
  }
  const value = String(raw).trim().toLowerCase();
  if (value === '' || value === 'nan') {
    return 'unknown';
  }
  return upValues.some((v) => v.trim().toLowerCase() === value) ? 'up' : 'down';
}

function specialMatch(match: SpecialValueMatch, raw: unknown): boolean {
  const isNull = raw === null || raw === undefined;
  const isNaN = typeof raw === 'number' && Number.isNaN(raw);
  switch (match) {
    case SpecialValueMatch.True:
      return raw === true || String(raw).toLowerCase() === 'true';
    case SpecialValueMatch.False:
      return raw === false || String(raw).toLowerCase() === 'false';
    case SpecialValueMatch.Null:
      return isNull;
    case SpecialValueMatch.NaN:
      return isNaN;
    case SpecialValueMatch.NullAndNaN:
      return isNull || isNaN;
    case SpecialValueMatch.Empty:
      return raw === '';
  }
}

function regex(pattern: string): RegExp | undefined {
  const literal = pattern.match(/^\/(.*)\/([gimsuy]*)$/);
  try {
    return literal ? new RegExp(literal[1], literal[2]) : new RegExp(`^${pattern}$`);
  } catch {
    return undefined;
  }
}

/**
 * Colour name given by the value mappings of the status field to a status value, if any. Grafana's own
 * matcher is not exported; this one follows its rules for the colour only.
 */
export function mappedStatusColor(mappings: ValueMapping[] | undefined, raw: unknown): string | undefined {
  for (const mapping of mappings ?? []) {
    let result: ValueMappingResult | undefined;
    if (mapping.type === MappingType.ValueToText) {
      result = raw === null || raw === undefined ? undefined : mapping.options[String(raw)];
    } else if (mapping.type === MappingType.RangeToText) {
      const n = typeof raw === 'number' ? raw : Number(raw);
      const { from, to } = mapping.options;
      if (Number.isFinite(n) && (from === null || n >= from) && (to === null || n <= to)) {
        result = mapping.options.result;
      }
    } else if (mapping.type === MappingType.RegexToText) {
      result = regex(mapping.options.pattern)?.test(String(raw ?? '')) ? mapping.options.result : undefined;
    } else if (specialMatch(mapping.options.match, raw)) {
      result = mapping.options.result;
    }
    if (result) {
      return result.color;
    }
  }
  return undefined;
}
