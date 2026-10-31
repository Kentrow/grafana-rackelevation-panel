import React, { useId, useMemo, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, LinkModel, PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { ContextMenu, linkModelToContextMenuItems, MenuItem, useStyles2, useTheme2 } from '@grafana/ui';
import { autoUnitHeight as fittingUnitHeight, panelGeometry } from '../layout/geometry';
import { buildModel } from '../model';
import { DEFAULT_OPTIONS, Device, Rack as RackModel, RackElevationOptions } from '../types';
import { deviceLabel, deviceLooks } from './deviceLook';
import { ClearHighlight } from './ClearHighlight';
import { DeviceTooltip } from './DeviceTooltip';
import { ErrorIndicator } from './ErrorIndicator';
import { Legend, LEGEND_HEIGHT } from './Legend';
import { deviceLinks, followLink, hasLinks, rackLinks } from './links';
import { Rack } from './Rack';
import { emphasisOf, resolveList, variableValues } from './variables';

export { resolveList } from './variables';

type Props = PanelProps<RackElevationOptions>;

interface Hover {
  device: string;
  /** Pointer position in the panel. */
  x: number;
  y: number;
}

interface Menu {
  x: number;
  y: number;
  links: LinkModel[];
}

const TOOLTIP_OFFSET = 12;
const CLEAR_BAR_HEIGHT = 30;

/** Name of the device under the pointer, from the data-device attribute of its group. */
const deviceAt = (target: EventTarget) => (target as Element).closest?.('[data-device]')?.getAttribute('data-device');

export const RackPanel = ({ data, options: saved, width, height, fieldConfig, id, replaceVariables }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const uid = useId().replace(/:/g, '');
  const wrapper = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const options = { ...DEFAULT_OPTIONS, ...saved };
  const {
    frames,
    columns,
    valueFields,
    upValues,
    face,
    unitHeight,
    autoUnitHeight,
    fitToPanel,
    showZeroU,
    showUnitNumbers,
    showRackSummary,
    showLegend,
    label,
    labelSeparator,
  } = options;
  // Lists resolved from variables are compared as strings, so that memoization survives a re-render.
  const racksKey = resolveList(options.racks, replaceVariables).join('\n');
  const rolesKey = resolveList(options.roles, replaceVariables)
    .map((r) => r.toLowerCase())
    .join('\n');
  const highlightKey = variableValues(options.highlightVariable, replaceVariables).join('\n');

  const model = useMemo(
    () =>
      buildModel(data.series, {
        frames,
        columns,
        valueFields,
        upValues,
        racks: racksKey ? racksKey.split('\n') : [],
      }),
    [data.series, frames, columns, valueFields, upValues, racksKey]
  );
  const devices = useMemo(() => {
    const byName = new Map<string, { device: Device; rack: RackModel }>();
    for (const r of model.racks) {
      for (const device of [...r.front.map((p) => p.device), ...r.rear.map((p) => p.device), ...r.zeroU]) {
        byName.set(device.name, { device, rack: r.rack });
      }
    }
    return byName;
  }, [model]);
  const looks = useMemo(
    () =>
      deviceLooks(
        [...devices.values()].map((d) => d.device),
        model.devicesFrame,
        columns,
        theme
      ),
    [devices, model.devicesFrame, columns, theme]
  );
  // Only the highlighted devices drawn in this panel count: a panel without them is left as it is.
  const highlighted = highlightKey ? highlightKey.split('\n').filter((name) => devices.has(name)) : [];
  const highlightedKey = highlighted.join('\n');
  const emphasis = useMemo(() => {
    const names = new Set(highlightedKey ? highlightedKey.split('\n') : []);
    const roles = new Set(rolesKey ? rolesKey.split('\n') : []);
    return (device: Device) => emphasisOf(device, names, roles);
  }, [highlightedKey, rolesKey]);

  // The clear button sits in a bar above the racks while devices are highlighted, and the legend below them: never
  // over them.
  const drawHeight =
    height - (highlighted.length > 0 ? CLEAR_BAR_HEIGHT : 0) - (showLegend && model.racks.length ? LEGEND_HEIGHT : 0);
  const linkDefaults = fieldConfig.defaults.links;
  const racksWithLinks = useMemo(
    () =>
      new Set(
        model.racks
          .filter((r) => rackLinks(model.racksFrame, r.rack.row, linkDefaults).length > 0)
          .map((r) => r.rack.id)
      ),
    [model, linkDefaults]
  );

  // The SVG only depends on the data, the options, the variables and the theme: hover state stays out of it.
  const svg = useMemo(() => {
    const hatch = { unmonitored: `rack-unmonitored-${uid}`, conflict: `rack-conflict-${uid}` };
    const {
      views,
      width: contentWidth,
      height: contentHeight,
    } = panelGeometry(
      model.racks,
      face,
      autoUnitHeight && !fitToPanel ? fittingUnitHeight(model.racks, drawHeight) : unitHeight,
      showUnitNumbers,
      showZeroU
    );
    const size = fitToPanel
      ? { width, height: drawHeight, viewBox: `0 0 ${contentWidth} ${contentHeight}` }
      : { width: contentWidth, height: contentHeight };
    const scale = fitToPanel && contentWidth > 0 ? Math.min(width / contentWidth, drawHeight / contentHeight) : 1;
    return (
      <svg {...size} className={styles.svg} fontFamily={theme.typography.fontFamily} data-testid="rack-svg">
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
          <pattern
            id={hatch.conflict}
            patternUnits="userSpaceOnUse"
            width={8}
            height={8}
            patternTransform="rotate(-45)"
          >
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
              looks={looks}
              label={(device, look) => deviceLabel(device, look, label, labelSeparator)}
              theme={theme}
              hatch={hatch}
              emphasis={emphasis}
              showSummary={showRackSummary}
              hasLinks={racksWithLinks.has(view.layout.rack.id)}
              scale={scale}
            />
          </g>
        ))}
      </svg>
    );
  }, [
    model,
    looks,
    emphasis,
    face,
    unitHeight,
    autoUnitHeight,
    showUnitNumbers,
    showZeroU,
    showRackSummary,
    racksWithLinks,
    fitToPanel,
    width,
    drawHeight,
    label,
    labelSeparator,
    theme,
    uid,
    styles.svg,
  ]);

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

  const onMouseMove = (event: React.MouseEvent) => {
    const name = deviceAt(event.target);
    if (!name || !options.showTooltip || menu) {
      setHover(null);
      return;
    }
    const box = wrapper.current!.getBoundingClientRect();
    setHover({ device: name, x: event.clientX - box.left, y: event.clientY - box.top });
  };

  /** Links of the device or of the rack name under the pointer or the focus. */
  const linksAt = (target: EventTarget): LinkModel[] => {
    const hit = devices.get(deviceAt(target) ?? '');
    if (hit) {
      return deviceLinks(model.devicesFrame, hit.device.row);
    }
    const rackId = (target as Element).closest?.('[data-rack]')?.getAttribute('data-rack');
    const rack = model.racks.find((r) => r.rack.id === rackId)?.rack;
    return rack ? rackLinks(model.racksFrame, rack.row, linkDefaults) : [];
  };

  const open = (links: LinkModel[], event: React.MouseEvent | React.KeyboardEvent, x: number, y: number) => {
    if (links.length === 1) {
      followLink(links[0], event as React.MouseEvent);
    } else if (links.length > 1) {
      setHover(null);
      setMenu({ x, y, links });
    }
  };

  const onClick = (event: React.MouseEvent) => open(linksAt(event.target), event, event.clientX, event.clientY);

  // Keyboard: the card follows the focus, Enter or Space opens the links, Escape closes the card and the menu.
  const onFocus = (event: React.FocusEvent) => {
    const name = deviceAt(event.target);
    if (!name || !options.showTooltip) {
      return;
    }
    const box = wrapper.current!.getBoundingClientRect();
    const rect = (event.target as Element).getBoundingClientRect();
    setHover({ device: name, x: rect.right - box.left, y: rect.top + rect.height / 2 - box.top });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setHover(null);
      setMenu(null);
    } else if (event.key === 'Enter' || event.key === ' ') {
      const links = linksAt(event.target);
      if (links.length > 0) {
        event.preventDefault();
        const rect = (event.target as Element).getBoundingClientRect();
        open(links, event, rect.left + rect.width / 2, rect.bottom);
      }
    }
  };

  const hovered = hover ? devices.get(hover.device) : undefined;
  return (
    <div ref={wrapper} className={styles.wrapper} style={{ width, height }} data-testid="rack-panel">
      {highlighted.length > 0 && (
        <div className={styles.bar} style={{ height: CLEAR_BAR_HEIGHT }}>
          <ClearHighlight variable={options.highlightVariable} highlighted={highlighted} />
        </div>
      )}
      <div
        className={cx(styles.scroll, styles.focus, hasLinks(model.devicesFrame) && styles.clickable)}
        style={{ height: drawHeight, overflow: fitToPanel ? 'hidden' : 'auto' }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
        onFocus={onFocus}
        onBlur={() => setHover(null)}
        onKeyDown={onKeyDown}
      >
        {svg}
      </div>
      {hover && hovered && (
        <div
          className={styles.tooltip}
          style={{
            ...(hover.x < width / 2 ? { left: hover.x + TOOLTIP_OFFSET } : { right: width - hover.x + TOOLTIP_OFFSET }),
            ...(hover.y < height / 2
              ? { top: hover.y + TOOLTIP_OFFSET }
              : { bottom: height - hover.y + TOOLTIP_OFFSET }),
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
          onClose={() => setMenu(null)}
          renderMenuItems={() =>
            linkModelToContextMenuItems(() => menu.links).map((item, i) => <MenuItem key={i} {...item} />)
          }
        />
      )}
      {showLegend && (
        <Legend devices={[...devices.values()].map((d) => d.device).filter((d) => emphasis(d) !== 'filtered')} />
      )}
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
  }),
  svg: css({
    display: 'block',
    // Centred when it fits, scrolled from the left when it does not.
    margin: '0 auto',
    userSelect: 'none',
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
