// Writes the generated fixtures of tests/fixtures: multi-rack/, large.csv and prometheus-auto/.
// Deterministic: the same script always writes the same files. Run with `npm run fixtures`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');

/** Small seeded PRNG (mulberry32). */
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEVICE_COLUMNS = [
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
];

function csv(columns, rows) {
  const cell = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

function write(path, content) {
  mkdirSync(dirname(join(FIXTURES, path)), { recursive: true });
  writeFileSync(join(FIXTURES, path), content);
}

/** Status like Prometheus up: mostly 1, a few 0, a few unmonitored. */
function status(rnd, down = 0.04, unknown = 0.03) {
  const r = rnd();
  return r < down ? 0 : r < down + unknown ? '' : 1;
}

const temperature = (rnd, base) => Math.round((base + rnd() * 30) * 10) / 10;

// multi-rack: five racks of a room, the racks frame not in alphabetical order, one active alert frame.
function multiRack() {
  const rnd = random(42);
  const racks = [
    { rack: 'PAR1-A3', name: 'Paris A3', u_height: 48, starting_unit: 1, desc_units: false, site: 'PAR1' },
    { rack: 'PAR1-A1', name: 'Paris A1', u_height: 42, starting_unit: 1, desc_units: false, site: 'PAR1' },
    { rack: 'PAR1-A2', name: 'Paris A2', u_height: 42, starting_unit: 1, desc_units: false, site: 'PAR1' },
    { rack: 'PAR1-A5', name: 'Paris A5', u_height: 42, starting_unit: 1, desc_units: false, site: 'PAR1' },
    { rack: 'PAR1-A4', name: 'Paris A4', u_height: 24, starting_unit: 1, desc_units: false, site: 'PAR1' },
  ];
  const servers = [
    ['server', 'Dell R660', 1],
    ['server', 'Dell R760', 2],
    ['server', 'HPE DL360 Gen11', 1],
    ['storage', 'NetApp AFF A250', 2],
    ['server', 'Lenovo SR650 V3', 2],
  ];
  const devices = [];
  for (const [i, r] of racks.entries()) {
    const n = r.rack.slice(-2).toLowerCase();
    const top = r.u_height;
    const add = (d) => devices.push({ rack: r.rack, face: 'front', is_full_depth: true, ...d });
    add({
      device: `patch-${n}-01`,
      position: top,
      u_height: 1,
      is_full_depth: false,
      role: 'patch-panel',
      model: 'Panduit CP48',
    });
    add({
      device: `sw-${n}-tor-01`,
      position: top - 2,
      u_height: 1,
      role: 'switch',
      model: 'Arista 7050SX3',
      status: status(rnd),
      value: temperature(rnd, 35),
    });
    add({
      device: `sw-${n}-tor-02`,
      position: top - 3,
      u_height: 1,
      role: 'switch',
      model: 'Arista 7050SX3',
      status: status(rnd),
      value: temperature(rnd, 35),
    });
    if (r.rack === 'PAR1-A1') {
      add({
        device: 'fw-par1-01',
        position: top - 5,
        u_height: 1,
        role: 'firewall',
        model: 'FortiGate 600F',
        status: 1,
        value: 48,
      });
      add({
        device: 'fw-par1-02',
        position: top - 6,
        u_height: 1,
        role: 'firewall',
        model: 'FortiGate 600F',
        status: 0,
      });
    }
    let position = top - 9;
    const count = r.u_height > 30 ? 6 + (i % 3) : 3;
    for (let k = 1; k <= count && position > 4; k++) {
      const [role, model, height] = servers[(i + k) % servers.length];
      position -= height;
      add({
        device: `${role === 'storage' ? 'nas' : 'srv'}-${n}-${String(k).padStart(2, '0')}`,
        position: position + 1,
        u_height: height,
        role,
        model,
        status: status(rnd, 0.1, 0.1),
        value: temperature(rnd, 28),
      });
      position -= rnd() < 0.4 ? 1 : 0;
    }
    if (r.u_height > 30) {
      add({
        device: `ups-${n}-01`,
        position: 1,
        u_height: 3,
        face: 'rear',
        role: 'ups',
        model: 'APC SRT5K',
        status: 1,
        value: 27,
      });
    }
    for (const side of ['a', 'b']) {
      add({
        device: `pdu-${n}-${side}`,
        u_height: 0,
        face: 'rear',
        is_full_depth: false,
        role: 'pdu',
        model: 'APC AP8853',
        status: 1,
        // Amperes, not degrees: a second colour field with its own unit and thresholds.
        current: Math.round((2 + rnd() * 14) * 10) / 10,
      });
    }
  }
  // A column outside the contract, listed in the tooltip as it is.
  devices.forEach((d, i) => (d.serial = `SN${String(4711 + i * 37).padStart(6, '0')}`));
  const alerts = [
    { device: 'sw-a1-tor-02', alertname: 'HighTemperature', severity: 'critical' },
    { device: 'fw-par1-02', alertname: 'DeviceDown', severity: 'critical' },
    { device: 'sw-a3-tor-01', alertname: 'InterfaceErrors', severity: 'warning' },
    { device: 'sw-a3-tor-01', alertname: 'HighCpu', severity: 'warning' },
    { device: 'nas-a1-02', alertname: 'DiskFull', severity: 'warning' },
  ];
  const names = new Set(devices.map((d) => d.device));
  for (const a of alerts) {
    if (!names.has(a.device)) {
      throw new Error(`Alert on unknown device ${a.device}`);
    }
  }
  write('multi-rack/racks.csv', csv(['rack', 'name', 'u_height', 'starting_unit', 'desc_units', 'site'], racks));
  write('multi-rack/devices.csv', csv([...DEVICE_COLUMNS, 'current', 'serial'], devices));
  write('multi-rack/alerts.csv', csv(['device', 'alertname', 'severity'], alerts));
}

// large: 30 racks of 42U, 1000 devices, for the performance test.
function large() {
  const rnd = random(7);
  const devices = [];
  for (let r = 1; r <= 30; r++) {
    const rack = `DC1-R${String(r).padStart(2, '0')}`;
    const add = (d) => devices.push({ rack, face: 'front', is_full_depth: true, ...d });
    add({
      device: `${rack}-sw-01`,
      position: 42,
      u_height: 1,
      role: 'switch',
      model: 'Arista 7050SX3',
      status: status(rnd),
      value: temperature(rnd, 35),
    });
    add({
      device: `${rack}-sw-02`,
      position: 41,
      u_height: 1,
      role: 'switch',
      model: 'Arista 7050SX3',
      status: status(rnd),
      value: temperature(rnd, 35),
    });
    // 25 1U and 4 2U servers fill U1-U33, ten racks get an extra 1U server: 30 * 33 + 10 = 1000 devices.
    const heights = [2, 2, 2, 2, ...Array(25).fill(1), ...(r <= 10 ? [1] : [])];
    let position = 1;
    for (const [k, height] of heights.entries()) {
      add({
        device: `${rack}-srv-${String(k + 1).padStart(2, '0')}`,
        position,
        u_height: height,
        role: 'server',
        model: height === 2 ? 'Dell R760' : 'Dell R660',
        status: status(rnd),
        value: temperature(rnd, 25),
      });
      position += height;
    }
    for (const side of ['a', 'b']) {
      add({
        device: `${rack}-pdu-${side}`,
        u_height: 0,
        face: 'rear',
        is_full_depth: false,
        role: 'pdu',
        model: 'APC AP8853',
        status: 1,
        value: 3,
      });
    }
  }
  write('large.csv', csv(DEVICE_COLUMNS, devices));
}

// prometheus-auto: what three instant queries in table format return for basic.csv, before any join.
function prometheusAuto() {
  const time = 1793390400000;
  const [header, ...lines] = readFileSync(join(FIXTURES, 'basic.csv'), 'utf8').trim().split('\n');
  const columns = header.split(',');
  const basic = lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [columns[i], v])));
  const info = basic.map((d) => ({ Time: time, ...d, 'Value #A': 1 }));
  const monitored = basic.filter((d) => d.status !== '');
  const up = monitored.map((d) => ({
    Time: time,
    device: d.device,
    job: 'snmp',
    'Value #B': d.status === 'up' ? 1 : 0,
  }));
  const temp = monitored
    .filter((d) => d.value !== '')
    .map((d) => ({ Time: time, device: d.device, 'Value #C': d.value }));
  write(
    'prometheus-auto/device_info.csv',
    csv(['Time', 'device', 'rack', 'position', 'u_height', 'face', 'is_full_depth', 'role', 'model', 'Value #A'], info)
  );
  write('prometheus-auto/up.csv', csv(['Time', 'device', 'job', 'Value #B'], up));
  write('prometheus-auto/temperature.csv', csv(['Time', 'device', 'Value #C'], temp));
}

multiRack();
large();
prometheusAuto();
