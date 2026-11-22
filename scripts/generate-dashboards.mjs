// Writes the provisioned dashboards from tests/fixtures, so that they never drift from the unit test fixtures, and the
// example dashboards of examples/dashboards that users import. Each CSV file becomes a TestData "CSV content" query
// whose refId is the file name. Run with `npm run dashboards`.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

function write(name, content, directory = DASHBOARDS) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name), JSON.stringify(content, null, 2) + '\n');
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
          options: {
            face: 'both',
            label: ['name', 'value'],
            valueFields: ['value', 'current'],
            freeSpace: '$space',
          },
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
            type: 'textbox',
            name: 'space',
            label: 'Free space (U)',
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
      {
        ...panel(
          3,
          'Labelled series, no join: status and temperature',
          { h: 28, w: 24, x: 0, y: 56 },
          {
            description:
              'netbox_device_info as a table, device_up and device_temperature_celsius as time series: the panel reads their device label and their last values, without a transformation.',
            targets: [
              promql('A', 'netbox_device_info'),
              {
                datasource: PROMETHEUS,
                refId: 'B',
                expr: 'device_up',
                instant: false,
                range: true,
                format: 'time_series',
              },
              {
                datasource: PROMETHEUS,
                refId: 'C',
                expr: 'device_temperature_celsius',
                instant: false,
                range: true,
                format: 'time_series',
              },
              RACKS_QUERY,
              ALERTS_QUERY,
            ],
            options: {
              columns: { status: 'device_up' },
              valueFields: ['device_temperature_celsius'],
              label: ['name', 'value'],
            },
            fieldConfig: TEMPERATURE,
          }
        ),
        datasource: PROMETHEUS,
      },
    ],
    { refresh: '10s', time: { from: 'now-15m', to: 'now' } }
  )
);

// examples/dashboards: dashboards to download from the README and import, in the format of a dashboard exported for
// sharing externally: the data sources are inputs picked at import.
const EXAMPLES = join(ROOT, 'examples', 'dashboards');
const INFINITY = 'yesoreyeram-infinity-datasource';
/** First version of the panel with every option the examples use. */
const PANEL_VERSION = '1.2.0';
const DOCS = 'https://github.com/Kentrow/grafana-rackelevation-panel/blob/main/src/README.md';
const MIXED = { type: 'datasource', uid: '-- Mixed --' };

function exported(content, inputs) {
  return {
    __inputs: inputs.map(({ name, label, pluginId, pluginName, description }) => ({
      name,
      label,
      description,
      type: 'datasource',
      pluginId,
      pluginName,
    })),
    __elements: {},
    __requires: [
      { type: 'grafana', id: 'grafana', name: 'Grafana', version: '13.2.0' },
      { type: 'panel', id: PANEL_TYPE, name: 'Rack elevation', version: PANEL_VERSION },
      { type: 'panel', id: 'text', name: 'Text', version: '' },
      ...inputs.map(({ pluginId, pluginName, version }) => ({
        type: 'datasource',
        id: pluginId,
        name: pluginName,
        version,
      })),
    ],
    id: null,
    ...content,
  };
}

function textPanel(id, gridPos, content) {
  return { id, type: 'text', title: '', gridPos, options: { mode: 'markdown', content } };
}

const textbox = (name, label) => ({
  type: 'textbox',
  name,
  label,
  query: '',
  current: { text: '', value: '' },
  options: [],
});

/** Grafana colours of the multi-rack fixture: temperature, and current for the PDUs. */
const exampleFieldConfig = (links) => ({
  defaults: { ...TEMPERATURE.defaults, links },
  overrides: demoFieldConfig.overrides.filter((o) => o.matcher.id === 'byName'),
});

