import {
  DataFrame,
  FieldColorModeId,
  FieldType,
  FieldConfigProperty,
  PanelPlugin,
  SelectableValue,
  VisualizationSuggestionScore,
} from '@grafana/data';
import { RackPanel } from './components/RackPanel';
import { findField, toText } from './data/mapping';
import { DEFAULT_UP_VALUES } from './data/status';
import { FrameSelect } from './editor/FrameSelect';
import { migrateOptions } from './migrations';
import { COLUMNS, DEFAULT_OPTIONS, LabelPart, RackElevationOptions } from './types';

const DATA = ['Data'];
const COLUMN_MAPPING = ['Columns'];
const DISPLAY = ['Display'];
const LABELS = ['Labels'];
const INTERACTIONS = ['Interactions'];

const LABEL_PARTS: Array<{ value: LabelPart; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'model', label: 'Model' },
  { value: 'value', label: 'Value' },
  { value: 'role', label: 'Role' },
];

/** Numeric fields of the data, offered as colour fields. */
async function fieldNamesOf(frames: DataFrame[] | undefined) {
  const names = new Set<string>();
  for (const frame of frames ?? []) {
    frame.fields.filter((f) => f.type === FieldType.number).forEach((f) => names.add(f.config.displayName || f.name));
  }
  return [...names].map((name) => ({ value: name, label: name }));
}

/** Roles found in the data, offered by the role filter. */
async function rolesOf(frames: DataFrame[] | undefined, roleColumn: string | undefined) {
  const roles = new Set<string>();
  for (const frame of frames ?? []) {
    const field = findField(frame, roleColumn || 'role');
    field?.values.forEach((v) => {
      const role = toText(v);
      if (role) {
        roles.add(role);
      }
    });
  }
  return [...roles].sort().map((role) => ({ value: role, label: role }));
}

const COLUMN_HELP: Record<string, string> = {
  device: 'Unique device name, the join key with the alerts frame.',
  rack: 'Rack the device is in.',
  position: 'Lowest-numbered unit occupied (NetBox). Empty for 0U devices.',
  u_height: 'Height in units, 1 by default.',
  face: 'front or rear, front by default.',
  is_full_depth: 'Seen from both faces, true by default.',
  role: 'Used by the role filter and the label.',
  model: 'Shown in the tooltip and the label.',
  status: 'In service when one of the In service values; no value means not monitored.',
  parent_device: 'Child devices are listed in the tooltip of their parent instead of being placed.',
};

