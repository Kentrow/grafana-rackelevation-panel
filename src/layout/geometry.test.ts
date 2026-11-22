import { Device, Rack } from '../types';
import { DEFAULT_UP_VALUES } from '../data/status';
import { buildModel } from '../model';
import { loadFixture } from '../testing/fixtures';
import { placeDevices } from './place';
import {
  autoUnitHeight,
  cardPosition,
  FACE_GAP,
  FRAME,
  freeBlocks,
  freeUnits,
  HEADER_HEIGHT,
  MAX_UNIT_HEIGHT,
  MIN_UNIT_HEIGHT,
  labelFontSize,
  PADDING,
  panelGeometry,
  RACK_GAP,
  rackGeometry,
  truncate,
  unitNumbers,
} from './geometry';

const rack = (r: Partial<Rack>): Rack => ({
  id: 'R',
  name: 'R',
  uHeight: 4,
  startingUnit: 1,
  descUnits: false,
  fixedHeight: true,
  width: 19,
  ...r,
});

describe('geometry', () => {
  it('numbers units from the top: highest first when ascending, starting unit first when descending', () => {
    expect(unitNumbers(rack({}))).toEqual([4, 3, 2, 1]);
    expect(unitNumbers(rack({ startingUnit: 0, descUnits: true }))).toEqual([0, 1, 2, 3]);
  });

  it('keeps the proportions of a 19-inch rack', () => {
    expect(rackGeometry(16, true, false)).toEqual({
      unitHeight: 16,
      numbersWidth: 26,
      innerWidth: 174,
      zeroUWidth: 0,
      width: 212,
    });
    expect(rackGeometry(16, false, false).width).toBe(186);
    expect(rackGeometry(16, true, true).zeroUWidth).toBe(22);
  });

  it('uses a smaller font for 1U devices and hides labels below 10 px units', () => {
    expect(labelFontSize(16, 2)).toBe(12);
    expect(labelFontSize(16, 1)).toBe(10);
    expect(labelFontSize(9, 4)).toBe(0);
  });

  it('cuts labels with an ellipsis', () => {
    expect(truncate('sw-hq-core-01', 200, 10)).toBe('sw-hq-core-01');
    expect(truncate('sw-hq-core-01 · Cisco C9300-48P', 60, 10)).toBe('sw-hq…');
  });

  it('cuts between words, so that what is written starts the accessible name word for word', () => {
    expect(truncate('srv-hq-01 · Dell R760', 90, 10)).toBe('srv-hq-01…');
    expect(truncate('nas-a1-02 · 42.6 °C', 95, 10)).toBe('nas-a1-02 · 42…');
    // No boundary in the first half: cut inside the word rather than show almost nothing.
    expect(truncate('verylongdevicename-01', 60, 10)).toBe('verylongd…');
  });
});

