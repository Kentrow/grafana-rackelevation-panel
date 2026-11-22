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

/** State of a rack at a glance, from every device in it: both faces and the 0U band, each device once. */
export function rackHealth(layout: RackLayout): RackHealth {
  const devices = new Set<Device>([...layout.front, ...layout.rear].map((p) => p.device));
  layout.zeroU.forEach((d) => devices.add(d));
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
  const state = down > 0 ? 'down' : up > 0 ? 'up' : devices.size > 0 ? 'unknown' : undefined;
  return { state, down, alerts, critical };
}
