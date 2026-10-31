import React from 'react';
import { DataFrame, DataLink, LinkModel, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

/**
 * Data links of a device row. Links set in the field config defaults are on every field, so they are
 * deduplicated; links set by an override on one field are kept too.
 */
export function deviceLinks(frame: DataFrame | undefined, row: number): LinkModel[] {
  if (!frame) {
    return [];
  }
  const links: LinkModel[] = [];
  const seen = new Set<string>();
  for (const field of frame.fields) {
    if (!field.config.links?.length || !field.getLinks) {
      continue;
    }
    for (const link of field.getLinks({ valueRowIndex: row })) {
      const key = `${link.title}\n${link.href}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push(link);
      }
    }
  }
  return links;
}

export const hasLinks = (frame: DataFrame | undefined) => Boolean(frame?.fields.some((f) => f.config.links?.length));

/** Follows a link as Grafana does: its own handler, a new tab, the Grafana router, or a plain navigation. */
export function followLink(link: LinkModel, event: React.MouseEvent) {
  if (link.onClick) {
    link.onClick(event);
  } else if (link.target === '_blank') {
    window.open(link.href, '_blank', 'noopener,noreferrer');
  } else {
    const url = locationUtil.stripBaseFromUrl(link.href);
    if (url.startsWith('/')) {
      locationService.push(url);
    } else {
      window.location.assign(link.href);
    }
  }
}

/**
 * Data links of a rack row of the racks frame. Links of the field config defaults are on every frame and are written
 * for the devices; only the links set on the racks frame by an override, such as Fields returned by query, are its own.
 */
export function rackLinks(
  frame: DataFrame | undefined,
  row: number | undefined,
  defaults: DataLink[] = []
): LinkModel[] {
  if (!frame || row === undefined) {
    return [];
  }
  const inherited = new Set(defaults.map((l) => `${l.title}\n${l.url}`));
  const links: LinkModel[] = [];
  const seen = new Set<string>();
  for (const field of frame.fields) {
    const own = (field.config.links ?? []).filter((l) => !inherited.has(`${l.title}\n${l.url}`));
    if (own.length === 0 || !field.getLinks) {
      continue;
    }
    for (const link of field.getLinks({ valueRowIndex: row })) {
      const key = `${link.title}\n${link.href}`;
      if (own.some((l) => l.title === link.title) && !seen.has(key)) {
        seen.add(key);
        links.push(link);
      }
    }
  }
  return links;
}
