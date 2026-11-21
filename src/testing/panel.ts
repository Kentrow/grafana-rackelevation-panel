import {
  DataFrame,
  EventBusSrv,
  getDefaultTimeRange,
  InterpolateFunction,
  LoadingState,
  PanelProps,
} from '@grafana/data';
import { DEFAULT_OPTIONS, RackElevationOptions } from '../types';

/**
 * replaceVariables of a dashboard with these variables: $name, ${name} and ${name:csv} give the values joined by
 * commas, or what a format function makes of them (a string for a single value, as Grafana gives).
 */
export const dashboardVariables =
  (variables: Record<string, string[]>): InterpolateFunction =>
  (text, _scopedVars, format) =>
    text.replace(/\$\{(\w+)(?::csv)?\}|\$(\w+)/g, (match, braced, plain) => {
      const values = variables[braced ?? plain];
      if (!values) {
        return match;
      }
      return typeof format === 'function' ? format(values.length === 1 ? values[0] : values) : values.join(',');
    });

/** Props of the panel in a 400 x 300 px panel of a dashboard with the given variables. */
export const panelProps = (
  series: DataFrame[],
  options: Partial<RackElevationOptions> = {},
  variables: Record<string, string[]> = {}
): PanelProps<RackElevationOptions> => ({
  id: 1,
  title: 'Rack',
  data: { state: LoadingState.Done, series, timeRange: getDefaultTimeRange() },
  timeRange: getDefaultTimeRange(),
  timeZone: 'utc',
  options: { ...DEFAULT_OPTIONS, ...options },
  fieldConfig: { defaults: {}, overrides: [] },
  transparent: false,
  width: 400,
  height: 300,
  renderCounter: 0,
  eventBus: new EventBusSrv(),
  onOptionsChange: jest.fn(),
  onFieldConfigChange: jest.fn(),
  onChangeTimeRange: jest.fn(),
  replaceVariables: dashboardVariables(variables),
});
