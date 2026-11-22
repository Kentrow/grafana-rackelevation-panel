import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import {
  FRAME,
  freeUnits,
  HEADER_HEIGHT,
  labelFontSize,
  Overflow,
  RackGeometry,
  truncate,
  unitNumberAt,
  ZERO_U_GAP,
} from '../layout/geometry';
import { rackHealth } from '../layout/health';
import { Device, Face, RackLayout } from '../types';
import { DeviceLook } from './deviceLook';
import { DeviceColors, DeviceRect, Emphasis, HatchIds } from './DeviceRect';

interface Props {
  layout: RackLayout;
  face: Face;
  geometry: RackGeometry;
  overflow: Overflow;
  /** Second header line after the site, such as the face when both are shown. */
  caption?: string;
  looks: Map<Device, DeviceLook>;
  label: (device: Device, look: DeviceLook | undefined) => string;
  theme: GrafanaTheme2;
  hatch: HatchIds;
  /** Highlight and role filter of each device. */
  emphasis: (device: Device) => Emphasis | undefined;
  /** Free units of the face after the site. */
  showSummary?: boolean;
  /** Worst device state and active alerts next to the rack name. */
  showState?: boolean;
  /** The racks frame has data links for this rack: its name opens them. */
  hasLinks?: boolean;
  /** Scale of the drawing on screen, below 1 when fitted to a small panel: labels follow the unit height on screen. */
  scale?: number;
}

type Placement = Omit<
  React.ComponentProps<typeof DeviceRect>,
  'device' | 'look' | 'label' | 'hatch' | 'colors' | 'emphasis'
>;

/**
 * One face of one rack, drawn from its top left corner: name and site, unit numbers, frame, free units, devices and
 * the 0U band. It knows nothing of where it is placed, so that a room view can reuse it.
 */
