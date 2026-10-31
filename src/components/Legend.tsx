import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { Device } from '../types';

export const LEGEND_HEIGHT = 24;

interface Props {
  /** Devices drawn in the panel and not out of the role filter. */
  devices: Device[];
}

/**
 * Device counts by state, with the categories of the drawing: a device with a value but no status is drawn as in
 * service, so it counts as such.
 */
export function legendCounts(devices: Device[]) {
  const counts = { up: 0, down: 0, unknown: 0, alerts: 0 };
  for (const d of devices) {
    counts[d.state === 'unknown' && d.value !== undefined ? 'up' : d.state]++;
    counts.alerts += d.alerts.length;
  }
  return counts;
}

/** One line at the bottom of the panel, to read the state of the racks before looking at them one by one. */
export const Legend = ({ devices }: Props) => {
  const styles = useStyles2(getStyles);
  const { up, down, unknown, alerts } = legendCounts(devices);
  return (
    <div className={styles.legend} style={{ height: LEGEND_HEIGHT }} data-testid="rack-legend">
      <span>
        <i className={`${styles.dot} ${styles.up}`} />
        {up} in service
      </span>
      <span>
        <i className={`${styles.dot} ${styles.down}`} />
        {down} out of service
      </span>
      <span>
        <i className={`${styles.dot} ${styles.unknown}`} />
        {unknown} not monitored
      </span>
      {alerts > 0 && (
        <span className={styles.alerts}>
          <Icon name="bell" size="sm" />
          {alerts} active {alerts === 1 ? 'alert' : 'alerts'}
        </span>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  legend: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    overflow: 'hidden',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    span: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing(0.5), whiteSpace: 'nowrap' },
  }),
  dot: css({
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: theme.shape.radius.circle,
  }),
  up: css({ background: theme.colors.success.main }),
  down: css({ background: theme.colors.error.main }),
  unknown: css({
    background: `repeating-linear-gradient(45deg, ${theme.colors.border.medium} 0 2px, ${theme.colors.background.secondary} 2px 4px)`,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  alerts: css({ color: theme.colors.warning.text }),
});
