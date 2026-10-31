import { DataFrame } from '@grafana/data';
import { identifyFrames } from './data/identify';
import { readAlerts, readDevices, readRacks } from './data/mapping';
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
  const { devices, errors } = readDevices(identified.devices, options.columns, options.upValues, options.valueFields);
  const layout = placeDevices({
    devices,
    racks: identified.racks ? readRacks(identified.racks, options.columns) : undefined,
    alerts: identified.alerts ? readAlerts(identified.alerts, options.columns) : undefined,
    order: options.racks,
  });
  return {
    racks: layout.racks,
    errors: [...identified.errors, ...errors, ...layout.errors],
    devicesFrame: identified.devices,
    racksFrame: identified.racks,
  };
}
