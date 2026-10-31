import React from 'react';
import { StandardEditorProps } from '@grafana/data';
import { Combobox, ComboboxOption } from '@grafana/ui';
import { RackElevationOptions } from '../types';

/** Picks a frame of the panel data by refId or name; empty means found by its columns. */
export const FrameSelect = ({
  value,
  onChange,
  context,
}: StandardEditorProps<string | undefined, unknown, RackElevationOptions>) => {
  const options: Array<ComboboxOption<string>> = [];
  for (const frame of context.data ?? []) {
    const key = frame.refId || frame.name;
    if (key && !options.some((o) => o.value === key)) {
      options.push({
        value: key,
        label: frame.name && frame.name !== key ? `${key} (${frame.name})` : key,
        description: frame.fields
          .map((f) => f.name)
          .slice(0, 8)
          .join(', '),
      });
    }
  }
  return (
    <Combobox
      options={options}
      value={value || null}
      placeholder="auto"
      isClearable
      createCustomValue
      onChange={(option) => onChange(option?.value || undefined)}
    />
  );
};
