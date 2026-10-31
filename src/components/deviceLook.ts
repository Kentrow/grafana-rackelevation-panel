import { DataFrame, formattedValueToString, GrafanaTheme2 } from '@grafana/data';
import { deviceFields } from '../data/mapping';
import { mappedStatusColor } from '../data/status';
import { ColumnMapping, Device, LabelPart } from '../types';

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
