import { Device, DeviceState, RackLayout } from '../types';

export interface RackHealth {
  /** Worst state of the devices of the rack: down, then up, then unknown; undefined for an empty rack. */
  state?: DeviceState;
  /** Devices out of service. */
  down: number;
  /** Active alerts of all its devices. */
  alerts: number;
  critical: boolean;
}

export interface RackPower {
  /** Power draw of the devices of the rack, in watts; undefined when none has a value. */
  draw?: number;
  /** Power the rack can deliver, in watts. */
  capacity?: number;
  /** Draw over capacity, when both are known. */
  ratio?: number;
}

/** Each device of a rack once: both faces, full-depth devices drawn on each, and the 0U band. */
function devicesOf(layout: RackLayout): Set<Device> {
  const devices = new Set<Device>([...layout.front, ...layout.rear].map((p) => p.device));
  layout.zeroU.forEach((d) => devices.add(d));
  return devices;
}

/**
 * Power draw of a rack against its capacity. Every device counts, whatever the filters: the rack draws it all. The
 * power column belongs on the devices that draw it, not on the PDUs that feed them, or it would count twice.
 */
export function rackPower(layout: RackLayout): RackPower {
  let draw: number | undefined;
  for (const device of devicesOf(layout)) {
    if (device.power !== undefined) {
      draw = (draw ?? 0) + device.power;
    }
  }
  const capacity = layout.rack.powerCapacity;
  return {
    ...(draw !== undefined && { draw }),
    ...(capacity !== undefined && { capacity }),
    ...(draw !== undefined && capacity !== undefined && { ratio: draw / capacity }),
  };
}

/**
 * State of a rack at a glance, from its devices on both faces and in the 0U band, each device once. Only the devices
 * kept by `counted` count, such as those of the role filter, as in the legend.
 */
export function rackHealth(layout: RackLayout, counted: (device: Device) => boolean = () => true): RackHealth {
  const devices = [...devicesOf(layout)].filter(counted);
  let down = 0;
  let up = 0;
  let alerts = 0;
  let critical = false;
  for (const device of devices) {
    down += device.state === 'down' ? 1 : 0;
    up += device.state === 'up' ? 1 : 0;
    alerts += device.alerts.length;
    critical ||= device.alerts.some((a) => a.severity?.toLowerCase() === 'critical');
  }
  const state = down > 0 ? 'down' : up > 0 ? 'up' : devices.length > 0 ? 'unknown' : undefined;
  return { state, down, alerts, critical };
}

const trimZeros = (text: string) => text.replace(/\.?0+$/, '');
const kilowatts = (watts: number) => trimZeros((watts / 1000).toFixed(watts < 10000 ? 2 : 1));

/** Power of a rack as written under its name: `3.2 / 5 kW`, `640 / 800 W`, or the draw alone; undefined without draw. */
export function powerText({ draw, capacity }: RackPower): string | undefined {
  if (draw === undefined) {
    return undefined;
  }
  const inKilowatts = (capacity ?? draw) >= 1000;
  const write = (watts: number) => (inKilowatts ? kilowatts(watts) : String(Math.round(watts)));
  const unit = inKilowatts ? 'kW' : 'W';
  return capacity === undefined ? `${write(draw)} ${unit}` : `${write(draw)} / ${write(capacity)} ${unit}`;
}

/** Load of a rack: under 80 % of its capacity, the usual margin of a power feed, up to 100 %, or over. */
export const powerLevel = (ratio: number): 'ok' | 'high' | 'over' =>
  ratio < 0.8 ? 'ok' : ratio <= 1 ? 'high' : 'over';
