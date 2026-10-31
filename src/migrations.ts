import { PanelModel } from '@grafana/data';
import { RackElevationOptions } from './types';

/**
 * Brings options saved by an older version of the plugin to the current shape. Grafana calls it when the plugin
 * version of a panel differs from the installed one; the dashboard keeps the old options until it is saved.
 */
export function migrateOptions(panel: PanelModel<Partial<RackElevationOptions>>): Partial<RackElevationOptions> {
  const options = { ...panel.options };
  // The value column picker became the ordered colour fields.
  if (options.columns?.value) {
    const { value, ...columns } = options.columns;
    options.valueFields = options.valueFields?.length ? options.valueFields : [value];
    options.columns = columns;
  }
  // Without its $, Grafana does not see the highlight variable as a dependency and never redraws the panel.
  const variable = options.highlightVariable?.trim();
  if (variable && !variable.startsWith('$')) {
    options.highlightVariable = `$${variable}`;
  }
  return options;
}
