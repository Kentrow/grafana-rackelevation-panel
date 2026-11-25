import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_OPTIONS } from './types';

const DIRECTORY = join(__dirname, '..', 'examples', 'dashboards');

interface Panel {
  type: string;
  datasource?: { uid?: string };
  targets?: Array<{ datasource?: { uid?: string } }>;
  options?: Record<string, unknown>;
}

interface Exported {
  __inputs: Array<{ name: string }>;
  __requires: Array<{ type: string; id: string }>;
  panels: Panel[];
  templating: { list: Array<{ datasource?: { uid?: string } }> };
}

/** Every data source uid written as an input, such as ${DS_NETBOX}. */
const inputsOf = (json: string) => new Set([...json.matchAll(/\$\{(DS_[A-Z_]+)\}/g)].map((m) => m[1]));

// The example dashboards of the README are imported as they are: they must keep matching the panel options.
describe.each(readdirSync(DIRECTORY).filter((f) => f.endsWith('.json')))('example dashboard %s', (file) => {
  const json = readFileSync(join(DIRECTORY, file), 'utf8');
  const dashboard: Exported = JSON.parse(json);
  const racks = dashboard.panels.filter((p) => p.type === 'kentrow-rackelevation-panel');

  it('declares every data source it uses as an input, and requires the panel', () => {
    expect([...inputsOf(json)].sort()).toEqual(dashboard.__inputs.map((i) => i.name).sort());
    expect(dashboard.__requires).toContainEqual(
      expect.objectContaining({ type: 'panel', id: 'kentrow-rackelevation-panel' })
    );
  });

  it('has a rack panel whose queries all have a data source', () => {
    expect(racks.length).toBeGreaterThan(0);
    for (const panel of racks) {
      expect(panel.datasource?.uid).toBeTruthy();
      for (const target of panel.targets ?? []) {
        expect(target.datasource?.uid).toMatch(/^\$\{DS_[A-Z_]+\}$/);
      }
    }
  });

  it('sets only options that the panel has', () => {
    for (const panel of racks) {
      expect(Object.keys(panel.options ?? {}).filter((key) => !(key in DEFAULT_OPTIONS))).toEqual([]);
    }
  });
});
