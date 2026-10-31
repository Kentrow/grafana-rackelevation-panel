import React from 'react';
import { truncate } from '../layout/geometry';
import { Conflict, Device, Face } from '../types';
import { DeviceLook } from './deviceLook';

export interface HatchIds {
  unmonitored: string;
  conflict: string;
}

/** Theme colours shared by every device, resolved once per panel. */
export interface DeviceColors {
  warning: string;
  critical: string;
  highlight: string;
  badgeText: string;
  /** Ring around the badge, so that it stands out on a fill of the same colour. */
  badgeRing: string;
}

/** highlight: the device of the highlight variable; dim: another device while one is highlighted; filtered: role out of the filter. */
export type Emphasis = 'highlight' | 'dim' | 'filtered';

interface Props {
  device: Device;
  look: DeviceLook;
  label: string;
  face: Face;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  /** Seen from the opposite face: dimmed. */
  back?: boolean;
  conflict?: Conflict;
  emphasis?: Emphasis;
  /** Label written bottom to top, for the 0U band. */
  vertical?: boolean;
  hatch: HatchIds;
  colors: DeviceColors;
}

const PADDING = 4;

/**
 * One device: a rectangle with its state border, a one-line label, the active alerts badge and a native title as
 * fallback. data-device lets the panel find the device under the pointer without a handler per device.
 */
export const DeviceRect = React.memo(
  ({
    device,
    look,
    label,
    face,
    x,
    y,
    width,
    height,
    fontSize,
    back,
    conflict,
    emphasis,
    vertical,
    hatch,
    colors,
  }: Props) => {
    const alerts = device.alerts.length;
    const badge = alerts > 0 ? Math.max(5, Math.min(7, height / 2 - 1)) : 0;
    const length = (vertical ? height : width) - (badge ? 2 * badge + 2 : 0);
    const text = fontSize > 0 ? truncate(label, length - 2 * PADDING, fontSize) : '';
    const title = [
      device.name,
      device.model,
      look.valueText,
      device.state === 'unknown' ? 'not monitored' : device.state,
      conflict,
    ]
      .filter(Boolean)
      .join(' · ');
    const faded = emphasis === 'dim' || emphasis === 'filtered';
    const critical = device.alerts.some((a) => a.severity?.toLowerCase() === 'critical');
    return (
      <g
        data-testid={`device-${device.name}`}
        data-device={emphasis === 'filtered' ? undefined : device.name}
        data-state={device.state}
        data-face={face}
        data-conflict={conflict}
        data-emphasis={emphasis}
        // Keyboard: Tab goes from device to device, the panel shows the card on focus and opens the links on Enter.
        tabIndex={emphasis === 'filtered' ? undefined : 0}
        role="button"
        aria-label={title}
        opacity={(back ? 0.45 : 1) * (faded ? 0.3 : 1)}
        pointerEvents={emphasis === 'filtered' ? 'none' : undefined}
      >
        <title>{title}</title>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={2}
          fill={look.fill}
          stroke={emphasis === 'highlight' ? colors.highlight : look.stroke}
          strokeWidth={emphasis === 'highlight' ? 3 : look.strokeWidth}
        />
        {look.hatched && <rect x={x} y={y} width={width} height={height} rx={2} fill={`url(#${hatch.unmonitored})`} />}
        {conflict && (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={2}
            fill={`url(#${hatch.conflict})`}
            stroke={colors.warning}
            strokeWidth={2}
            strokeDasharray={conflict === 'overflow' ? '4 2' : undefined}
          />
        )}
        {text && (
          <text
            x={vertical ? 0 : x + PADDING}
            y={vertical ? 0 : y + height / 2}
            transform={vertical ? `translate(${x + width / 2}, ${y + height - PADDING}) rotate(-90)` : undefined}
            dominantBaseline="central"
            fontSize={fontSize}
            fill={look.textColor}
            pointerEvents="none"
            textDecoration={look.strike ? 'line-through' : undefined}
          >
            {text}
          </text>
        )}
        {badge > 0 && (
          <g data-testid="alert-badge" data-count={alerts} pointerEvents="none">
            <circle
              cx={vertical ? x + width / 2 : x + width - badge - 2}
              cy={y + badge + 1}
              r={badge}
              fill={critical ? colors.critical : colors.warning}
              stroke={colors.badgeRing}
              strokeWidth={1.5}
            />
            <text
              x={vertical ? x + width / 2 : x + width - badge - 2}
              y={y + badge + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={badge * 1.3}
              fontWeight={600}
              fill={colors.badgeText}
            >
              {alerts > 9 ? '9+' : alerts}
            </text>
          </g>
        )}
      </g>
    );
  }
);
DeviceRect.displayName = 'DeviceRect';
