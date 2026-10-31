import { Rack } from '../types';
import { DEFAULT_UP_VALUES } from '../data/status';
import { buildModel } from '../model';
import { loadFixture } from '../testing/fixtures';
import {
  autoUnitHeight,
  FACE_GAP,
  FRAME,
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
    expect(truncate('sw-hq-core-01 · Cisco C9300-48P', 60, 10)).toBe('sw-hq-cor…');
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
