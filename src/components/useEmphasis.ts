import { useMemo } from 'react';
import { Device } from '../types';
import { DeviceEntry } from './useRackModel';
import { emphasisOf, matchingNames } from './variables';

/**
 * Emphasis of each device from the highlight variable and the role filter, both resolved from the dashboard
 * variables, and the devices that the legend counts.
 */
export function useEmphasis(
  devices: Map<string, DeviceEntry>,
  /** Values of the highlight variable, one per line. */
  highlightKey: string,
  /** Roles of the role filter, lower case, one per line. */
  rolesKey: string,
  zeroU: Set<Device>,
  showZeroU: boolean
) {
  // Only the highlighted devices drawn in this panel count: a panel without them is left as it is.
  const highlighted = useMemo(
    () => (highlightKey ? matchingNames(highlightKey.split('\n'), devices.keys()) : []),
    [highlightKey, devices]
  );
  const highlightedKey = highlighted.join('\n');
  const emphasis = useMemo(() => {
    const names = new Set(highlightedKey ? highlightedKey.split('\n') : []);
    const roles = new Set(rolesKey ? rolesKey.split('\n') : []);
    return (device: Device) => emphasisOf(device, names, roles);
  }, [highlightedKey, rolesKey]);
  // The legend counts the devices drawn: not those out of the role filter, nor those of a hidden 0U band.
  const legendDevices = useMemo(
    () =>
      [...devices.values()]
        .map((d) => d.device)
        .filter((d) => emphasis(d) !== 'filtered' && (showZeroU || !zeroU.has(d))),
    [devices, emphasis, showZeroU, zeroU]
  );
  return { highlighted, emphasis, legendDevices };
}
