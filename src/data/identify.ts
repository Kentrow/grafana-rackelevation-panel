import { DataFrame } from '@grafana/data';
import { ColumnMapping, FrameSelection, LayoutError } from '../types';
import { columnField, findField } from './mapping';

export interface IdentifiedFrames {
  devices?: DataFrame;
  racks?: DataFrame;
  alerts?: DataFrame;
  errors: LayoutError[];
}

const frameLabel = (frame: DataFrame) => frame.name || frame.refId || 'unnamed';

const matches = (frame: DataFrame, wanted: string) => frame.refId === wanted || frame.name === wanted;

/**
 * Finds the devices, racks and alerts frames: the frames picked in the options first, then by their
 * columns. Other frames with a device column are reported, since the panel does not join frames itself.
 */
export function identifyFrames(
  frames: DataFrame[],
  selection: FrameSelection,
  mapping: ColumnMapping
): IdentifiedFrames {
  const errors: LayoutError[] = [];
  const candidates = frames.filter((f) => f.fields.length > 0);
  const has = (frame: DataFrame, column: 'device' | 'rack' | 'position' | 'u_height') =>
    columnField(frame, column, mapping) !== undefined;
  const isAlerts = (frame: DataFrame) => findField(frame, 'alertname') !== undefined;

  const pick = (role: keyof FrameSelection): DataFrame | undefined => {
    const wanted = selection[role];
    if (!wanted) {
      return undefined;
    }
    const frame = candidates.find((f) => matches(f, wanted));
    if (!frame) {
      errors.push({ kind: 'frame-not-found', message: `No frame named "${wanted}" for the ${role}.` });
    }
    return frame;
  };

  const alerts = pick('alerts') ?? (selection.alerts ? undefined : candidates.find(isAlerts));
  const others = candidates.filter((f) => f !== alerts && !isAlerts(f));
  const devices =
    pick('devices') ??
    (selection.devices
      ? undefined
      : (others.find((f) => has(f, 'device') && (has(f, 'position') || has(f, 'u_height'))) ??
        others.find((f) => has(f, 'device') && has(f, 'rack'))));
  const racks =
    pick('racks') ??
    (selection.racks ? undefined : others.find((f) => f !== devices && has(f, 'rack') && !has(f, 'device')));

  if (!devices) {
    errors.push({
      kind: 'no-devices-frame',
      message: `No devices frame: expected a table with "${mapping.device || 'device'}" and "${mapping.rack || 'rack'}" columns.`,
    });
  }
  for (const frame of others) {
    if (frame !== devices && frame !== racks && has(frame, 'device')) {
      errors.push({
        kind: 'unjoined-frame',
        message: `Frame "${frameLabel(frame)}" also has a device column and is ignored. Join it to the devices frame with the "Join by field" transformation (mode OUTER (TABULAR), field ${mapping.device || 'device'}).`,
      });
    }
  }
  return { devices, racks, alerts, errors };
}
