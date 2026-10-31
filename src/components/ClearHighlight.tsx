import React from 'react';
import { locationService } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { variableName } from './variables';

interface Props {
  /** Highlight variable, as written in the options. */
  variable: string;
  highlighted: string[];
}

/**
 * Shown while devices are highlighted: empties the highlight variable through the URL, which Grafana applies to the
 * dashboard variable.
 */
export const ClearHighlight = ({ variable, highlighted }: Props) => {
  if (highlighted.length === 0) {
    return null;
  }
  const label = highlighted.length === 1 ? highlighted[0] : `${highlighted.length} devices`;
  return (
    <Button
      size="sm"
      variant="secondary"
      fill="outline"
      icon="times"
      tooltip="Clear the highlight"
      data-testid="clear-highlight"
      onClick={() => locationService.partial({ [`var-${variableName(variable)}`]: '' }, true)}
    >
      {label}
    </Button>
  );
};
