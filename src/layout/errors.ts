import { Device, Face, LayoutError, Rack } from '../types';

export const unitRange = (first: number, last: number) => (first === last ? `U${first}` : `U${first}-${last}`);

export const lastUnit = (rack: Rack) => rack.startingUnit + rack.uHeight - 1;

export const duplicateError = (device: Device): LayoutError => ({
  kind: 'duplicate',
  message: `${device.name} appears more than once; row ${device.row + 1} is ignored.`,
  device: device.name,
});

export const orphanError = (device: Device): LayoutError => ({
  kind: 'orphan-child',
  message: `${device.name} has parent ${device.parent}, which is not in the data.`,
  device: device.name,
});

export const unknownRackError = (rack: string, from: 'devices' | 'options'): LayoutError => ({
  kind: 'unknown-rack',
  message:
    from === 'devices'
      ? `Rack ${rack} is not in the racks frame; drawn with default values.`
      : `Rack ${rack} from the options is not in the data.`,
  rack,
});

export const overflowError = (device: Device, units: [number, number], rack: Rack): LayoutError => ({
  kind: 'overflow',
  message: `${device.name} (${unitRange(...units)}) is outside ${rack.name} (${unitRange(rack.startingUnit, lastUnit(rack))}).`,
  device: device.name,
  rack: rack.id,
});

export const overlapError = (device: Device, other: Device, face: Face, rack: Rack): LayoutError => ({
  kind: 'overlap',
  message: `${device.name} overlaps ${other.name} on the ${face} of ${rack.name}.`,
  device: device.name,
  rack: rack.id,
});
