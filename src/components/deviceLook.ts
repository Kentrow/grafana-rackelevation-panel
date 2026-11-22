import { DataFrame, Field, formattedValueToString, GrafanaTheme2 } from '@grafana/data';
import { columnField, deviceFields, findField } from '../data/mapping';
import { mappedStatusColor } from '../data/status';
import { Column, COLUMNS, ColumnMapping, Device, LabelPart } from '../types';

/** How a device is drawn: its visual state. */
export interface DeviceLook {
  fill: string;
  stroke: string;
  strokeWidth: number;
  textColor: string;
  /** Not monitored: grey hatching over the fill. */
  hatched: boolean;
  /** Out of service: label struck through. */
  strike: boolean;
  /** Value of the colour field, formatted with its unit. */
  valueText?: string;
}

/**
 * Looks of every device of the model. The colour of a device in service is the colour Grafana gives to its value
 * (thresholds, colour scheme, value mappings); a value mapping colour on the status field replaces the red of a device
 * out of service and the green border of a device without value.
 */
export function deviceLooks(
  devices: Device[],
  frame: DataFrame | undefined,
  columns: ColumnMapping,
  theme: GrafanaTheme2
): Map<Device, DeviceLook> {
  const looks = new Map<Device, DeviceLook>();
  const fields = frame ? deviceFields(frame, columns) : {};
  const neutralBorder = theme.colors.border.strong;
  // A thousand devices share a handful of colours: resolve each colour once.
  const named = new Map<string, string>();
  const contrast = new Map<string, string>();
  const colorByName = (name: string) =>
    named.get(name) ?? named.set(name, theme.visualization.getColorByName(name)).get(name)!;
  const textOn = (fill: string) =>
    contrast.get(fill) ?? contrast.set(fill, theme.colors.getContrastText(fill)).get(fill)!;
  for (const device of devices) {
    const colourField = device.valueField !== undefined ? frame?.fields[device.valueField] : undefined;
    const display = device.value !== undefined ? colourField?.display?.(device.value) : undefined;
    const valueText = display ? formattedValueToString(display) : device.value?.toString();
    const statusColorName = fields.status
      ? mappedStatusColor(fields.status.config.mappings, fields.status.values[device.row])
      : undefined;
    const statusColor = statusColorName ? colorByName(statusColorName) : undefined;

    let look: DeviceLook;
    if (device.state === 'down') {
      const fill = statusColor ?? theme.colors.error.main;
      look = {
        fill,
        stroke: neutralBorder,
        strokeWidth: 1,
        textColor: textOn(fill),
        hatched: false,
        strike: true,
      };
    } else if (display?.color) {
      // A device with a value is monitored even without a status column.
      const fill = colorByName(display.color);
      look = {
        fill,
        stroke: neutralBorder,
        strokeWidth: 1,
        textColor: textOn(fill),
        hatched: false,
        strike: false,
      };
    } else if (device.state === 'unknown') {
      const fill = theme.colors.background.secondary;
      look = {
        fill,
        stroke: theme.colors.border.medium,
        strokeWidth: 1,
        textColor: theme.colors.text.secondary,
        hatched: true,
        strike: false,
      };
    } else {
      const fill = theme.colors.background.elevated;
      look = {
        fill,
        stroke: statusColor ?? theme.colors.success.main,
        strokeWidth: 2,
        textColor: theme.colors.text.primary,
        hatched: false,
        strike: false,
      };
    }
    looks.set(device, { ...look, valueText });
  }
  return looks;
}

/** One-line label from the parts chosen in the options, in their order. */
export function deviceLabel(
  device: Device,
  look: DeviceLook | undefined,
  parts: LabelPart[],
  separator: string
): string {
  const values: Record<LabelPart, string | undefined> = {
    name: device.name,
    model: device.model,
    value: look?.valueText,
    role: device.role,
  };
  return parts
    .map((p) => values[p])
    .filter(Boolean)
    .join(separator ? ` ${separator} ` : ' ');
}

/** Text of a field at a row, as Grafana displays it: unit, decimals and value mappings. */
function fieldText(field: Field, row: number): string {
  const raw = field.values[row];
  if (raw === null || raw === undefined || raw === '') {
    return '';
  }
  return field.display ? formattedValueToString(field.display(raw)) : String(raw);
}

/**
 * Separators left at the ends of a label when the columns around them are empty: a separator alone between spaces,
 * not a sign written against a number.
 */
const LOOSE_ENDS = /^(\s*[·|,;:/\-–—](\s+|$))+|((^|\s+)[·|,;:/\-–—]\s*)+$/g;

/**
 * Label of each device from a template such as `{device} · {ip}`: `{value}` is the colour value with its unit, any
 * other name a column of the device row, the columns of the contract by their contract name even when mapped to
 * another one. Unknown or empty columns are empty. The template is read once, then applied to every device.
 */
export function labelTemplate(
  template: string,
  frame: DataFrame | undefined,
  columns: ColumnMapping
): (device: Device, look: DeviceLook | undefined) => string {
  const parts = template.split(/(\{[^{}]+\})/);
  const resolvers = parts.map((part): ((device: Device, look: DeviceLook | undefined) => string) => {
    const name = /^\{([^{}]+)\}$/.exec(part)?.[1].trim();
    if (name === undefined) {
      return () => part;
    }
    if (name.toLowerCase() === 'value') {
      return (_, look) => look?.valueText ?? '';
    }
    if (name.toLowerCase() === 'device') {
      return (device) => device.name;
    }
    const column = COLUMNS.find((c) => c === name.toLowerCase()) as Column | undefined;
    const field = frame && ((column && columnField(frame, column, columns)) || findField(frame, name));
    return field ? (device) => fieldText(field, device.row) : () => '';
  });
  return (device, look) =>
    resolvers
      .map((resolve) => resolve(device, look))
      .join('')
      .replace(LOOSE_ENDS, '')
      .trim();
}