export const plugin = new PanelPlugin<RackElevationOptions>(RackPanel)
  .setMigrationHandler(migrateOptions)
  // Standard options apply to the colour field: thresholds, colour scheme, value mappings, unit, decimals, links.
  .useFieldConfig({
    disableStandardOptions: [FieldConfigProperty.Actions],
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: { byValueSupport: true, bySeriesSupport: false, preferThresholdsMode: true },
        defaultValue: { mode: FieldColorModeId.Thresholds },
      },
    },
  })
  .setPanelOptions((builder) => {
    builder
      .addCustomEditor({
        id: 'frames.devices',
        path: 'frames.devices',
        name: 'Devices frame',
        description: 'Query refId or frame name. Empty: the frame with device and position or u_height columns.',
        category: DATA,
        editor: FrameSelect,
      })
      .addCustomEditor({
        id: 'frames.racks',
        path: 'frames.racks',
        name: 'Racks frame',
        description: 'Optional. Empty: the frame with a rack column and no device column.',
        category: DATA,
        editor: FrameSelect,
      })
      .addCustomEditor({
        id: 'frames.alerts',
        path: 'frames.alerts',
        name: 'Alerts frame',
        description: 'Optional. Empty: the frame with an alertname column.',
        category: DATA,
        editor: FrameSelect,
      })
      .addStringArray({
        path: 'upValues',
        name: 'In service values',
        description: 'Status values that mean in service, ignoring case. Any other value means out of service.',
        category: DATA,
        defaultValue: DEFAULT_UP_VALUES,
      });
    builder.addMultiSelect({
      path: 'valueFields',
      name: 'Colour fields',
      description:
        'Fields giving the colour, in order: each device takes the first one with a value, for instance temperature for servers and current for PDUs. Each field keeps its own thresholds and unit with an override "Fields with name". Empty: the value column.',
      category: DATA,
      defaultValue: DEFAULT_OPTIONS.valueFields,
      settings: {
        allowCustomValue: true,
        options: [],
        getOptions: (context) => fieldNamesOf(context.data) as unknown as Promise<Array<SelectableValue<string[]>>>,
      },
    });
    // The value column is replaced by the colour fields above.
    for (const column of COLUMNS.filter((c) => c !== 'value')) {
      builder.addFieldNamePicker({
        path: `columns.${column}`,
        name: column,
        description: COLUMN_HELP[column],
        category: COLUMN_MAPPING,
        settings: { placeholderText: `${column} (default)` },
      });
    }
    return builder
      .addStringArray({
        path: 'racks',
        name: 'Racks',
        description:
          'Racks to show, in this order, by id or name. Variables allowed, multi-value included. Empty: all.',
        category: DISPLAY,
        defaultValue: DEFAULT_OPTIONS.racks,
      })
      .addRadio({
        path: 'face',
        name: 'Face',
        category: DISPLAY,
        defaultValue: DEFAULT_OPTIONS.face,
        settings: {
          options: [
            { value: 'front', label: 'Front' },
            { value: 'rear', label: 'Rear' },
            { value: 'both', label: 'Both' },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'autoUnitHeight',
        name: 'Auto unit height',
        description: 'The tallest rack fills the panel height; the racks scroll sideways if they are too wide.',
        category: DISPLAY,
        defaultValue: DEFAULT_OPTIONS.autoUnitHeight,
        showIf: (o) => !o.fitToPanel,
      })
      .addNumberInput({
        path: 'unitHeight',
        name: 'Unit height',
        description: 'Height of one rack unit, in pixels. Labels are hidden below 10.',
        category: DISPLAY,
        defaultValue: DEFAULT_OPTIONS.unitHeight,
        settings: { min: 4, max: 60, integer: true },
        showIf: (o) => o.fitToPanel || !o.autoUnitHeight,
      })
      .addBooleanSwitch({
        path: 'fitToPanel',
        name: 'Fit to panel',
        description: 'Scale the racks to the panel size instead of scrolling.',
        category: DISPLAY,
        defaultValue: DEFAULT_OPTIONS.fitToPanel,
      })
      .addBooleanSwitch({
        path: 'showZeroU',
        name: 'Show 0U band',
        description: 'Devices without position, such as PDUs, in a band right of the rack.',
        category: DISPLAY,
        defaultValue: DEFAULT_OPTIONS.showZeroU,
      })
      .addBooleanSwitch({
        path: 'showUnitNumbers',
        name: 'Show unit numbers',
        category: DISPLAY,
        defaultValue: DEFAULT_OPTIONS.showUnitNumbers,
      })
      .addBooleanSwitch({
        path: 'showRackSummary',
        name: 'Show free units',
        description: 'Number of free units of the face under the rack name.',
        category: DISPLAY,
        defaultValue: DEFAULT_OPTIONS.showRackSummary,
      })
      .addBooleanSwitch({
        path: 'showLegend',
        name: 'Show legend',
        description: 'Devices in service, out of service and not monitored, and active alerts, at the bottom.',
        category: DISPLAY,
        defaultValue: DEFAULT_OPTIONS.showLegend,
      })
      .addMultiSelect({
        path: 'label',
        name: 'Label',
        description: 'Parts of the device label, in the order picked, on one line.',
        category: LABELS,
        defaultValue: DEFAULT_OPTIONS.label,
        // addMultiSelect types its options with the type of the whole value, an array, not of one item.
        settings: { options: LABEL_PARTS as unknown as Array<SelectableValue<LabelPart[]>> },
      })
      .addTextInput({
        path: 'labelSeparator',
        name: 'Separator',
        category: LABELS,
        defaultValue: DEFAULT_OPTIONS.labelSeparator,
      })
      .addMultiSelect({
        path: 'roles',
        name: 'Role filter',
        description:
          'Devices of other roles are faded and inert, the racks keep their shape. Type a variable such as $role to follow the dashboard. Empty: all.',
        category: INTERACTIONS,
        defaultValue: DEFAULT_OPTIONS.roles,
        settings: {
          allowCustomValue: true,
          options: [],
          // Same typing quirk as the label parts.
          getOptions: (context) =>
            rolesOf(context.data, context.options?.columns?.role) as unknown as Promise<
              Array<SelectableValue<string[]>>
            >,
        },
      })
      .addTextInput({
        path: 'highlightVariable',
        name: 'Highlight variable',
        description:
          'Dashboard variable holding device names, written with its $ so that the panel follows its changes: those devices get a thick border and the others fade, for instance when arriving from an alert with var-device=<name>. Nothing happens if the dashboard has no such variable.',
        category: INTERACTIONS,
        defaultValue: DEFAULT_OPTIONS.highlightVariable,
      })
      .addBooleanSwitch({
        path: 'showTooltip',
        name: 'Tooltip',
        description: 'Device card on hover: inventory, state, value, extra columns, alerts and child devices.',
        category: INTERACTIONS,
        defaultValue: DEFAULT_OPTIONS.showTooltip,
      });
  })
  // Offered in the visualization picker when a frame has rack and position columns.
  .setSuggestionsSupplier((summary) => {
    const fits = summary.rawFrames?.some((f) => findField(f, 'rack') && findField(f, 'position'));
    return fits ? [{ name: 'Rack elevation', score: VisualizationSuggestionScore.Good }] : undefined;
  });
