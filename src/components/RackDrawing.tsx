import React, { useLayoutEffect, useRef } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { autoUnitHeight as fittingUnitHeight, panelGeometry } from '../layout/geometry';
import { Device, FaceOption, RackLayout } from '../types';
import { DeviceLook } from './deviceLook';
import { Emphasis, HatchIds, KeyboardRole } from './DeviceRect';
import { ensureTabStop } from './keyboard';
import { Rack } from './Rack';

interface Props {
  racks: RackLayout[];
  face: FaceOption;
  looks: Map<Device, DeviceLook>;
  label: (device: Device, look: DeviceLook | undefined) => string;
  emphasis: (device: Device) => Emphasis | undefined;
  theme: GrafanaTheme2;
  hatch: HatchIds;
  /** Unit height when the auto unit height is off. */
  unitHeight: number;
  autoUnitHeight: boolean;
  fitToPanel: boolean;
  showUnitNumbers: boolean;
  showZeroU: boolean;
  showRackSummary: boolean;
  showRackState: boolean;
  /** Units of a new device whose free blocks are outlined; 0: none. */
  freeSpaceUnits: number;
  freeSpaceFullDepth: boolean;
  keyboard?: KeyboardRole;
  racksWithLinks: Set<string>;
  width: number;
  height: number;
}

/**
 * The racks, side by side. Memoized: it only depends on the data, the options, the variables and the theme, so that
 * hovering and the keyboard never draw it again.
 */
export const RackDrawing = React.memo((props: Props) => {
  const { racks, face, theme, hatch, fitToPanel, width, height } = props;
  const styles = useStyles2(getStyles);
  const svg = useRef<SVGSVGElement>(null);
  // The devices are one stop in the tab order: keep one after each drawing, the last focused device or the top one
  // of the first rack.
  useLayoutEffect(() => {
    if (svg.current) {
      ensureTabStop(svg.current);
    }
  });

  const unitHeight = props.autoUnitHeight && !fitToPanel ? fittingUnitHeight(racks, height) : props.unitHeight;
  const {
    views,
    width: contentWidth,
    height: contentHeight,
  } = panelGeometry(racks, face, unitHeight, props.showUnitNumbers, props.showZeroU);
  const size = fitToPanel
    ? { width, height, viewBox: `0 0 ${contentWidth} ${contentHeight}` }
    : { width: contentWidth, height: contentHeight };
  const scale = fitToPanel && contentWidth > 0 ? Math.min(width / contentWidth, height / contentHeight) : 1;
  const freeSpace =
    props.freeSpaceUnits > 0 ? { units: props.freeSpaceUnits, fullDepth: props.freeSpaceFullDepth } : undefined;

  return (
    <svg ref={svg} {...size} className={styles.svg} fontFamily={theme.typography.fontFamily} data-testid="rack-svg">
      <defs>
        <pattern
          id={hatch.unmonitored}
          patternUnits="userSpaceOnUse"
          width={6}
          height={6}
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={6} stroke={theme.colors.border.medium} strokeWidth={2} />
        </pattern>
        <pattern id={hatch.conflict} patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(-45)">
          <line x1={0} y1={0} x2={0} y2={8} stroke={theme.colors.warning.main} strokeWidth={3} />
        </pattern>
      </defs>
      {views.map((view) => (
        <g key={`${view.layout.rack.id}-${view.face}`} transform={`translate(${view.x}, ${view.y})`}>
          <Rack
            layout={view.layout}
            face={view.face}
            geometry={view.geometry}
            overflow={view.overflow}
            caption={face === 'both' ? (view.face === 'front' ? 'Front' : 'Rear') : undefined}
            looks={props.looks}
            label={props.label}
            theme={theme}
            hatch={hatch}
            emphasis={props.emphasis}
            showSummary={props.showRackSummary}
            showState={props.showRackState}
            freeSpace={freeSpace}
            keyboard={props.keyboard}
            hasLinks={props.racksWithLinks.has(view.layout.rack.id)}
            scale={scale}
          />
        </g>
      ))}
    </svg>
  );
});
RackDrawing.displayName = 'RackDrawing';

const getStyles = () => ({
  svg: css({
    display: 'block',
    // Centred when it fits, scrolled from the left when it does not.
    margin: '0 auto',
    userSelect: 'none',
  }),
});
