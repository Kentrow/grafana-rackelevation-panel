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

/**
 * State of a rack at a glance, from its devices on both faces and in the 0U band, each device once. Only the devices
 * kept by `counted` count, such as those of the role filter, as in the legend.
 */
export function rackHealth(layout: RackLayout, counted: (device: Device) => boolean = () => true): RackHealth {
  const all = new Set<Device>([...layout.front, ...layout.rear].map((p) => p.device));
  layout.zeroU.forEach((d) => all.add(d));
  const devices = [...all].filter(counted);
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
