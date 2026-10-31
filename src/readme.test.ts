import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_UP_VALUES } from './data/status';
import { buildModel } from './model';
import { csvToFrame, loadFixture } from './testing/fixtures';

// The quick start of the README must keep working: its CSV is the quick-start fixture.
describe('README quick start', () => {
  const readme = readFileSync(join(__dirname, 'README.md'), 'utf8');
  const csv = readme
    .match(/```csv\n([\s\S]*?)```/)![1]
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

  it('is the quick-start fixture', () => {
    expect(csv).toBe(readFileSync(join(__dirname, '..', 'tests', 'fixtures', 'quick-start.csv'), 'utf8').trim());
  });

  it('draws one rack of ten devices without problem', () => {
    const model = buildModel([csvToFrame(csv, 'A')], {
      frames: {},
      columns: {},
      valueFields: [],
      upValues: DEFAULT_UP_VALUES,
      racks: [],
    });
    expect(model.errors).toEqual([]);
    expect(model.racks).toHaveLength(1);
    expect(model.racks[0].front.length + model.racks[0].zeroU.length).toBe(10);
    expect(loadFixture('quick-start')).toHaveLength(1);
  });
});