describe('panelGeometry', () => {
  const model = (fixture: string) =>
    buildModel(loadFixture(fixture), {
      frames: {},
      columns: {},
      valueFields: [],
      upValues: DEFAULT_UP_VALUES,
      racks: [],
    });

  it('stands racks of different heights on the same floor', () => {
    const { views } = panelGeometry(model('multi-rack').racks, 'front', 16, true, true);
    const floors = views.map((v) => v.y + HEADER_HEIGHT + FRAME + v.layout.rack.uHeight * 16);
    expect(new Set(floors).size).toBe(1);
    expect(views.find((v) => v.layout.rack.id === 'PAR1-A4')!.y).toBe(PADDING + (48 - 24) * 16);
  });

  it('puts the rear view next to the front view of each rack', () => {
    const { views } = panelGeometry(model('desc-units').racks, 'both', 16, true, false);
    const { geometry } = views[0];
    expect(views.map((v) => [v.layout.rack.id, v.face, v.x])).toEqual([
      ['RACK-DESC', 'front', PADDING],
      ['RACK-DESC', 'rear', PADDING + geometry.width + FACE_GAP],
      ['RACK-ASC', 'front', PADDING + 2 * geometry.width + FACE_GAP + RACK_GAP],
      ['RACK-ASC', 'rear', PADDING + 3 * geometry.width + 2 * FACE_GAP + RACK_GAP],
    ]);
  });

  it('makes room for overflowing devices above and below the rack', () => {
    const { views, height } = panelGeometry(model('collisions').racks, 'front', 10, true, false);
    expect(views[0].overflow).toEqual({ above: 2, below: 1 });
    expect(height).toBe(2 * PADDING + HEADER_HEIGHT + FRAME + (2 + 24) * 10 + 10 + FRAME);
  });

  it('draws a 10-inch rack narrower than a 19-inch one, side by side on the same floor', () => {
    const { views } = panelGeometry(model('ten-inch').racks, 'front', 16, true, false);
    const [ten, nineteen] = views;
    expect([ten.layout.rack.width, nineteen.layout.rack.width]).toEqual([10, 19]);
    expect(ten.geometry.innerWidth).toBe(Math.round((16 * 10) / 1.75));
    expect(nineteen.geometry.innerWidth).toBe(Math.round((16 * 19) / 1.75));
    expect(nineteen.x).toBe(PADDING + ten.geometry.width + RACK_GAP);
  });

  it('reserves the 0U band only when a rack has 0U devices', () => {
    expect(panelGeometry(model('basic').racks, 'front', 16, true, true).views[0].geometry.zeroUWidth).toBe(0);
    expect(panelGeometry(model('zero-u').racks, 'front', 16, true, true).views[0].geometry.zeroUWidth).toBeGreaterThan(
      0
    );
    expect(panelGeometry(model('zero-u').racks, 'front', 16, true, false).views[0].geometry.zeroUWidth).toBe(0);
  });
});

const halfDevice: Device = {
  name: '',
  rack: 'R1',
  uHeight: 1,
  face: 'front',
  fullDepth: true,
  state: 'up',
  row: 0,
  children: [],
  alerts: [],
};

describe('freeUnits', () => {
  const model = (fixture: string) =>
    buildModel(loadFixture(fixture), {
      frames: {},
      columns: {},
      valueFields: [],
      upValues: DEFAULT_UP_VALUES,
      racks: [],
    });

  it('counts the units with nothing in them on each face', () => {
    // basic: 7 units taken on the front, the patch panel (U42) being half depth.
    const [basic] = model('basic').racks;
    expect(freeUnits(basic, 'front')).toBe(42 - 7);
    expect(freeUnits(basic, 'rear')).toBe(42 - 6);
  });

  it('counts a unit as taken when part of it is, with half-unit devices', () => {
    const { racks } = placeDevices({
      devices: [
        { ...halfDevice, name: 'a', position: 1.5 },
        { ...halfDevice, name: 'b', position: 5, uHeight: 0.5 },
        { ...halfDevice, name: 'c', position: 5.5, uHeight: 0.5 },
      ],
      racks: [{ id: 'R1', name: 'R1', uHeight: 10, startingUnit: 1, descUnits: false, fixedHeight: true, width: 19 }],
    });
    // a takes U1 and U2, b and c share U5.
    expect(freeUnits(racks[0], 'front')).toBe(10 - 3);
  });

  it('ignores the units of overflowing devices outside the rack', () => {
    // collisions: sw-a, sw-b (U20-21), srv-full-c (U10-11), srv-big-c inside up to U24, nas-low-c outside.
    const [rack] = model('collisions').racks;
    expect(freeUnits(rack, 'front')).toBe(24 - 6);
  });
});

