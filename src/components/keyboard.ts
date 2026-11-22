/**
 * Keyboard navigation between devices with a roving tab stop: the devices are one stop in the tab order, the arrow
 * keys move between them. It works on the drawn SVG, so that moving the focus never redraws the racks.
 */

/** One face of one rack, in drawing order. */
const views = (root: Element) => [...root.querySelectorAll('[data-testid^="rack-"][data-face]')];

/** Devices of a view that take the focus: the 0U band after the rack, each from top to bottom. */
function devicesOf(view: Element): HTMLElement[] {
  const key = (d: Element) => [d.hasAttribute('data-vertical') ? 1 : 0, Number(d.getAttribute('data-y'))];
  return [...view.querySelectorAll<HTMLElement>('[data-device][tabindex]')].sort((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    return ka[0] - kb[0] || ka[1] - kb[1];
  });
}

/** The device to focus when Tab enters the panel: the top device of the first rack. */
export function entryDevice(root: Element): HTMLElement | undefined {
  for (const view of views(root)) {
    const [first] = devicesOf(view);
    if (first) {
      return first;
    }
  }
  return undefined;
}

/** Makes this device the only tab stop of the panel. */
export function makeTabStop(root: Element, device: HTMLElement) {
  root.querySelectorAll('[data-device][tabindex="0"]').forEach((d) => d !== device && d.setAttribute('tabindex', '-1'));
  device.setAttribute('tabindex', '0');
}

/** Keeps one tab stop once the drawing changed: the last focused device if it is still drawn, else the entry. */
export function ensureTabStop(root: Element) {
  if (!root.querySelector('[data-device][tabindex="0"]')) {
    const entry = entryDevice(root);
    if (entry) {
      makeTabStop(root, entry);
    }
  }
}

const centre = (d: Element) => Number(d.getAttribute('data-y')) + Number(d.getAttribute('data-height') ?? 0) / 2;

/** Device reached from `device` with a navigation key, or undefined for another key or at an end. */
export function deviceFor(root: Element, device: HTMLElement, key: string): HTMLElement | undefined {
  const all = views(root);
  const view = all.find((v) => v.contains(device));
  if (!view) {
    return undefined;
  }
  const devices = devicesOf(view);
  const index = devices.indexOf(device);
  switch (key) {
    case 'ArrowDown':
      return devices[index + 1];
    case 'ArrowUp':
      return index > 0 ? devices[index - 1] : undefined;
    case 'Home':
      return devices[0];
    case 'End':
      return devices[devices.length - 1];
    case 'ArrowLeft':
    case 'ArrowRight': {
      // The nearest device at the same height in the next view, or the one after, that has devices.
      const step = key === 'ArrowRight' ? 1 : -1;
      for (let i = all.indexOf(view) + step; i >= 0 && i < all.length; i += step) {
        const candidates = devicesOf(all[i]);
        if (candidates.length > 0) {
          const y = centre(device);
          return candidates.reduce((best, d) => (Math.abs(centre(d) - y) < Math.abs(centre(best) - y) ? d : best));
        }
      }
      return undefined;
    }
    default:
      return undefined;
  }
}