export const Rack = ({
  layout,
  face,
  geometry,
  overflow,
  caption,
  looks,
  label,
  theme,
  hatch,
  emphasis,
  showSummary = false,
  showState = false,
  hasLinks = false,
  scale = 1,
}: Props) => {
  const { rack } = layout;
  const { unitHeight: u, numbersWidth, innerWidth, zeroUWidth } = geometry;
  const slotsX = numbersWidth + FRAME;
  const frameY = HEADER_HEIGHT + overflow.above * u;
  const slotsY = frameY + FRAME;
  const slotsHeight = rack.uHeight * u;
  const numberSize = Math.min(10, Math.max(6, Math.round(u * 0.6)));
  const free = freeUnits(layout, face);
  // Slots of the devices drawn at the edge of an overflow zone, far from their units: their numbers would be wrong.
  const clampedSlots = new Set(
    layout[face]
      .filter((p) => p.clamped)
      .flatMap((p) => Array.from({ length: Math.ceil(p.device.uHeight) }, (_, i) => Math.floor(p.top) + i))
  );
  const subtitle = truncate(
    [rack.site, caption, showSummary ? `${free} U free` : undefined].filter(Boolean).join(' · '),
    innerWidth + 2 * FRAME + zeroUWidth,
    11
  );
  // As in the legend: devices out of the role filter, and those of a hidden 0U band, do not count.
  const health = rackHealth(layout, (d) => emphasis(d) !== 'filtered' && (zeroUWidth > 0 || !layout.zeroU.includes(d)));
  const stateColor = {
    down: theme.colors.error.main,
    up: theme.colors.success.main,
    unknown: theme.colors.text.disabled,
  };
  const showDot = showState && health.state !== undefined;
  const showAlerts = showState && health.alerts > 0;
  // Room taken by the dot and the alert count, in characters of the title.
  const extra = (showDot ? 2 : 0) + (showAlerts ? String(health.alerts).length + 2 : 0);
  const title = truncate(rack.name, innerWidth + 2 * FRAME + zeroUWidth - extra * 13 * 0.58, 13);
  const warning = theme.colors.warning.main;
  const colors: DeviceColors = {
    warning,
    critical: theme.colors.error.main,
    highlight: theme.colors.primary.main,
    badgeText: theme.colors.getContrastText(warning),
    badgeRing: theme.colors.background.primary,
  };
  const fontSize = (uHeight: number) => (labelFontSize(u * scale, uHeight) > 0 ? labelFontSize(u, uHeight) : 0);
  // Free units: one background and one path for all the separators, not one element per unit.
  const separators = Array.from({ length: rack.uHeight - 1 }, (_, i) => `M0 ${(i + 1) * u}H${innerWidth}`).join('');

  const draw = (device: Device, placement: Placement) => {
    const look = looks.get(device);
    return look ? (
      <DeviceRect
        key={`${device.name}-${placement.back ?? false}`}
        device={device}
        look={look}
        label={label(device, look)}
        hatch={hatch}
        colors={colors}
        emphasis={emphasis(device)}
        {...placement}
      />
    ) : null;
  };

  return (
    <g data-testid={`rack-${rack.id}`} data-face={face}>
      <g
        data-testid="rack-header"
        data-rack={hasLinks ? rack.id : undefined}
        tabIndex={hasLinks ? 0 : undefined}
        role={hasLinks ? 'button' : undefined}
        aria-label={hasLinks ? `Links of rack ${rack.name}` : undefined}
      >
        <title>
          {[
            rack.name,
            rack.site,
            `${free} U free of ${rack.uHeight}`,
            health.down > 0 ? `${health.down} device${health.down > 1 ? 's' : ''} out of service` : undefined,
            health.alerts > 0 ? `${health.alerts} active alert${health.alerts > 1 ? 's' : ''}` : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
        </title>
        <text
          x={slotsX + innerWidth / 2}
          y={14}
          textAnchor="middle"
          fontSize={13}
          fontWeight={500}
          fill={hasLinks ? theme.colors.text.link : theme.colors.text.primary}
          textDecoration={hasLinks ? 'underline' : undefined}
        >
          {showDot && health.state && (
            <tspan
              data-testid="rack-state"
              data-state={health.state}
              fill={stateColor[health.state]}
              textDecoration="none"
            >
              {'● '}
            </tspan>
          )}
          {title}
          {showAlerts && (
            <tspan
              data-testid="rack-alerts"
              fill={health.critical ? theme.colors.error.main : theme.colors.warning.main}
              textDecoration="none"
            >
              {` ▲${health.alerts}`}
            </tspan>
          )}
        </text>
        {subtitle && (
          <text
            data-testid="rack-subtitle"
            x={slotsX + innerWidth / 2}
            y={29}
            textAnchor="middle"
            fontSize={11}
            fill={theme.colors.text.secondary}
          >
            {subtitle}
          </text>
        )}
      </g>
      {/* Overflow zones: where devices outside the rack are drawn, straddling the frame. */}
      {overflow.above > 0 && (
        <rect
          x={slotsX}
          y={slotsY - overflow.above * u}
          width={innerWidth}
          height={overflow.above * u}
          fill="none"
          stroke={warning}
          strokeDasharray="4 3"
        />
      )}
      {overflow.below > 0 && (
        <rect
          x={slotsX}
          y={slotsY + slotsHeight}
          width={innerWidth}
          height={overflow.below * u}
          fill="none"
          stroke={warning}
          strokeDasharray="4 3"
        />
      )}
      <rect
        x={numbersWidth}
        y={frameY}
        width={innerWidth + 2 * FRAME}
        height={slotsHeight + 2 * FRAME}
        rx={3}
        fill={theme.colors.background.primary}
        stroke={theme.colors.border.strong}
      />
      {numbersWidth > 0 && (
        <g data-testid="unit-numbers" fontSize={numberSize} fill={theme.colors.text.secondary} textAnchor="end">
          {Array.from({ length: rack.uHeight }, (_, slot) => (
            <text key={slot} x={numbersWidth - 4} y={slotsY + (slot + 0.5) * u} dominantBaseline="central">
              {unitNumberAt(rack, slot)}
            </text>
          ))}
        </g>
      )}
      {numbersWidth > 0 && overflow.above + overflow.below > 0 && (
        <g data-testid="overflow-numbers" fontSize={numberSize} fill={warning} textAnchor="end">
          {[
            ...Array.from({ length: overflow.above }, (_, i) => -1 - i),
            ...Array.from({ length: overflow.below }, (_, i) => rack.uHeight + i),
          ]
            .filter((slot) => !clampedSlots.has(slot))
            .map((slot) => (
              <text key={slot} x={numbersWidth - 4} y={slotsY + (slot + 0.5) * u} dominantBaseline="central">
                {unitNumberAt(rack, slot)}
              </text>
            ))}
        </g>
      )}
      <g transform={`translate(${slotsX}, ${slotsY})`}>
        <rect width={innerWidth} height={slotsHeight} fill={theme.colors.background.canvas} />
        <path d={separators} stroke={theme.colors.border.weak} strokeWidth={0.5} />
        {layout[face].map((p) =>
          draw(p.device, {
            face,
            // The flagged device of an overlap takes the right half, so that both stay visible.
            x: p.conflict === 'overlap' ? innerWidth / 2 : 1,
            y: p.top * u + 1,
            width: p.conflict === 'overlap' ? innerWidth / 2 - 1 : innerWidth - 2,
            height: p.device.uHeight * u - 2,
            fontSize: fontSize(p.device.uHeight),
            back: p.back,
            conflict: p.conflict,
          })
        )}
      </g>
      {zeroUWidth > 0 && (
        <g data-testid="zero-u-band" transform={`translate(${slotsX + innerWidth + FRAME + ZERO_U_GAP}, ${slotsY})`}>
          <rect
            width={zeroUWidth - ZERO_U_GAP}
            height={slotsHeight}
            rx={2}
            fill={theme.colors.background.canvas}
            stroke={theme.colors.border.weak}
          />
          {layout.zeroU.map((device, i) => {
            const height = slotsHeight / layout.zeroU.length;
            return draw(device, {
              face,
              x: 1,
              y: i * height + 1,
              width: zeroUWidth - ZERO_U_GAP - 2,
              height: height - 2,
              fontSize: fontSize(1),
              // A 0U device hangs on one face, like a PDU on the rear rails.
              back: device.face !== face,
              vertical: true,
            });
          })}
        </g>
      )}
    </g>
  );
};
