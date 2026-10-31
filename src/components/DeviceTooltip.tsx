import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { extraFields, toText } from '../data/mapping';
import { unitRange } from '../layout/errors';
import { ColumnMapping, Device, Rack } from '../types';
import { DeviceLook } from './deviceLook';

interface Props {
  device: Device;
  rack: Rack;
  look?: DeviceLook;
  frame?: DataFrame;
  columns: ColumnMapping;
  valueFields: string[];
}

const STATES = { up: 'In service', down: 'Out of service', unknown: 'Not monitored' };

/**
 * Fields of the devices frame that no column uses, as name and text for one row. Their values are shown as they are:
 * the unit of the field config is meant for the colour field, not for a serial number or a port count.
 */
function extraValues(
  frame: DataFrame | undefined,
  columns: ColumnMapping,
  valueFields: string[],
  row: number
): Array<[string, string]> {
  if (!frame) {
    return [];
  }
  return extraFields(frame, columns, valueFields).flatMap((field): Array<[string, string]> => {
    const text = toText(field.values[row]);
    if (text === undefined) {
      return [];
    }
    return [[field.config.displayName || field.name, text]];
  });
}

/** Device card shown on hover. */
export const DeviceTooltip = ({ device, rack, look, frame, columns, valueFields }: Props) => {
  const styles = useStyles2(getStyles);
  const units =
    device.position === undefined || device.uHeight <= 0
      ? '0U'
      : unitRange(device.position, device.position + device.uHeight - 1);
  const rows: Array<[string, string | undefined]> = [
    ['Model', device.model],
    ['Role', device.role],
    ['Rack', rack.name],
    ['Units', units],
    ['Face', `${device.face}${device.fullDepth ? ', full depth' : ''}`],
    ['Value', look?.valueText],
    ...extraValues(frame, columns, valueFields, device.row),
  ];
  return (
    <div data-testid="device-tooltip">
      <div className={styles.header}>
        <strong>{device.name}</strong>
        <span className={styles.state[device.state]}>{STATES[device.state]}</span>
      </div>
      <table className={styles.table}>
        <tbody>
          {rows
            .filter(([, value]) => value !== undefined && value !== '')
            .map(([name, value]) => (
              <tr key={name}>
                <th>{name}</th>
                <td>{value}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {device.alerts.length > 0 && (
        <div className={styles.section} data-testid="device-tooltip-alerts">
          <div className={styles.title}>Active alerts</div>
          {device.alerts.map((a, i) => (
            <div key={i}>
              {a.name ?? 'Alert'}
              {a.severity && <span className={styles.muted}> · {a.severity}</span>}
            </div>
          ))}
        </div>
      )}
      {device.children.length > 0 && (
        <div className={styles.section} data-testid="device-tooltip-children">
          <div className={styles.title}>Child devices</div>
          {device.children.map((c) => (
            <div key={c.name}>
              {c.name}
              <span className={styles.muted}>{[c.model, STATES[c.state]].filter(Boolean).map((t) => ` · ${t}`)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
  }),
  state: {
    up: css({ color: theme.colors.success.text }),
    down: css({ color: theme.colors.error.text }),
    unknown: css({ color: theme.colors.text.secondary }),
  },
  table: css({
    borderCollapse: 'collapse',
    th: {
      fontWeight: theme.typography.fontWeightRegular,
      color: theme.colors.text.secondary,
      paddingRight: theme.spacing(1.5),
      textAlign: 'left',
      verticalAlign: 'top',
      whiteSpace: 'nowrap',
    },
    td: { wordBreak: 'break-word' },
  }),
  section: css({
    marginTop: theme.spacing(0.75),
    paddingTop: theme.spacing(0.75),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  title: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(0.25),
  }),
  muted: css({ color: theme.colors.text.secondary }),
});
