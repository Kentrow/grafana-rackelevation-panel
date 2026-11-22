import React, { useId, useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { ContextMenu, linkModelToContextMenuItems, MenuItem, useStyles2, useTheme2 } from '@grafana/ui';
import { DEFAULT_OPTIONS, RackElevationOptions } from '../types';
import { ClearHighlight } from './ClearHighlight';
import { DeviceTooltip } from './DeviceTooltip';
import { ErrorIndicator } from './ErrorIndicator';
import { Legend, LEGEND_HEIGHT } from './Legend';
import { hasLinks, rackLinks } from './links';
import { RackDrawing } from './RackDrawing';
import { useEmphasis } from './useEmphasis';
import { TOOLTIP_OFFSET, useRackInteractions } from './useRackInteractions';
import { useRackModel } from './useRackModel';
import { resolveList, variableValues } from './variables';

export { resolveList } from './variables';

type Props = PanelProps<RackElevationOptions>;

const CLEAR_BAR_HEIGHT = 30;

/**
 * The panel: the racks drawn from the data, with the bar of the highlight above them, the legend below, the card and
 * the menu of the links on top, and the problems in the corner.
 */
export const RackPanel = ({ data, options: saved, width, height, fieldConfig, id, replaceVariables }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const uid = useId().replace(/:/g, '');
  const options = { ...DEFAULT_OPTIONS, ...saved };
  const { columns, valueFields, showZeroU, showLegend, showTooltip } = options;
  // Lists resolved from variables are compared as strings, so that memoization survives a re-render.
  const racksKey = resolveList(options.racks, replaceVariables).join('\n');
  const rolesKey = resolveList(options.roles, replaceVariables)
    .map((r) => r.toLowerCase())
    .join('\n');
  const highlightKey = variableValues(options.highlightVariable, replaceVariables).join('\n');
  // Units of a new device, typed or from a variable such as $space; anything else turns the free blocks off.
  const freeSpaceUnits = parseFloat(replaceVariables(options.freeSpace ?? '')) || 0;

  const { model, devices, zeroU, looks, labelOf } = useRackModel(data.series, options, racksKey, theme);
  const { highlighted, emphasis, legendDevices } = useEmphasis(devices, highlightKey, rolesKey, zeroU, showZeroU);
  const linkDefaults = fieldConfig.defaults.links;
  const { wrapperRef, scrollerRef, cardRef, hovered, menu, closeMenu, ...handlers } = useRackInteractions({
    model,
    devices,
    columns,
    linkDefaults,
    showTooltip,
    width,
    height,
  });
  // Devices with links are buttons; without, they still take the focus to show their card.
  const keyboardRole = hasLinks(model.devicesFrame) ? 'button' : showTooltip ? 'img' : undefined;
  const racksWithLinks = useMemo(
    () =>
      new Set(
        model.racks
          .filter((r) => rackLinks(model.racksFrame, r.rack.row, linkDefaults).length > 0)
          .map((r) => r.rack.id)
      ),
    [model, linkDefaults]
  );
  // Ids of the hatch patterns, the same object for every render so that the memoized devices are not drawn again.
  const hatch = useMemo(() => ({ unmonitored: `rack-unmonitored-${uid}`, conflict: `rack-conflict-${uid}` }), [uid]);

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }
  if (model.racks.length === 0) {
    // Data that does not follow the contract: say what is expected instead of an empty panel.
    return (
      <div className={styles.empty} style={{ width, height }} data-testid="rack-empty">
        <strong>No rack to draw</strong>
        {model.errors.slice(0, 3).map((e, i) => (
          <div key={i}>{e.message}</div>
        ))}
        <div className={styles.hint}>
          Expected a table with one row per device and at least device and rack columns, plus position and u_height to
          place them. Columns can be mapped in the Columns options.
        </div>
      </div>
    );
  }

  // The clear button sits in a bar above the racks while devices are highlighted, and the legend below them: never
  // over them.
  const drawHeight = height - (highlighted.length > 0 ? CLEAR_BAR_HEIGHT : 0) - (showLegend ? LEGEND_HEIGHT : 0);
  return (
    <div ref={wrapperRef} className={styles.wrapper} style={{ width, height }} data-testid="rack-panel">
      {highlighted.length > 0 && (
        <div className={styles.bar} style={{ height: CLEAR_BAR_HEIGHT }}>
          <ClearHighlight variable={options.highlightVariable} highlighted={highlighted} />
        </div>
      )}
      <div
        className={cx(styles.scroll, styles.focus, hasLinks(model.devicesFrame) && styles.clickable)}
        style={{ height: drawHeight, overflow: options.fitToPanel ? 'hidden' : 'auto' }}
        ref={scrollerRef}
        {...handlers}
      >
        <RackDrawing
          racks={model.racks}
          face={options.face}
          looks={looks}
          label={labelOf}
          emphasis={emphasis}
          theme={theme}
          hatch={hatch}
          unitHeight={options.unitHeight}
          autoUnitHeight={options.autoUnitHeight}
          fitToPanel={options.fitToPanel}
          showUnitNumbers={options.showUnitNumbers}
          showZeroU={showZeroU}
          showRackSummary={options.showRackSummary}
          showRackState={options.showRackState}
          freeSpaceUnits={freeSpaceUnits}
          freeSpaceFullDepth={options.freeSpaceFullDepth}
          keyboard={keyboardRole}
          racksWithLinks={racksWithLinks}
          width={width}
          height={drawHeight}
        />
      </div>
      {hovered && (
        <div
          ref={cardRef}
          className={styles.tooltip}
          style={{
            maxWidth: Math.min(360, width - 2 * TOOLTIP_OFFSET),
            maxHeight: height - 2 * TOOLTIP_OFFSET,
          }}
        >
          <DeviceTooltip
            device={hovered.device}
            rack={hovered.rack}
            look={looks.get(hovered.device)}
            frame={model.devicesFrame}
            columns={columns}
            valueFields={valueFields}
          />
        </div>
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          renderMenuItems={() =>
            linkModelToContextMenuItems(() => menu.links).map((item, i) => <MenuItem key={i} {...item} />)
          }
        />
      )}
      {showLegend && <Legend devices={legendDevices} />}
      <ErrorIndicator errors={model.errors} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
  }),
  scroll: css({
    width: '100%',
  }),
  bar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  clickable: css({
    '[data-device]': { cursor: 'pointer' },
  }),
  focus: css({
    '[data-rack]': { cursor: 'pointer' },
    '[data-device]:focus, [data-rack]:focus': { outline: 'none' },
    '[data-device]:focus-visible, [data-rack]:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: 1,
    },
    // Firefox draws no outline around SVG groups: the focused device gets a thick border, in the text colour so that
    // it differs from the highlight, and the focused rack name an outline of its letters.
    '[data-device]:focus-visible > rect:first-of-type': {
      stroke: theme.colors.text.primary,
      strokeWidth: 3,
    },
    '[data-rack]:focus-visible > text:first-of-type': {
      stroke: theme.colors.primary.main,
      strokeWidth: 0.6,
    },
  }),
  empty: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.colors.text.secondary,
  }),
  hint: css({
    maxWidth: 480,
    marginTop: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  tooltip: css({
    position: 'absolute',
    zIndex: theme.zIndex.tooltip,
    overflow: 'hidden',
    pointerEvents: 'none',
    padding: theme.spacing(1),
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
