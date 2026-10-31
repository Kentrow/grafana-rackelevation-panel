import { DataFrame, Field, FieldType } from '@grafana/data';
import { Alert, Column, ColumnMapping, COLUMNS, Device, Face, LayoutError, Rack } from '../types';
import { deviceState } from './status';

export const DEFAULT_RACK_HEIGHT = 42;
export const DEFAULT_RACK_WIDTH = 19;

/** Field whose name or display name is `name`, ignoring case. */
export function findField(frame: DataFrame, name: string | undefined): Field | undefined {
  if (!name) {
    return undefined;
  }
  const wanted = name.trim().toLowerCase();
  return frame.fields.find((f) => f.name.toLowerCase() === wanted || f.config.displayName?.toLowerCase() === wanted);
}

/** Field of a devices frame column: the mapped name if any, else the default name. */
export function columnField(frame: DataFrame, column: Column, mapping: ColumnMapping): Field | undefined {
  return findField(frame, mapping[column] || column);
}

export type DeviceFields = Partial<Record<Column, Field>>;

/**
 * Field of each column. A field mapped to a column, or picked as colour field, is not taken by the default name of
 * another column: with status mapped to Prometheus' Value column, value must not match it too.
 */
export function deviceFields(frame: DataFrame, mapping: ColumnMapping, valueFields: string[] = []): DeviceFields {
  const fields: DeviceFields = {};
  for (const column of COLUMNS) {
    fields[column] = findField(frame, mapping[column]);
  }
  const mapped = new Set([...Object.values(fields), ...valueFields.map((name) => findField(frame, name))]);
  for (const column of COLUMNS) {
    if (!mapping[column]) {
      const field = findField(frame, column);
      fields[column] = field && !mapped.has(field) ? field : undefined;
    }
  }
  if (valueFields.length > 0) {
    // The colour comes from the colour fields instead.
    fields.value = undefined;
  }
  return fields;
}

/** Fields that can give the colour of a device, in order: the colour fields, else the value column. */
export function colourFields(frame: DataFrame, mapping: ColumnMapping, valueFields: string[] = []): Field[] {
  if (valueFields.length === 0) {
    const value = deviceFields(frame, mapping).value;
    return value ? [value] : [];
  }
  return valueFields.map((name) => findField(frame, name)).filter((f): f is Field => f !== undefined);
}

/**
 * Fields of the devices frame that no column uses, shown as key: value in the tooltip. Time fields are left out:
 * after a join of Prometheus queries there is one per query, all with the same time.
 */
export function extraFields(frame: DataFrame, mapping: ColumnMapping, valueFields: string[] = []): Field[] {
  const used = new Set([
    ...Object.values(deviceFields(frame, mapping, valueFields)),
    ...colourFields(frame, mapping, valueFields),
  ]);
  return frame.fields.filter((f) => !used.has(f) && f.type !== FieldType.time);
}

export function toText(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  const text = String(raw).trim();
  return text === '' ? undefined : text;
}

export function toNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : undefined;
  }
  const text = toText(raw);
  if (text === undefined) {
    return undefined;
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

export function toBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') {
    return raw;
  }
  const text = toText(raw)?.toLowerCase();
  if (text === undefined) {
    return undefined;
  }
  if (['true', '1', 'yes', 'y'].includes(text)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(text)) {
    return false;
  }
  return undefined;
}

/** front or rear, also from labels and GraphQL enums such as Front or FACE_REAR. */
function toFace(raw: unknown): Face | undefined {
  const text = toText(raw)?.toLowerCase();
  return text?.includes('rear') ? 'rear' : text?.includes('front') ? 'front' : undefined;
}

/** Width in inches, also from labels and GraphQL enums such as "19 inches" or WIDTH_10IN. */
function toInches(raw: unknown): number | undefined {
  const digits = toText(raw)?.match(/\d+(\.\d+)?/);
  return toNumber(raw) ?? (digits ? Number(digits[0]) : undefined);
}

const at = (field: Field | undefined, row: number): unknown => field?.values[row];

const positive = (n: number | undefined) => (n !== undefined && n > 0 ? n : undefined);

/** First colour field with a value at this row. */
function colourOf(colours: Array<{ field: Field; index: number }>, row: number): Pick<Device, 'value' | 'valueField'> {
  for (const { field, index } of colours) {
    const value = toNumber(field.values[row]);
    if (value !== undefined) {
      return { value, valueField: index };
    }
  }
  return {};
}

const toTime = (raw: unknown) => (raw instanceof Date ? raw.getTime() : (toNumber(raw) ?? Date.parse(String(raw))));

/**
 * Row of the most recent time of each device, when the frame has a time field: a range query gives one row per
 * device and per point, and only the last point is the current state.
 */
