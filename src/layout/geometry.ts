import { Face, FaceOption, Rack, RackLayout } from '../types';

/** Height of a rack unit, in inches (44.45 mm). */
export const UNIT_INCHES = 1.75;
/** Rack name and site above the frame. */
export const HEADER_HEIGHT = 36;
/** Thickness of the frame around the slots. */
export const FRAME = 6;
export const NUMBERS_WIDTH = 26;
export const RACK_GAP = 24;
/** Between the front and rear views of the same rack. */
export const FACE_GAP = 12;
export const ZERO_U_GAP = 4;
export const PADDING = 8;
/** Below this unit height, labels are hidden and only the tooltip remains. */
export const MIN_LABEL_UNIT_HEIGHT = 10;

export interface RackGeometry {
  unitHeight: number;
  numbersWidth: number;
  /** Width of the slots, inside the frame. */
  innerWidth: number;
  /** Width of the 0U band right of the frame, gap included; 0 without band. */
  zeroUWidth: number;
  width: number;
}

/** Geometry of a rack drawn with this unit height; its width follows its real width, 19 inches by default. */
export function rackGeometry(
  unitHeight: number,
  showUnitNumbers: boolean,
  zeroUBand: boolean,
  widthInches = 19
): RackGeometry {
  const numbersWidth = showUnitNumbers ? NUMBERS_WIDTH : 0;
  const innerWidth = Math.round((unitHeight * widthInches) / UNIT_INCHES);
  const zeroUWidth = zeroUBand ? ZERO_U_GAP + Math.max(12, Math.round(unitHeight * 1.1)) : 0;
  return {
    unitHeight,
    numbersWidth,
    innerWidth,
    zeroUWidth,
    width: numbersWidth + 2 * FRAME + innerWidth + zeroUWidth,
  };
}

/** Units drawn above the top and below the bottom of a rack by overflowing devices. */
export interface Overflow {
  above: number;
  below: number;
}

export function overflowOf(layout: RackLayout): Overflow {
  let above = 0;
  let below = 0;
  for (const p of [...layout.front, ...layout.rear]) {
    above = Math.max(above, -p.top);
    below = Math.max(below, p.top + p.device.uHeight - layout.rack.uHeight);
  }
  return { above, below };
}

export interface RackView {
  layout: RackLayout;
  geometry: RackGeometry;
  face: Face;
  overflow: Overflow;
  x: number;
  y: number;
}

export interface PanelGeometry {
  views: RackView[];
  width: number;
  height: number;
}

/**
 * Where each rack view goes: side by side, the front and rear of a rack next to each other, and every rack standing on
 * the same floor whatever its height and overflows.
 */
export function panelGeometry(
  racks: RackLayout[],
  faceOption: FaceOption,
  unitHeight: number,
  showUnitNumbers: boolean,
  showZeroU: boolean
): PanelGeometry {
  const zeroUBand = showZeroU && racks.some((r) => r.zeroU.length > 0);
  const faces: Face[] = faceOption === 'both' ? ['front', 'rear'] : [faceOption];
  const overflows = racks.map(overflowOf);
  // Distance from the top of a view to the bottom of its slots, and below it.
  const floor = Math.max(
    0,
    ...racks.map((r, i) => HEADER_HEIGHT + FRAME + (overflows[i].above + r.rack.uHeight) * unitHeight)
  );
  const basement = Math.max(0, ...overflows.map((o) => o.below * unitHeight));
  const views: RackView[] = [];
  let x = PADDING;
  racks.forEach((layout, i) => {
    const geometry = rackGeometry(unitHeight, showUnitNumbers, zeroUBand, layout.rack.width);
    faces.forEach((face, f) => {
      const y = PADDING + floor - (HEADER_HEIGHT + FRAME + (overflows[i].above + layout.rack.uHeight) * unitHeight);
      views.push({ layout, geometry, face, overflow: overflows[i], x, y });
      x += geometry.width + (f < faces.length - 1 ? FACE_GAP : RACK_GAP);
    });
  });
  const width = racks.length ? x - RACK_GAP + PADDING : 0;
  return { views, width, height: racks.length ? 2 * PADDING + floor + basement + FRAME : 0 };
}

/** Bounds of the automatic unit height: below 4 px nothing is readable, above 40 px a small rack looks oversized. */
export const MIN_UNIT_HEIGHT = 4;
export const MAX_UNIT_HEIGHT = 40;

/**
 * Unit height that makes the tallest rack, overflows included, fill the given height: the vertical counterpart of the
 * panelGeometry layout.
 */
export function autoUnitHeight(racks: RackLayout[], availableHeight: number): number {
  const overflows = racks.map(overflowOf);
  const units =
    Math.max(0, ...racks.map((r, i) => overflows[i].above + r.rack.uHeight)) +
    Math.max(0, ...overflows.map((o) => o.below));
  if (units === 0) {
    return MAX_UNIT_HEIGHT;
  }
  const fitting = Math.floor((availableHeight - 2 * PADDING - HEADER_HEIGHT - 2 * FRAME) / units);
  return Math.min(MAX_UNIT_HEIGHT, Math.max(MIN_UNIT_HEIGHT, fitting));
}

/** Units of the rack with nothing in them on this face; a full-depth device of the other face fills them too. */
export function freeUnits(layout: RackLayout, face: Face): number {
  const { startingUnit, uHeight } = layout.rack;
  const taken = new Set<number>();
  for (const p of layout[face]) {
    for (let u = Math.max(p.units[0], startingUnit); u <= Math.min(p.units[1], startingUnit + uHeight - 1); u++) {
      taken.add(Math.floor(u));
    }
  }
  return uHeight - taken.size;
}

/** Unit number at a slot counted from the top of the rack; negative or past the bottom for overflow slots. */
export const unitNumberAt = (rack: Rack, slot: number) =>
  rack.descUnits ? rack.startingUnit + slot : rack.startingUnit + rack.uHeight - 1 - slot;

/** Unit number shown at each slot, from the top of the rack. */
export function unitNumbers(rack: Rack): number[] {
  return Array.from({ length: rack.uHeight }, (_, slot) => unitNumberAt(rack, slot));
}

/** Font size of a device label: smaller for 1U devices, none below MIN_LABEL_UNIT_HEIGHT. */
export function labelFontSize(unitHeight: number, uHeight: number): number {
  if (unitHeight < MIN_LABEL_UNIT_HEIGHT) {
    return 0;
  }
  return Math.min(12, Math.round(unitHeight * (uHeight > 1 ? 0.75 : 0.65)));
}

/** Text cut to about `width` pixels with an ellipsis, for SVG text that cannot wrap or clip on its own. */
export function truncate(text: string, width: number, fontSize: number): string {
  const max = Math.floor(width / (fontSize * 0.58));
  if (text.length <= max) {
    return text;
  }
  return max <= 1 ? '' : `${text.slice(0, max - 1).trimEnd()}…`;
}