// CSV: the multi-rack fixture inline in Infinity queries, to switch to the URL of a CSV file.
const CSV_UID = 'rack-elevation-csv-example';
const INFINITY_CSV = { type: INFINITY, uid: '${DS_INFINITY}' };
const CSV_NUMBERS = new Set(['position', 'u_height', 'value', 'power', 'current', 'starting_unit', 'power_capacity']);
/** Infinity query of a fixture file, with typed columns: Infinity reads every CSV cell as a string otherwise. */
function csvQuery(refId, file) {
  const data = readFileSync(join(FIXTURES, 'multi-rack', `${file}.csv`), 'utf8');
  return {
    datasource: INFINITY_CSV,
    refId,
    type: 'csv',
    source: 'inline',
    format: 'table',
    parser: 'backend',
    root_selector: '',
    data,
    // Booleans stay strings: Infinity reads "false" as empty in a CSV boolean column, and the panel reads the text.
    columns: data
      .split('\n')[0]
      .split(',')
      .map((name) => ({ selector: name, text: name, type: CSV_NUMBERS.has(name) ? 'number' : 'string' })),
  };
}
write(
  'rack-elevation-csv.json',
  exported(
    dashboard(
      CSV_UID,
      'Rack elevation from CSV',
      [
        textPanel(
          1,
          { h: 4, w: 24, x: 0, y: 0 },
          [
            'The three queries of the panel hold their CSV inline: **devices**, **racks** and **alerts**. To read your',
            'own files, edit a query, set **Source** to **URL** and give the URL of the CSV file. Keep the typed columns:',
            'numbers for the positions, heights and values, **string** for `is_full_depth` and `desc_units`. The columns',
            `are described in the [data contract](${DOCS}#data-contract).`,
          ].join(' ')
        ),
        panel(
          2,
          'Racks',
          { h: 28, w: 24, x: 0, y: 4 },
          {
            targets: [csvQuery('devices', 'devices'), csvQuery('racks', 'racks'), csvQuery('alerts', 'alerts')],
            options: { face: 'both', label: ['name', 'value'], valueFields: ['value', 'current'], freeSpace: '$space' },
            fieldConfig: exampleFieldConfig([
              {
                title: 'Highlight in this dashboard',
                url: `/d/${CSV_UID}/rack-elevation-from-csv?var-device=\${__data.fields.device}`,
              },
            ]),
          }
        ),
      ].map((p) => (p.type === PANEL_TYPE ? { ...p, datasource: INFINITY_CSV } : p)),
      { templating: { list: [textbox('device', 'Highlighted device'), textbox('space', 'Free space (U)')] } }
    ),
    [
      {
        name: 'DS_INFINITY',
        label: 'Infinity',
        description: 'Infinity data source, which reads the CSV',
        pluginId: INFINITY,
        pluginName: 'Infinity',
        version: '4.1.0',
      },
    ]
  ),
  EXAMPLES
);

