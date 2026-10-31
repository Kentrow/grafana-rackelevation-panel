/** Columns of the devices frame, by their default name (data contract of src/README.md). */
export const COLUMNS = [
  'device',
  'rack',
  'position',
  'u_height',
  'face',
  'is_full_depth',
  'role',
  'model',
  'status',
  'value',
  'parent_device',
] as const;

export type Column = (typeof COLUMNS)[number];

/** Field name to read for each column, when it differs from the default name. */
export type ColumnMapping = Partial<Record<Column, string>>;

/** Frames picked by refId or frame name; unset means found by heuristic. */
export interface FrameSelection {
  devices?: string;
  racks?: string;
  alerts?: string;
}

export type FaceOption = 'front' | 'rear' | 'both';

export type LabelPart = 'name' | 'model' | 'value' | 'role';

/** Panel options. */
export interface RackElevationOptions {
  frames: FrameSelection;
  columns: ColumnMapping;
  /**
   * Fields giving the colour, in order: each device takes the first one with a value. Each field keeps its own
   * thresholds and unit through overrides. Empty means the value column.
   */
  valueFields: string[];
  /** Status values that mean in service, compared case-insensitively. */
  upValues: string[];
  /** Racks to show, in this order. Empty means all. */
  racks: string[];
  face: FaceOption;
  unitHeight: number;
  /** Unit height that makes the tallest rack fill the panel height; unitHeight is used otherwise. */
  autoUnitHeight: boolean;
  fitToPanel: boolean;
  showZeroU: boolean;
  showUnitNumbers: boolean;
  /** Free units of the face under the rack name. */
  showRackSummary: boolean;
  /** Device counts by state at the bottom of the panel. */
  showLegend: boolean;
  label: LabelPart[];
  labelSeparator: string;
  roles: string[];
  highlightVariable: string;
  showTooltip: boolean;
}

export type Face = 'front' | 'rear';

/** up: in service, down: out of service, unknown: no status (known to the inventory only). */
export type DeviceState = 'up' | 'down' | 'unknown';

export interface Alert {
  name?: string;
  severity?: string;
}

export interface Device {
  name: string;
  rack: string;
  /** Lowest-numbered unit occupied, in the rack numbering. Unset for 0U devices. */
  position?: number;
  uHeight: number;
  face: Face;
  fullDepth: boolean;
  role?: string;
  model?: string;
  state: DeviceState;
  value?: number;
  /** Index in the devices frame of the field the value comes from. */
  valueField?: number;
  parent?: string;
  /** Row in the devices frame, to read display values, links and extra columns. */
  row: number;
  children: Device[];
  alerts: Alert[];
}

export interface Rack {
  id: string;
  name: string;
  uHeight: number;
  startingUnit: number;
  /** Unit numbers grow downwards: the starting unit is at the top. */
  descUnits: boolean;
  site?: string;
  /** Height given by the racks frame. Without it the rack grows to fit its devices. */
  fixedHeight: boolean;
  /** Width in inches, as NetBox: 10, 19, 21 or 23. */
  width: number;
  /** Row in the racks frame, for its data links; unset for a rack known from the devices only. */
  row?: number;
}

export type Conflict = 'overlap' | 'overflow';

export interface PlacedDevice {
  device: Device;
  face: Face;
  /** Full-depth device seen from its opposite face: drawn dimmed. */
  back: boolean;
  /** First and last unit numbers occupied. */
  units: [number, number];
  /** Slot of the top of the device, in units from the top of the rack. Negative or past the bottom when overflowing. */
  top: number;
  conflict?: Conflict;
}

export interface RackLayout {
  rack: Rack;
  front: PlacedDevice[];
  rear: PlacedDevice[];
  zeroU: Device[];
}

export type ErrorKind =
  | 'no-devices-frame'
  | 'frame-not-found'
  | 'missing-column'
  | 'unjoined-frame'
  | 'missing-name'
  | 'missing-rack'
  | 'duplicate'
  | 'orphan-child'
  | 'overlap'
  | 'overflow'
  | 'unknown-rack';

export interface LayoutError {
  kind: ErrorKind;
  message: string;
  device?: string;
  rack?: string;
}

export interface Layout {
  racks: RackLayout[];
  errors: LayoutError[];
}

/** Defaults of the panel options; the panel also falls back to them for options saved by older versions. */
export const DEFAULT_OPTIONS: RackElevationOptions = {
  frames: {},
  columns: {},
  valueFields: [],
  upValues: ['up', '1', 'true', 'active'],
  racks: [],
  face: 'front',
  unitHeight: 16,
  autoUnitHeight: true,
  fitToPanel: false,
  showZeroU: true,
  showUnitNumbers: true,
  showRackSummary: true,
  showLegend: true,
  label: ['name'],
  labelSeparator: '·',
  roles: [],
  // With the $, Grafana knows that the panel depends on the variable and redraws it when the variable changes.
  highlightVariable: '$device',
  showTooltip: true,
};
