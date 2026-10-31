import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { LayoutError } from '../types';

const MAX_LISTED = 20;

/** Discreet icon in a corner of the panel, the list of data problems on hover. It never blocks the rendering. */
export const ErrorIndicator = ({ errors }: { errors: LayoutError[] }) => {
  const styles = useStyles2(getStyles);
  if (errors.length === 0) {
    return null;
  }
  const content = (
    <div data-testid="rack-errors-list">
      <strong>
        {errors.length} data {errors.length === 1 ? 'problem' : 'problems'}
      </strong>
      <ul className={styles.list}>
        {errors.slice(0, MAX_LISTED).map((e, i) => (
          <li key={i}>{e.message}</li>
        ))}
      </ul>
      {errors.length > MAX_LISTED && <div>and {errors.length - MAX_LISTED} more</div>}
    </div>
  );
  return (
    <Tooltip content={content} placement="bottom-end" interactive>
      <button
        type="button"
        className={styles.button}
        data-testid="rack-errors"
        aria-label={`${errors.length} data problems`}
      >
        <Icon name="exclamation-triangle" />
        <span>{errors.length}</span>
      </button>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    position: 'absolute',
    top: theme.spacing(0.5),
    right: theme.spacing(0.5),
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 0.75),
    border: 'none',
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    color: theme.colors.warning.text,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'default',
  }),
  list: css({
    margin: theme.spacing(0.5, 0, 0),
    paddingLeft: theme.spacing(2),
    maxWidth: 420,
  }),
});
