import { DataFrame, Field, FieldType } from '@grafana/data';
import { toText } from './mapping';

/** Last value of a series that is not empty: the current state. */
function lastValue(field: Field): unknown {
  for (let i = field.values.length - 1; i >= 0; i--) {
    const value = field.values[i];
    if (value !== null && value !== undefined && !(typeof value === 'number' && Number.isNaN(value))) {
      return value;
    }
  }
  return undefined;
}

/** Name of the metric of a series: the item for Zabbix, the metric name for Prometheus, else its name. */
function metricOf(field: Field): string {
  return field.labels?.item ?? field.labels?.__name__ ?? field.name;
}

interface Metric {
  source: Field;
  byDevice: Map<string, unknown>;
}

/**
 * Devices frame with a column per metric of the labelled series of the other frames, so that time series of a
 * monitoring work without a join: a series whose label (device, host...) names a device gives that device the last
 * value of the series, in a column named after its metric (item for Zabbix, __name__ for Prometheus). The columns of
 * the devices frame come first; a metric named like one of them is left out. Unchanged without labelled series.
 */
export function withLabelledSeries(
  devices: DataFrame,
  others: DataFrame[],
  deviceField: Field,
  labels: string[]
): DataFrame {
  const metrics = new Map<string, Metric>();
  for (const frame of others) {
    for (const field of frame.fields) {
      if (field.type !== FieldType.number || !field.labels) {
        continue;
      }
      const label = labels.find((l) => field.labels?.[l] !== undefined);
      if (!label) {
        continue;
      }
      const name = metricOf(field);
      const metric = metrics.get(name) ?? { source: field, byDevice: new Map() };
      const device = field.labels[label];
      // With several series of the same metric for a device, such as two sensors, the first one counts.
      if (!metric.byDevice.has(device)) {
        metric.byDevice.set(device, lastValue(field));
      }
      metrics.set(name, metric);
    }
  }
  const own = new Set(devices.fields.map((f) => f.name.toLowerCase()));
  const added = [...metrics.entries()]
    .filter(([name]) => !own.has(name.toLowerCase()))
    .map(([name, { source, byDevice }]): Field => {
      // The name of the series, such as "sw-01: Temperature", is not the name of the column.
      const { displayName, displayNameFromDS, ...config } = source.config;
      return {
        name,
        type: FieldType.number,
        config,
        values: Array.from({ length: devices.length }, (_, row) => byDevice.get(toText(deviceField.values[row]) ?? '')),
        display: source.display,
      };
    });
  return added.length ? { ...devices, fields: [...devices.fields, ...added] } : devices;
}
