import React from 'react';
import { DataFrame, DataLink, Field, LinkModel, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

const linkKey = (link: { title: string; url: string }) => `${link.title}\n${link.url}`;

/**
 * Data links of a device row. Links of the field config defaults are on every field and can resolve differently on
 * each, with ${__field.name} or ${__value.raw}: they are taken from the device field only, or from the first field
 * that has them. Links set by an override on a field are kept too.
 */
export function deviceLinks(
  frame: DataFrame | undefined,
  row: number,
  defaults: DataLink[] = [],
  deviceField?: Field
): LinkModel[] {
  if (!frame) {
    return [];
  }
  const inherited = new Set(defaults.map(linkKey));
  const fields = deviceField ? [deviceField, ...frame.fields.filter((f) => f !== deviceField)] : frame.fields;
  const links: LinkModel[] = [];
  const seen = new Set<string>();
  let defaultsTaken = false;
  for (const field of fields) {
    const config = field.config.links ?? [];
    if (config.length === 0 || !field.getLinks) {
      continue;
    }
    const fromDefaults = config.map((l) => inherited.has(linkKey(l)));
    const resolved = field.getLinks({ valueRowIndex: row });
    // getLinks resolves the links of the config in order, but drops those it cannot build: without the same count,
    // the links of the defaults cannot be told apart and they are only deduplicated.
    const aligned = resolved.length === config.length;
    resolved.forEach((link, i) => {
      const key = `${link.title}\n${link.href}`;
      if ((!aligned || !fromDefaults[i] || !defaultsTaken) && !seen.has(key)) {
        seen.add(key);
        links.push(link);
      }
    });
    defaultsTaken ||= fromDefaults.some(Boolean);
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
