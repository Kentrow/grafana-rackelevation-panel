import React, { useLayoutEffect, useRef, useState } from 'react';
import { DataLink, LinkModel } from '@grafana/data';
import { columnField } from '../data/mapping';
import { cardPosition } from '../layout/geometry';
import { ColumnMapping } from '../types';
import { deviceLinks, followLink, rackLinks } from './links';
import { deviceFor, makeTabStop } from './keyboard';
import { DeviceEntry } from './useRackModel';
import { RackModel } from '../model';

interface Menu {
  x: number;
  y: number;
  links: LinkModel[];
}

export const TOOLTIP_OFFSET = 12;

/** Name of the device under the pointer, from the data-device attribute of its group. */
const deviceAt = (target: EventTarget) => (target as Element).closest?.('[data-device]')?.getAttribute('data-device');

interface Context {
  model: RackModel;
  devices: Map<string, DeviceEntry>;
  columns: ColumnMapping;
  linkDefaults: DataLink[] | undefined;
  showTooltip: boolean;
  /** Size of the panel, that the card stays in. */
  width: number;
  height: number;
}

/**
 * Pointer and keyboard on the racks: the device card that follows the pointer or the focus, the data links of the
 * devices and of the rack names, opened directly or from a menu, and the arrow keys between devices. The handlers
 * go on the element around the drawing; the drawing is never rendered again for them.
 */
export function useRackInteractions({ model, devices, columns, linkDefaults, showTooltip, width, height }: Context) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  // Pointer position in the panel. Moving within a device only moves the card, without rendering the panel again.
  const pointer = useRef({ x: 0, y: 0 });

  /** Measures the card once drawn and moves it next to the pointer, inside the panel. */
  const placeCard = () => {
    if (cardRef.current) {
      const size = { width: cardRef.current.offsetWidth, height: cardRef.current.offsetHeight };
      const { left, top } = cardPosition(pointer.current, size, { width, height }, TOOLTIP_OFFSET);
      cardRef.current.style.left = `${left}px`;
      cardRef.current.style.top = `${top}px`;
    }
  };
  // Before the browser paints the card of a new device.
  useLayoutEffect(() => {
    if (hover) {
      placeCard();
    }
  });

  const onMouseMove = (event: React.MouseEvent) => {
    const name = deviceAt(event.target);
    if (!name || !showTooltip || menu) {
      setHover(null);
      return;
    }
    const box = wrapperRef.current!.getBoundingClientRect();
    pointer.current = { x: event.clientX - box.left, y: event.clientY - box.top };
    if (hover === name) {
      placeCard();
    } else {
      setHover(name);
    }
  };

  /** Links of the device or of the rack name under the pointer or the focus. */
  const linksAt = (target: EventTarget): LinkModel[] => {
    const hit = devices.get(deviceAt(target) ?? '');
    if (hit) {
      const deviceField = model.devicesFrame && columnField(model.devicesFrame, 'device', columns);
      return deviceLinks(model.devicesFrame, hit.device.row, linkDefaults, deviceField);
    }
    const rackId = (target as Element).closest?.('[data-rack]')?.getAttribute('data-rack');
    const rack = model.racks.find((r) => r.rack.id === rackId)?.rack;
    return rack ? rackLinks(model.racksFrame, rack.row, linkDefaults) : [];
  };

  /** Follows the only link, or opens the menu of several. */
  const open = (links: LinkModel[], event: React.MouseEvent | React.KeyboardEvent, x: number, y: number) => {
    if (links.length === 1) {
      followLink(links[0], event as React.MouseEvent);
    } else if (links.length > 1) {
      setHover(null);
      setMenu({ x, y, links });
    }
  };

  // Keyboard: the card follows the focus, Enter or Space opens the links, Escape closes the card and the menu.
  const onFocus = (event: React.FocusEvent) => {
    const name = deviceAt(event.target);
    if (name && scrollerRef.current) {
      makeTabStop(scrollerRef.current, event.target as HTMLElement);
    }
    if (!name || !showTooltip) {
      return;
    }
    const box = wrapperRef.current!.getBoundingClientRect();
    const rect = (event.target as Element).getBoundingClientRect();
    pointer.current = { x: rect.right - box.left, y: rect.top + rect.height / 2 - box.top };
    setHover(name);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const device = deviceAt(event.target) ? (event.target as Element).closest<HTMLElement>('[data-device]') : null;
    const next = device && scrollerRef.current ? deviceFor(scrollerRef.current, device, event.key) : undefined;
    if (next) {
      event.preventDefault();
      next.focus();
    } else if (event.key === 'Escape') {
      // Escape closes the card or the menu first; with nothing open, it goes on to Grafana (leaving the panel view).
      if (hover || menu) {
        event.stopPropagation();
      }
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

  return {
    /** Ref of the panel, that the pointer is measured from. */
    wrapperRef,
    /** Ref of the element around the drawing, which gets the handlers. */
    scrollerRef,
    /** Ref of the card. */
    cardRef,
    /** The device of the card, with its rack. */
    hovered: hover ? devices.get(hover) : undefined,
    menu,
    closeMenu: () => setMenu(null),
    onMouseMove,
    onMouseLeave: () => setHover(null),
    onClick: (event: React.MouseEvent) => open(linksAt(event.target), event, event.clientX, event.clientY),
    onFocus,
    onBlur: () => setHover(null),
    onKeyDown,
  };
}
