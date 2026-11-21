import { DEFAULT_RACK_HEIGHT, DEFAULT_RACK_WIDTH } from '../data/mapping';
import { Alert, Device, Face, Layout, LayoutError, Rack, RackLayout } from '../types';
import { duplicateError, lastUnit, orphanError, overflowError, overlapError, unknownRackError } from './errors';

export interface PlaceInput {
  devices: Device[];
  /** Racks of the racks frame; undefined when there is none. */
  racks?: Rack[];
  alerts?: Map<string, Alert[]>;
  /** Racks to show, in this order, by id or name. Empty means all. */
  order?: string[];
}

const opposite = (face: Face): Face => (face === 'front' ? 'rear' : 'front');

const defaultRack = (id: string): Rack => ({
  id,
  name: id,
  uHeight: DEFAULT_RACK_HEIGHT,
  startingUnit: 1,
  descUnits: false,
  fixedHeight: false,
  width: DEFAULT_RACK_WIDTH,
});

/**
 * Bottom and top of a device in units, top excluded: a 1U device at U1 spans [1, 2). Positions and heights can be
 * halves of a unit in NetBox, so overlaps and overflows are computed on these spans; undefined for 0U devices.
 */
const spanOf = (d: Device): [number, number] | undefined =>
  d.position === undefined || d.uHeight <= 0 ? undefined : [d.position, d.position + d.uHeight];

/** First and last unit numbers shown for a span: U3 for a 0.5U device at 3, U1-1.5 for a 1.5U device at 1. */
const unitsOf = ([bottom, top]: [number, number]): [number, number] => [bottom, Math.max(bottom, top - 1)];

/** Keeps the first row of each device name and attaches children and alerts to their device. */
function resolveDevices(input: PlaceInput, errors: LayoutError[]): Device[] {
  const byName = new Map<string, Device>();
  for (const device of input.devices) {
    if (byName.has(device.name)) {
      errors.push(duplicateError(device));
    } else {
      byName.set(device.name, { ...device, children: [], alerts: input.alerts?.get(device.name) ?? [] });
    }
  }
  const placed: Device[] = [];
  for (const device of byName.values()) {
    if (!device.parent) {
      placed.push(device);
      continue;
    }
    const parent = byName.get(device.parent);
    if (parent && parent !== device) {
      parent.children.push(device);
    } else {
      errors.push(orphanError(device));
    }
  }
  return placed;
}

/** Racks in display order, grown to fit their devices when their height is not given. */
function resolveRacks(input: PlaceInput, byRack: Map<string, Device[]>, errors: LayoutError[]): Rack[] {
  const racks = new Map<string, Rack>((input.racks ?? []).map((r) => [r.id, { ...r }]));
  for (const id of byRack.keys()) {
    if (!racks.has(id)) {
      if (input.racks) {
        errors.push(unknownRackError(id, 'devices'));
      }
      racks.set(id, defaultRack(id));
    }
  }
  for (const rack of racks.values()) {
    if (rack.fixedHeight) {
      continue;
    }
    for (const d of byRack.get(rack.id) ?? []) {
      const span = spanOf(d);
      if (span && span[1] > lastUnit(rack) + 1) {
        rack.uHeight = Math.ceil(span[1] - rack.startingUnit);
      }
    }
  }
  if (!input.order?.length) {
    return [...racks.values()];
  }
  const all = [...racks.values()];
  const ordered: Rack[] = [];
  for (const wanted of input.order) {
    const rack = racks.get(wanted) ?? all.find((r) => r.name === wanted);
    if (!rack) {
      errors.push(unknownRackError(wanted, 'options'));
    } else if (!ordered.includes(rack)) {
      ordered.push(rack);
    }
  }
  return ordered;
}

function placeRack(rack: Rack, devices: Device[], errors: LayoutError[]): RackLayout {
  const layout: RackLayout = { rack, front: [], rear: [], zeroU: [] };
  const overflowing = new Set<Device>();
  const spans = new Map<Device, [number, number]>();
  for (const device of devices) {
    const span = spanOf(device);
    if (!span) {
      layout.zeroU.push(device);
      continue;
    }
    spans.set(device, span);
    const units = unitsOf(span);
    // Slots are counted from the top of the rack: the starting unit is at the top in descending racks (NetBox).
    const top = rack.descUnits ? span[0] - rack.startingUnit : lastUnit(rack) + 1 - span[1];
    if (span[0] < rack.startingUnit || span[1] > lastUnit(rack) + 1) {
      overflowing.add(device);
      errors.push(overflowError(device, units, rack));
    }
    layout[device.face].push({ device, face: device.face, back: false, units, top });
    if (device.fullDepth) {
      const face = opposite(device.face);
      layout[face].push({ device, face, back: true, units, top });
    }
  }

  // Rule 5: both devices stay drawn, the later one in the data is flagged. A pair is reported once.
  const overlapping = new Set<Device>();
  const reported = new Set<string>();
  for (const face of ['front', 'rear'] as const) {
    const placed = layout[face];
    for (let i = 0; i < placed.length; i++) {
      for (let j = 0; j < i; j++) {
        const [a, b] = [placed[j], placed[i]];
        const [spanA, spanB] = [spans.get(a.device), spans.get(b.device)];
        if (spanA && spanB && spanA[0] < spanB[1] && spanB[0] < spanA[1]) {
          const [first, second] = a.device.row <= b.device.row ? [a.device, b.device] : [b.device, a.device];
          overlapping.add(second);
          const key = `${first.name}\n${second.name}`;
          if (!reported.has(key)) {
            reported.add(key);
            errors.push(overlapError(second, first, face, rack));
          }
        }
      }
    }
  }
  for (const p of [...layout.front, ...layout.rear]) {
    p.conflict = overflowing.has(p.device) ? 'overflow' : overlapping.has(p.device) ? 'overlap' : undefined;
  }
  return layout;
}

/** Placement engine: pure, the same data and options always give the same layout. */
export function placeDevices(input: PlaceInput): Layout {
  const errors: LayoutError[] = [];
  const devices = resolveDevices(input, errors);
  const byRack = new Map<string, Device[]>();
  for (const d of devices) {
    const list = byRack.get(d.rack);
    if (list) {
      list.push(d);
    } else {
      byRack.set(d.rack, [d]);
    }
  }
  const racks = resolveRacks(input, byRack, errors).map((rack) => placeRack(rack, byRack.get(rack.id) ?? [], errors));
  return { racks, errors };
}
