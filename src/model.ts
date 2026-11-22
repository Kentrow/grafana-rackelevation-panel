import { DataFrame } from '@grafana/data';
import { identifyFrames } from './data/identify';
import { columnField, readAlerts, readDevices, readRacks } from './data/mapping';
import { withLabelledSeries } from './data/series';
import { placeDevices } from './layout/place';
import { ColumnMapping, FrameSelection, Layout } from './types';

export interface ModelOptions {
  frames: FrameSelection;
  columns: ColumnMapping;
  /** Colour fields in order; empty means the value column. */
  valueFields: string[];
  upValues: string[];
  /** Racks to show, in this order, variables already replaced. Empty means all. */
  racks: string[];
  /** Label of the time series that names their device; empty: the device column name, then host. */
  seriesLabel?: string;
  /** Alert severities drawn as critical. */
  criticalSeverities?: string[];
}

export interface RackModel extends Layout {
  /** Frame the devices were read from, for display values and data links. */
  devicesFrame?: DataFrame;
  /** Racks frame, for the data links of the racks. */
  racksFrame?: DataFrame;
}

/** Data frames to laid out racks: identification, mapping, placement. Pure, memoized by the panel. */
export function buildModel(frames: DataFrame[], options: ModelOptions): RackModel {
  const identified = identifyFrames(frames, options.frames, options.columns);
  if (!identified.devices) {
    return { racks: [], errors: identified.errors };
  }
  // The time series of a monitoring, labelled with the device they measure, become columns of the devices frame.
  const deviceField = columnField(identified.devices, 'device', options.columns);
  const others = frames.filter((f) => f !== identified.devices && f !== identified.racks && f !== identified.alerts);
  const labels = options.seriesLabel?.trim()
    ? [options.seriesLabel.trim()]
    : [options.columns.device || 'device', 'host'];
  const devicesFrame = deviceField
    ? withLabelledSeries(identified.devices, others, deviceField, labels)
    : identified.devices;
  const { devices, errors } = readDevices(devicesFrame, options.columns, options.upValues, options.valueFields);
  const layout = placeDevices({
    devices,
    racks: identified.racks ? readRacks(identified.racks, options.columns) : undefined,
    alerts: identified.alerts ? readAlerts(identified.alerts, options.columns, options.criticalSeverities) : undefined,
    order: options.racks,
  });
  return {
    racks: layout.racks,
    errors: [...identified.errors, ...errors, ...layout.errors],
    devicesFrame,
    racksFrame: identified.racks,
  };
}
