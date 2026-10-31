import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { RackModel } from '../model';
import { PlacedDevice } from '../types';
import { unitRange } from '../layout/errors';

const FIXTURES = join(__dirname, '..', '..', 'tests', 'fixtures');

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      rows.push([...row, cell]);
      row = [];
      cell = '';
    } else if (c !== '\r') {
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) {
    rows.push([...row, cell]);
  }
  return rows;
}

/**
 * Like TestData's CSV content: numeric and boolean columns are typed, empty cells are null there. A numeric Time
 * column is a time field, as in the Prometheus frames that the fixtures stand for.
 */
export function csvToFrame(text: string, refId: string): DataFrame {
  const [header, ...rows] = parseCsv(text);
  return toDataFrame({
    refId,
    name: refId,
    fields: header.map((name, i) => {
      const cells = rows.map((r) => r[i] ?? '');
      const filled = cells.filter((c) => c !== '');
      if (filled.length > 0 && filled.every((c) => c.trim() !== '' && Number.isFinite(Number(c)))) {
        const type = name.toLowerCase() === 'time' ? FieldType.time : FieldType.number;
        return { name, type, values: cells.map((c) => (c === '' ? null : Number(c))) };
      }
      if (filled.length > 0 && filled.every((c) => /^(true|false)$/i.test(c))) {
        return { name, type: FieldType.boolean, values: cells.map((c) => (c === '' ? null : /^true$/i.test(c))) };
      }
      return { name, type: FieldType.string, values: cells };
    }),
  });
}

/** Frames of a fixture: one for `name.csv`, or one per CSV file of the `name/` directory, named after the file. */
export function loadFixture(name: string): DataFrame[] {
  const path = join(FIXTURES, name);
  const files = statSync(path, { throwIfNoEntry: false })?.isDirectory()
    ? readdirSync(path)
        .filter((f) => f.endsWith('.csv'))
        .sort()
        .map((f) => join(path, f))
    : [`${path}.csv`];
  return files.map((f) =>
    csvToFrame(
      readFileSync(f, 'utf8'),
      f
        .split('/')
        .pop()!
        .replace(/\.csv$/, '')
    )
  );
}

const describePlaced = (p: PlacedDevice) =>
  [
    `  ${p.face.padEnd(5)} slot ${String(p.top).padStart(3)} ${unitRange(...p.units).padEnd(8)} ${p.device.name}`,
    p.back ? '(back)' : '',
    p.device.state,
    p.device.value !== undefined ? `value=${p.device.value}` : '',
    p.device.alerts.length ? `alerts=${p.device.alerts.map((a) => a.name).join('+')}` : '',
    p.device.children.length ? `children=${p.device.children.map((c) => c.name).join('+')}` : '',
    p.conflict ? `CONFLICT=${p.conflict}` : '',
  ]
    .filter(Boolean)
    .join(' ');

/** Readable summary of a model, for snapshots that a human can review. */
export function describeModel(model: RackModel): string {
  const lines: string[] = [];
  for (const { rack, front, rear, zeroU } of model.racks) {
    const units = unitRange(rack.startingUnit, rack.startingUnit + rack.uHeight - 1);
    lines.push(
      `${rack.name} [${rack.id}] ${rack.uHeight}U ${units} ${rack.descUnits ? 'descending' : 'ascending'}` +
        `${rack.fixedHeight ? '' : ' (height not fixed)'}${rack.site ? ` site=${rack.site}` : ''}` +
        `${rack.width !== 19 ? ` ${rack.width}-inch` : ''}`
    );
    [...front, ...rear].forEach((p) => lines.push(describePlaced(p)));
    zeroU.forEach((d) => lines.push(`  0U    ${d.name} ${d.face} ${d.state}`));
  }
  if (model.errors.length) {
    lines.push('Errors:');
    model.errors.forEach((e) => lines.push(`  [${e.kind}] ${e.message}`));
  }
  return lines.join('\n');
}
