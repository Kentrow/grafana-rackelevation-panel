import { useMemo } from 'react';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { buildModel } from '../model';
import { Device, Rack, RackElevationOptions } from '../types';
import { DeviceLook, deviceLabel, deviceLooks, labelTemplate } from './deviceLook';

export interface DeviceEntry {
  device: Device;
  rack: Rack;
}

/**
 * What the panel draws, from the data and the options: the racks and their devices placed, each device with its rack
 * and its look, and the label of the devices. Computed again only when the data, the options or the theme change.
 */
export function useRackModel(
  series: DataFrame[],
  options: RackElevationOptions,
  /** Racks of the Racks option, variables resolved, one per line: a string so that memoization survives renders. */
  racksKey: string,
  theme: GrafanaTheme2
) {
  const { frames, columns, valueFields, upValues, label, labelSeparator } = options;
  const template = options.labelTemplate.trim();
  const model = useMemo(
    () =>
      buildModel(series, {
        frames,
        columns,
        valueFields,
        upValues,
        racks: racksKey ? racksKey.split('\n') : [],
      }),
    [series, frames, columns, valueFields, upValues, racksKey]
  );
  /** Every device drawn, by name, with its rack. */
  const devices = useMemo(() => {
    const byName = new Map<string, DeviceEntry>();
    for (const r of model.racks) {
      for (const device of [...r.front.map((p) => p.device), ...r.rear.map((p) => p.device), ...r.zeroU]) {
        byName.set(device.name, { device, rack: r.rack });
      }
    }
    return byName;
  }, [model]);
  const zeroU = useMemo(() => new Set(model.racks.flatMap((r) => r.zeroU)), [model]);
  const looks = useMemo(
    () =>
      deviceLooks(
        [...devices.values()].map((d) => d.device),
        model.devicesFrame,
        columns,
        theme
      ),
    [devices, model.devicesFrame, columns, theme]
  );
  // The template, when set, is read once for all the devices.
  const labelOf = useMemo(
    () =>
      template
        ? labelTemplate(template, model.devicesFrame, columns)
        : (device: Device, look: DeviceLook | undefined) => deviceLabel(device, look, label, labelSeparator),
    [template, model.devicesFrame, columns, label, labelSeparator]
  );
  return { model, devices, zeroU, looks, labelOf };
}