function latestRows(frame: DataFrame, device: Field | undefined): Map<string, number> | undefined {
  const time = frame.fields.find((f) => f.type === FieldType.time);
  if (!time || !device) {
    return undefined;
  }
  const latest = new Map<string, number>();
  for (let row = 0; row < frame.length; row++) {
    const name = toText(device.values[row]);
    const previous = name === undefined ? undefined : latest.get(name);
    if (name !== undefined && (previous === undefined || toTime(time.values[row]) >= toTime(time.values[previous]))) {
      latest.set(name, row);
    }
  }
  return latest;
}

/**
 * One device per row. Rows without a name or a rack are skipped with an error; duplicates and children are left to
 * the layout. Defaults follow NetBox: 1U, front face, full depth. With a time field, only the latest row of each device
 * is read.
 */
export function readDevices(
  frame: DataFrame,
  mapping: ColumnMapping,
  upValues: string[],
  valueFields: string[] = []
): { devices: Device[]; errors: LayoutError[] } {
  const f = deviceFields(frame, mapping, valueFields);
  const colours = colourFields(frame, mapping, valueFields).map((field) => ({
    field,
    index: frame.fields.indexOf(field),
  }));
  const errors: LayoutError[] = [];
  const missing = (['device', 'rack'] as const).filter((c) => !f[c]);
  if (missing.length > 0) {
    errors.push({
      kind: 'missing-column',
      message: `Devices frame has no ${missing.map((c) => `"${mapping[c] || c}"`).join(' or ')} column.`,
    });
    return { devices: [], errors };
  }

  const latest = latestRows(frame, f.device);
  const devices: Device[] = [];
  for (let row = 0; row < frame.length; row++) {
    const name = toText(at(f.device, row));
    if (name && latest && latest.get(name) !== row) {
      continue;
    }
    const rack = toText(at(f.rack, row));
    const parent = toText(at(f.parent_device, row));
    if (!name) {
      errors.push({ kind: 'missing-name', message: `Row ${row + 1} has no device name.` });
      continue;
    }
    // Children are drawn in their parent's tooltip only, so they do not need a rack.
    if (!rack && !parent) {
      errors.push({ kind: 'missing-rack', message: `${name} has no rack.`, device: name });
      continue;
    }
    devices.push({
      name,
      rack: rack ?? '',
      position: toNumber(at(f.position, row)),
      uHeight: toNumber(at(f.u_height, row)) ?? 1,
      face: toFace(at(f.face, row)) ?? 'front',
      fullDepth: toBoolean(at(f.is_full_depth, row)) ?? true,
      role: toText(at(f.role, row)),
      model: toText(at(f.model, row)),
      state: f.status ? deviceState(at(f.status, row), upValues) : 'unknown',
      ...colourOf(colours, row),
      parent,
      row,
      children: [],
      alerts: [],
    });
  }
  return { devices, errors };
}

/** Racks of the optional racks frame, in frame order. */
export function readRacks(frame: DataFrame, mapping: ColumnMapping): Rack[] {
  const id = columnField(frame, 'rack', mapping) ?? findField(frame, 'rack');
  if (!id) {
    return [];
  }
  const name = findField(frame, 'name');
  const height = findField(frame, 'u_height');
  const start = findField(frame, 'starting_unit');
  const desc = findField(frame, 'desc_units');
  const site = findField(frame, 'site');
  const width = findField(frame, 'width');
  const racks: Rack[] = [];
  for (let row = 0; row < frame.length; row++) {
    const rack = toText(at(id, row));
    if (!rack) {
      continue;
    }
    const uHeight = toNumber(at(height, row));
    racks.push({
      id: rack,
      name: toText(at(name, row)) ?? rack,
      uHeight: uHeight ?? DEFAULT_RACK_HEIGHT,
      startingUnit: toNumber(at(start, row)) ?? 1,
      descUnits: toBoolean(at(desc, row)) ?? false,
      site: toText(at(site, row)),
      fixedHeight: uHeight !== undefined,
      width: positive(toInches(at(width, row))) ?? DEFAULT_RACK_WIDTH,
      row,
    });
  }
  return racks;
}

/** Active alerts by device name. */
export function readAlerts(frame: DataFrame, mapping: ColumnMapping): Map<string, Alert[]> {
  const alerts = new Map<string, Alert[]>();
  const device = columnField(frame, 'device', mapping) ?? findField(frame, 'device');
  if (!device) {
    return alerts;
  }
  const name = findField(frame, 'alertname');
  const severity = findField(frame, 'severity');
  for (let row = 0; row < frame.length; row++) {
    const key = toText(at(device, row));
    if (!key) {
      continue;
    }
    const list = alerts.get(key) ?? [];
    list.push({ name: toText(at(name, row)), severity: toText(at(severity, row)) });
    alerts.set(key, list);
  }
  return alerts;
}
