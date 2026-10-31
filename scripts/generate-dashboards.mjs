// Writes the provisioned dashboards from tests/fixtures, so that they never drift from the unit test fixtures.
// Each CSV file becomes a TestData "CSV content" query whose refId is the file name. Run with `npm run dashboards`.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'tests', 'fixtures');
const DASHBOARDS = join(ROOT, 'provisioning', 'dashboards');
const DATASOURCE = { type: 'grafana-testdata-datasource', uid: 'trlxrdZVk' };
const PANEL_TYPE = 'kentrow-rackelevation-panel';

/** Temperature thresholds of the demo: the value column of the fixtures is a temperature. */
const TEMPERATURE = {
  defaults: {
    unit: 'celsius',
    decimals: 1,
    color: { mode: 'thresholds' },
    thresholds: {
      mode: 'absolute',
      steps: [
        { color: 'green', value: null },
        { color: 'yellow', value: 50 },
        { color: 'red', value: 65 },
      ],
    },
  },
  overrides: [],
};

/** TestData queries for a fixture: name.csv, or every CSV file of the name/ directory. */
function queries(fixture) {
  const path = join(FIXTURES, fixture);
  const files = statSync(path, { throwIfNoEntry: false })?.isDirectory()
    ? readdirSync(path)
        .filter((f) => f.endsWith('.csv'))
        .sort()
        .map((f) => join(path, f))
    : [`${path}.csv`];
  return files.map((file) => ({
    datasource: DATASOURCE,
    refId: file
      .split('/')
      .pop()
      .replace(/\.csv$/, ''),
    scenarioId: 'csv_content',
    csvContent: readFileSync(file, 'utf8'),
  }));
}

function panel(id, title, gridPos, { fixture, targets, options = {}, fieldConfig, transformations, description }) {
  return {
    id,
    type: PANEL_TYPE,
    title,
    description,
    datasource: DATASOURCE,
    gridPos,
    targets: targets ?? queries(fixture),
    options,
    fieldConfig: fieldConfig ?? TEMPERATURE,
    transformations,
  };
}

function dashboard(uid, title, panels, extra = {}) {
  return {
    uid,
    title,
    tags: ['rack-elevation'],
    editable: true,
    graphTooltip: 0,
    schemaVersion: 39,
    time: { from: 'now-6h', to: 'now' },
    timepicker: {},
    timezone: '',
    refresh: '',
    links: [],
    annotations: { list: [] },
    templating: { list: [] },
    panels,
    ...extra,
  };
}

/** Grid positions for panels of the given sizes, filled row by row on the 24 columns of a dashboard. */
function flow(sizes) {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return sizes.map(([w, h]) => {
    if (x + w > 24) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const pos = { w, h, x, y };
    x += w;
    rowHeight = Math.max(rowHeight, h);
    return pos;
  });
}

function write(name, content) {
  writeFileSync(join(DASHBOARDS, name), JSON.stringify(content, null, 2) + '\n');
}

// The README recipe for three Prometheus queries: Join by field on device, then status and value mapped to the
// Prometheus value columns.
const prometheusJoined = {
  fixture: 'prometheus-auto',
  description: 'Join by field on device, then status and value mapped to the Prometheus value columns.',
  transformations: [{ id: 'joinByField', options: { byField: 'device', mode: 'outerTabular' } }],
  options: { columns: { status: 'Value #B' }, valueFields: ['Value #C'], label: ['name', 'value'] },
};

// dashboard.json: the small dashboard of the e2e tests.
write(
  'dashboard.json',
  dashboard('rack-elevation-dev', 'Rack elevation', [
    panel(1, 'Basic rack', { h: 25, w: 8, x: 0, y: 0 }, { fixture: 'basic', options: { label: ['name', 'value'] } }),
    panel(
      2,
      'No data',
      { h: 25, w: 4, x: 8, y: 0 },
      { targets: [{ datasource: DATASOURCE, refId: 'A', scenarioId: 'no_data_points' }] }
    ),
    panel(3, 'Prometheus, not joined', { h: 25, w: 6, x: 12, y: 0 }, { fixture: 'prometheus-auto' }),
    panel(4, 'Prometheus, joined', { h: 25, w: 6, x: 18, y: 0 }, prometheusJoined),
  ])
);

// fixtures.json: one panel per reference fixture, sized for 16 px units.
const FIXTURE_PANELS = [
  ['basic', 'One 42U rack, every state', 8, 25],
  ['two-faces', 'Front, rear and full-depth devices', 8, 25],
  ['desc-units', 'Descending numbering from U0, next to the same rack ascending', 8, 25],
  ['zero-u', 'PDUs and a cable manager in the 0U band', 8, 25],
  ['collisions', 'Overlaps, overflows and a duplicate: every device drawn, errors listed', 8, 25],
  ['auto-height', 'No racks frame: the rack grows to 47U', 8, 25],
  ['children', 'Blades listed in the tooltip of their chassis', 8, 25],
  ['prometheus-auto', 'Three Prometheus frames, not joined: the panel points to Join by field', 8, 25],
  ['multi-rack', 'Five racks with a racks frame and an alerts frame', 24, 28],
  ['ten-inch', 'A 10-inch rack next to a 19-inch one', 8, 12],
  ['large', '30 racks, 1000 devices, fitted to the panel', 24, 16],
];
const positions = flow([...FIXTURE_PANELS.map(([, , w, h]) => [w, h]), [8, 25]]);
/** Options that show what a fixture is about. */
const FIXTURE_OPTIONS = {
  'two-faces': { face: 'both' },
  'zero-u': { face: 'both' },
  large: { fitToPanel: true },
  'multi-rack': { valueFields: ['value', 'current'] },
};
const fixturePanels = FIXTURE_PANELS.map(([fixture, description], i) =>
  panel(i + 1, fixture, positions[i], {
    fixture,
    description,
    options: { label: ['name', 'value'], ...FIXTURE_OPTIONS[fixture] },
  })
);
fixturePanels.push(panel(FIXTURE_PANELS.length + 1, 'prometheus-auto, joined', positions.at(-1), prometheusJoined));
write('fixtures.json', dashboard('rack-elevation-fixtures', 'Rack elevation fixtures', fixturePanels));

