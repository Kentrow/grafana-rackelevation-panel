import { PanelModel } from '@grafana/data';
import { migrateOptions } from './migrations';
import { RackElevationOptions } from './types';

const panel = (options: Partial<RackElevationOptions>): PanelModel<Partial<RackElevationOptions>> => ({
  id: 1,
  type: 'kentrow-rackelevation-panel',
  options,
  fieldConfig: { defaults: {}, overrides: [] },
});

describe('migrateOptions', () => {
  it('turns the value column into the first colour field', () => {
    expect(migrateOptions(panel({ columns: { status: 'Value #B', value: 'Value #C' } }))).toEqual({
      columns: { status: 'Value #B' },
      valueFields: ['Value #C'],
    });
  });

  it('keeps colour fields that are already set', () => {
    expect(migrateOptions(panel({ columns: { value: 'temp' }, valueFields: ['current'] })).valueFields).toEqual([
      'current',
    ]);
  });

  it('adds the $ to the highlight variable', () => {
    expect(migrateOptions(panel({ highlightVariable: 'device' })).highlightVariable).toBe('$device');
    expect(migrateOptions(panel({ highlightVariable: '${host}' })).highlightVariable).toBe('${host}');
  });

  it('leaves current options as they are', () => {
    const options: Partial<RackElevationOptions> = { valueFields: ['value'], highlightVariable: '$device', racks: [] };
    expect(migrateOptions(panel(options))).toEqual(options);
  });
});
