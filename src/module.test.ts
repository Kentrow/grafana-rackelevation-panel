import { FieldType, getPanelDataSummary, toDataFrame } from '@grafana/data';
import { plugin } from './module';
import { loadFixture } from './testing/fixtures';

describe('visualization suggestion', () => {
  const suggestions = (frames: Parameters<typeof getPanelDataSummary>[0]) =>
    (plugin.getSuggestions(getPanelDataSummary(frames)) ?? []).map((s) => s.name);

  it('is offered when a frame has rack and position columns', () => {
    expect(suggestions(loadFixture('multi-rack'))).toEqual(['Rack elevation']);
  });

  it('is not offered for other data, such as a time series', () => {
    const series = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'value', type: FieldType.number, values: [3, 4] },
      ],
    });
    expect(suggestions([series])).toEqual([]);
  });
});