// demo.json: the demo dashboard, also used by the e2e tests of the interactions.
const DEMO_UID = 'rack-elevation-demo';
const demoFieldConfig = {
  ...TEMPERATURE,
  overrides: [
    // Links of the racks: an override on the racks query, the defaults being written for the devices.
    {
      matcher: { id: 'byFrameRefID', options: 'racks' },
      properties: [
        {
          id: 'links',
          value: [
            {
              title: 'Open rack in NetBox',
              url: 'https://netbox.example.com/dcim/racks/?q=${__data.fields.rack}',
              targetBlank: true,
            },
          ],
        },
      ],
    },
    // Current of the PDUs: its own unit and thresholds, the second colour field of the demo.
    {
      matcher: { id: 'byName', options: 'current' },
      properties: [
        { id: 'unit', value: 'amp' },
        {
          id: 'thresholds',
          value: {
            mode: 'absolute',
            steps: [
              { color: 'green', value: null },
              { color: 'yellow', value: 10 },
              { color: 'red', value: 14 },
            ],
          },
        },
      ],
    },
  ],
  defaults: {
    ...TEMPERATURE.defaults,
    links: [
      {
        title: 'Open in NetBox',
        url: 'https://netbox.example.com/dcim/devices/?q=${__data.fields.device}',
        targetBlank: true,
      },
      {
        title: 'Highlight in this dashboard',
        url: `/d/${DEMO_UID}/rack-elevation-demo?var-device=\${__data.fields.device}&\${role:queryparam}`,
      },
    ],
  },
};
write(
  'demo.json',
  dashboard(
    DEMO_UID,
    'Rack elevation demo',
    [
      panel(
        1,
        'Front',
        { h: 25, w: 6, x: 0, y: 0 },
        { fixture: 'basic', options: { label: ['name', 'value'] }, fieldConfig: demoFieldConfig }
      ),
      panel(
        2,
        'Both faces',
        { h: 28, w: 18, x: 6, y: 0 },
        {
          fixture: 'multi-rack',
          description: 'Racks frame and alerts frame: badges on the devices with active alerts.',
          options: { face: 'both', label: ['name', 'value'], valueFields: ['value', 'current'] },
          fieldConfig: demoFieldConfig,
        }
      ),
      panel(
        3,
        'Filtered by role',
        { h: 28, w: 24, x: 0, y: 28 },
        {
          fixture: 'multi-rack',
          options: { roles: ['$role'], label: ['name', 'role'] },
          fieldConfig: demoFieldConfig,
        }
      ),
    ],
    {
      templating: {
        list: [
          {
            type: 'textbox',
            name: 'device',
            label: 'Highlighted device',
            query: '',
            current: { text: '', value: '' },
            options: [],
          },
          {
            type: 'custom',
            name: 'role',
            label: 'Role',
            query: 'switch,server,storage,firewall,ups,pdu,patch-panel',
            multi: true,
            includeAll: true,
            current: { text: ['switch'], value: ['switch'] },
            options: [],
          },
        ],
      },
    }
  )
);

// live.json: the PromQL recipes on the metrics of dev/exporter (npm run server).
const PROMETHEUS = { type: 'prometheus', uid: 'prometheus' };
const promql = (refId, expr) => ({ datasource: PROMETHEUS, refId, expr, instant: true, range: false, format: 'table' });
const RACKS_QUERY = promql('racks', 'netbox_rack_info');
const ALERTS_QUERY = promql('alerts', 'ALERTS{alertstate="firing", device!=""}');
write(
  'live.json',
  dashboard(
    'rack-elevation-live',
    'Rack elevation live (Prometheus)',
    [
      {
        ...panel(
          1,
          'One query with group_left: status only',
          { h: 28, w: 24, x: 0, y: 0 },
          {
            description:
              'device_up joined to netbox_device_info in PromQL, status mapped to Value. Devices without device_up (patch panels) are dropped by the join.',
            targets: [
              promql(
                'A',
                'device_up * on (device) group_left (rack, position, u_height, face, is_full_depth, role, model) netbox_device_info'
              ),
              RACKS_QUERY,
              ALERTS_QUERY,
            ],
            options: { columns: { status: 'Value #A' } },
          }
        ),
        datasource: PROMETHEUS,
      },
      {
        ...panel(
          2,
          'Three queries joined by field: status and temperature',
          { h: 28, w: 24, x: 0, y: 28 },
          {
            description:
              'netbox_device_info, device_up and device_temperature_celsius joined on device by the Join by field transformation (applied to A, B and C only). Thresholds on the temperature give the colour.',
            targets: [
              promql('A', 'netbox_device_info'),
              promql('B', 'device_up'),
              promql('C', 'device_temperature_celsius'),
              RACKS_QUERY,
              ALERTS_QUERY,
            ],
            transformations: [
              {
                id: 'joinByField',
                options: { byField: 'device', mode: 'outerTabular' },
                filter: { id: 'byRefId', options: '/^(A|B|C)$/' },
              },
            ],
            options: { columns: { status: 'Value #B' }, valueFields: ['Value #C'], label: ['name', 'value'] },
            fieldConfig: TEMPERATURE,
          }
        ),
        datasource: PROMETHEUS,
      },
    ],
    { refresh: '10s', time: { from: 'now-15m', to: 'now' } }
  )
);
