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

/** What a device is for the keyboard: a button when it has links, an image showing its card, or nothing. */
export type KeyboardRole = 'button' | 'img';

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
  keyboard?: KeyboardRole;
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
    keyboard,
  }: Props) => {
    const alerts = device.alerts.length;
    const badge = alerts > 0 ? Math.max(5, Math.min(7, height / 2 - 1)) : 0;
    const length = (vertical ? height : width) - (badge ? 2 * badge + 2 : 0);
    const text = fontSize > 0 ? truncate(label, length - 2 * PADDING, fontSize) : '';
    // The accessible name starts with what is written on the device, its label then the alert count of the badge, so
    // that a voice command naming what the user sees reaches it (WCAG 2.5.3); the other details follow.
    const details = [device.name, device.model, look.valueText].filter((part) => part && !label.includes(part));
    const title = [
      label,
      alerts > 0 ? `${alerts} active alert${alerts > 1 ? 's' : ''}` : undefined,
      ...details,
      device.state === 'unknown' ? 'not monitored' : device.state,
      conflict,
    ]
      .filter(Boolean)
      .join(' · ');
    const faded = emphasis === 'dim' || emphasis === 'filtered';
    const opacity = (back ? 0.45 : 1) * (faded ? 0.3 : 1);
    // The copy seen from the other face is only a reminder of the device: out of the keyboard and screen readers.
    const focusable = keyboard !== undefined && !back && emphasis !== 'filtered';
    const critical = device.alerts.some((a) => a.severity?.toLowerCase() === 'critical');
    return (
      // The badge sits beside the focusable group, not in it: its count is not part of what the label says.
      <g>
        <g
          data-testid={`device-${device.name}`}
          data-device={emphasis === 'filtered' ? undefined : device.name}
          data-state={device.state}
          data-face={face}
          data-conflict={conflict}
          data-emphasis={emphasis}
          // Keyboard: the panel keeps one device as tab stop and moves the focus with the arrow keys (keyboard.ts), shows
          // the card on focus and opens the links on Enter.
          tabIndex={focusable ? -1 : undefined}
          role={back ? undefined : keyboard === 'button' ? 'button' : 'img'}
          aria-label={back ? undefined : title}
          aria-hidden={back ? true : undefined}
          data-y={y}
          data-height={height}
          data-vertical={vertical || undefined}
          opacity={opacity}
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
          {look.hatched && (
            <rect x={x} y={y} width={width} height={height} rx={2} fill={`url(#${hatch.unmonitored})`} />
          )}
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
              // Often cut to fit: the full name is in aria-label.
              aria-hidden
            >
              {text}
            </text>
          )}
        </g>
        {badge > 0 && (
          <g
            data-testid="alert-badge"
            data-badge-of={device.name}
            data-count={alerts}
            opacity={opacity}
            pointerEvents="none"
            aria-hidden
          >
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
              aria-hidden
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