// NetBox and Prometheus: the inventory from the GraphQL API of NetBox, the state and the alerts from Prometheus, read
// by their device label: no transformation.
const NETBOX_UID = 'rack-elevation-netbox-prometheus';
const NETBOX = { type: INFINITY, uid: '${DS_NETBOX}' };
const PROMETHEUS_INPUT = { type: 'prometheus', uid: '${DS_PROMETHEUS}' };
const column = (selector, text, type = 'string') => ({ selector, text, type });
function graphql(refId, rootSelector, query, columns) {
  return {
    datasource: NETBOX,
    refId,
    type: 'graphql',
    source: 'url',
    format: 'table',
    parser: 'backend',
    url: '/graphql/',
    url_options: { method: 'POST', body_type: 'graphql', body_graphql_query: query },
    root_selector: rootSelector,
    columns,
  };
}
const DEVICES_GRAPHQL = `query {
  device_list(filters: { site: { slug: { exact: "$site" } } }) {
    name
    position
    face
    status
    rack {
      name
    }
    role {
      name
    }
    device_type {
      model
      u_height
      is_full_depth
    }
    parent_bay {
      device {
        name
      }
    }
  }
}`;
const RACKS_GRAPHQL = `query {
  rack_list(filters: { site: { slug: { exact: "$site" } } }) {
    name
    u_height
    starting_unit
    desc_units
    width
    site {
      name
    }
  }
}`;
const SITES_GRAPHQL = `query {
  site_list {
    name
    slug
  }
}`;
write(
  'rack-elevation-netbox-prometheus.json',
  exported(
    dashboard(
      NETBOX_UID,
      'Rack elevation from NetBox and Prometheus',
      [
        textPanel(
          1,
          { h: 4, w: 24, x: 0, y: 0 },
          [
            'The **devices** and **racks** come from the GraphQL API of NetBox, through Infinity: set the URL of NetBox',
            'in the Infinity data source, with an `Authorization` header holding the API token. The state comes from',
            'the Prometheus series of **health**, read by their `device` label: replace `up` with the 0/1 metric of your',
            'devices and map **status** to its name in the **Columns** options, or clear it to take the NetBox status.',
            'The **alerts** are the firing alerts with a `device` label. Set the `netbox_url` variable in the settings',
            `for the links. See the [NetBox recipe](${DOCS}#netbox-with-the-infinity-data-source).`,
          ].join(' ')
        ),
        {
          ...panel(
            2,
            'Racks',
            { h: 28, w: 24, x: 0, y: 4 },
            {
              targets: [
                graphql('devices', 'data.device_list', DEVICES_GRAPHQL, [
                  column('name', 'device'),
                  column('rack.name', 'rack'),
                  column('position', 'position', 'number'),
                  column('device_type.u_height', 'u_height', 'number'),
                  column('face', 'face'),
                  column('status', 'status'),
                  column('device_type.is_full_depth', 'is_full_depth', 'boolean'),
                  column('role.name', 'role'),
                  column('device_type.model', 'model'),
                  column('parent_bay.device.name', 'parent_device'),
                ]),
                graphql('racks', 'data.rack_list', RACKS_GRAPHQL, [
                  column('name', 'rack'),
                  column('u_height', 'u_height', 'number'),
                  column('starting_unit', 'starting_unit', 'number'),
                  column('desc_units', 'desc_units', 'boolean'),
                  column('width', 'width', 'number'),
                  column('site.name', 'site'),
                ]),
                {
                  datasource: PROMETHEUS_INPUT,
                  refId: 'health',
                  expr: 'up{device!=""}',
                  legendFormat: '{{device}}',
                  instant: false,
                  range: true,
                  format: 'time_series',
                },
                {
                  datasource: PROMETHEUS_INPUT,
                  refId: 'alerts',
                  expr: 'ALERTS{alertstate="firing", device!=""}',
                  instant: true,
                  range: false,
                  format: 'table',
                },
              ],
              options: { face: 'both', columns: { status: 'up' } },
              fieldConfig: {
                defaults: {
                  links: [
                    {
                      title: 'Open in NetBox',
                      url: '${netbox_url}/dcim/devices/?q=${__data.fields.device}',
                      targetBlank: true,
                    },
                    {
                      title: 'Highlight in this dashboard',
                      url: `/d/${NETBOX_UID}/rack-elevation-from-netbox-and-prometheus?var-device=\${__data.fields.device}&\${site:queryparam}`,
                    },
                  ],
                },
                overrides: [],
              },
            }
          ),
          datasource: MIXED,
        },
      ],
      {
        time: { from: 'now-15m', to: 'now' },
        refresh: '1m',
        templating: {
          list: [
            {
              type: 'query',
              name: 'site',
              label: 'Site',
              datasource: NETBOX,
              query: {
                queryType: 'infinity',
                refId: 'variable',
                infinityQuery: {
                  ...graphql('variable', 'data.site_list', SITES_GRAPHQL, [
                    column('name', '__text'),
                    column('slug', '__value'),
                  ]),
                  datasource: undefined,
                },
              },
              refresh: 1,
              current: {},
              options: [],
            },
            textbox('device', 'Highlighted device'),
            {
              type: 'constant',
              name: 'netbox_url',
              query: 'https://netbox.example.com',
              hide: 2,
              options: [],
            },
          ],
        },
      }
    ),
    [
      {
        name: 'DS_NETBOX',
        label: 'NetBox',
        description: 'Infinity data source set up with the URL and the API token of NetBox',
        pluginId: INFINITY,
        pluginName: 'Infinity',
        version: '4.1.0',
      },
      {
        name: 'DS_PROMETHEUS',
        label: 'Prometheus',
        description: 'Prometheus with the health metric and the alerts of the devices',
        pluginId: 'prometheus',
        pluginName: 'Prometheus',
        version: '1.0.0',
      },
    ]
  ),
  EXAMPLES
);