describe('autoUnitHeight', () => {
  const racks = (fixture: string) =>
    buildModel(loadFixture(fixture), {
      frames: {},
      columns: {},
      valueFields: [],
      upValues: DEFAULT_UP_VALUES,
      racks: [],
    }).racks;

  it('makes the tallest rack fill the height', () => {
    const u = autoUnitHeight(racks('multi-rack'), 1000);
    expect(u).toBe(Math.floor((1000 - 2 * PADDING - HEADER_HEIGHT - 2 * FRAME) / 48));
    expect(panelGeometry(racks('multi-rack'), 'front', u, true, true).height).toBeLessThanOrEqual(1000);
  });

  it('counts the overflow zones, and stays within bounds', () => {
    expect(autoUnitHeight(racks('collisions'), 400)).toBe(
      Math.floor((400 - 2 * PADDING - HEADER_HEIGHT - 2 * FRAME) / 27)
    );
    expect(autoUnitHeight(racks('basic'), 50)).toBe(MIN_UNIT_HEIGHT);
    expect(autoUnitHeight(racks('ten-inch'), 5000)).toBe(MAX_UNIT_HEIGHT);
  });
});

describe('cardPosition', () => {
  const panel = { width: 400, height: 300 };
  const card = { width: 200, height: 120 };

  it('puts the card below and right of the pointer when it fits', () => {
    expect(cardPosition({ x: 50, y: 40 }, card, panel, 12)).toEqual({ left: 62, top: 52 });
  });

  it('flips the card to the left of and above the pointer near the right and bottom edges', () => {
    expect(cardPosition({ x: 350, y: 280 }, card, panel, 12)).toEqual({ left: 138, top: 148 });
  });

  it('keeps a card wider or taller than the room on both sides inside the panel', () => {
    // 360 px wide in a 400 px panel, pointer in the middle: neither side has room, the card stays within the margins.
    expect(cardPosition({ x: 200, y: 150 }, { width: 360, height: 250 }, panel, 12)).toEqual({ left: 28, top: 38 });
    expect(cardPosition({ x: 390, y: 290 }, { width: 380, height: 280 }, panel, 12)).toEqual({ left: 12, top: 12 });
  });
});

describe('freeBlocks', () => {
  const rack = { id: 'R1', name: 'R1', uHeight: 12, startingUnit: 1, descUnits: false, fixedHeight: true, width: 19 };
  const layoutOf = (devices: Array<Partial<Device> & { name: string }>) =>
    placeDevices({ devices: devices.map((d) => ({ ...halfDevice, ...d })), racks: [rack] }).racks[0];

  it('lists the runs of free units that hold a device of that height, bottom to top', () => {
    // U1-12, taken: U3-4 and U9; free runs U1-2, U5-8, U10-12.
    const layout = layoutOf([
      { name: 'srv', position: 3, uHeight: 2 },
      { name: 'sw', position: 9 },
    ]);
    expect(freeBlocks(layout, 'front', 2, true)).toEqual([
      { bottom: 1, top: 2 },
      { bottom: 5, top: 8 },
      { bottom: 10, top: 12 },
    ]);
    expect(freeBlocks(layout, 'front', 3, true)).toEqual([
      { bottom: 5, top: 8 },
      { bottom: 10, top: 12 },
    ]);
    expect(freeBlocks(layout, 'front', 13, true)).toEqual([]);
  });

  it('needs the other face free too for a full-depth device, only this face for a half-depth one', () => {
    // A half-depth patch panel on the rear at U6.
    const layout = layoutOf([{ name: 'patch', position: 6, face: 'rear', fullDepth: false }]);
    expect(freeBlocks(layout, 'front', 4, false)).toEqual([{ bottom: 1, top: 12 }]);
    expect(freeBlocks(layout, 'front', 4, true)).toEqual([
      { bottom: 1, top: 5 },
      { bottom: 7, top: 12 },
    ]);
  });

  it('counts a unit partly taken by a half-unit device as taken', () => {
    const layout = layoutOf([{ name: 'shelf', position: 6.5, uHeight: 0.5 }]);
    expect(freeBlocks(layout, 'front', 1, true)).toEqual([
      { bottom: 1, top: 5 },
      { bottom: 7, top: 12 },
    ]);
  });
});
