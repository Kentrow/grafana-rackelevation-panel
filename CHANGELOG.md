# Changelog

## Unreleased

**Features:**

- Free space: **Free space for** a new device of a given height, typed or from a variable such as `$space`, outlines
  the blocks of free units where it fits on each face, on both faces for a full-depth device. The demo dashboard has a
  **Free space (U)** variable.
- Label templates: a **Label template** such as `{device} · {ip}` writes any column of the device row in the label,
  formatted as Grafana displays it, `{value}` being the colour value with its unit.

**Performance:**

- Moving the pointer over a device no longer renders the panel again, only the card moves; going from device to
  device is about 14 times faster on a room of 1000 devices.
- A change of highlight draws again only the devices whose emphasis changes, about twice as fast.

**Accessibility:**

- Keyboard: the devices are one stop in the tab order instead of one each (a thousand on a large room); the arrow
  keys, Home and End move between them, and the faded copies of the other face are left out.
- The focused device is drawn with a thick border in every browser; Firefox drew no outline around SVG groups.
- Devices are named after what is written on them, then their alerts, model, value and state, and are buttons only
  when they have links. Truncated labels and rack names are cut between words.
- No axe violation (WCAG 2.1 A and AA) on the demo and fixtures dashboards, in both themes, checked in the end-to-end
  tests.

**Documentation:**

- A reference of every option with its default, and every problem message in the troubleshooting.

- An animated tour of the demo dashboard in the README: device card, highlight with a wildcard, data links and
  keyboard. `npm run demo` and `scripts/make-gif.py` make it again when the drawing changes.

- The NetBox recipe is checked on NetBox 4.7 with Infinity 4.1: the parent of a child device comes from
  `parent_bay.device.name`, since GraphQL has no `parent_device` field (the query failed); the NetBox `status` gives
  the state; the format of the v2 API tokens is given.

## [1.1.0](https://github.com/Kentrow/grafana-rackelevation-panel/tree/v1.1.0) (2026-11-22)

**Features:**

- The state of each rack at a glance, next to its name: a red dot when one of its devices is out of service, green
  when its monitored devices are in service, grey when none is monitored, and the count of its active alerts. As in
  the legend, only the devices of the role filter count. The new **Show rack state** option turns it off.
- `*` wildcards in the highlight variable: `sw-a1-*` highlights every device whose name starts with `sw-a1-`.

**Fixes:**

- Half-unit positions and heights (NetBox 0.5U): overlaps, overflows and free units are computed on the real span of
  each device, so a 1U device at U1.5 now conflicts with one at U1.
- The racks frame is found when the device column is mapped to `name`, as for NetBox, although it has a `name` column
  too.
- A rack height of 0 or less is read as missing instead of drawing a negative rack.
- Rack and device names with a comma, typed in the options or coming from a variable, are no longer split in two.
- Data links of the field config defaults written with `${__field.name}` or `${__value.raw}` are listed once in the
  device menu, as resolved on the device field, instead of once per column.
- In range queries, a row without time no longer stays the latest row of its device.
- Devices in a parent cycle (A's parent is B, B's parent is A) are listed as problems instead of vanishing.
- A device far outside its rack (a wrong position such as U1000) is drawn at the edge of a 4U overflow zone instead
  of shrinking every rack of the panel.
- The device card stays inside the panel, in narrow panels and with tall cards.
- The legend no longer counts the devices of the 0U band when the band is hidden.
- The card shows U3 for a 0.5U device at U3, and an extra column named like a row of the card (Units, Rack...) is
  shown as well.
- Escape closes the card or the menu without also leaving the panel view.

## [1.0.1](https://github.com/Kentrow/grafana-rackelevation-panel/tree/v1.0.1) (2026-11-04)

**Changes:**

- Signed with a community signature: the plugin installs without allowing unsigned plugins.

**Dependencies:**

- Build and test tooling updated: TypeScript 5.9.3, webpack-cli 7, sass-loader 17, eslint-plugin-jsdoc 65,
  @testing-library/jest-dom 7, @emotion/css 11.13, and the Grafana plugin actions of the CI. No change in the panel.
- Development and CI on Node.js 24.5 or later, required by the signing tool.

## [1.0.0](https://github.com/Kentrow/grafana-rackelevation-panel/tree/v1.0.0) (2026-10-31)

First public release.

**Features:**

- Racks drawn unit by unit from table data: devices frame, optional racks and alerts frames, found by their columns or
  picked in the options; columns mapped to other names when needed.
- NetBox placement rules: lowest unit, ascending or descending numbering, starting unit, front and rear faces,
  full-depth devices, 0U band, child devices listed in their parent.
- One or several racks side by side on the same floor, front, rear or both faces, any width (10-inch, 19-inch...),
  auto unit height that fills the panel, or fit to panel.
- Colours, units and value mappings from the standard field config; several colour fields, each device taking the
  first one with a value, each with its own thresholds through overrides.
- In service, out of service and not monitored states; value mapping colours on the status field; active alerts badge.
- Free units under each rack name, legend with the counts by state and the active alerts.
- Device card on hover with extra columns, alerts and child devices; data links on click; rack links on the rack name.
- Highlight of the devices of a dashboard variable, with a clear button; role filter following a variable.
- Keyboard navigation: Tab through the devices, Enter for their links, Escape to close.
- Overlapping, overflowing and duplicate devices drawn and listed, never hidden; message when no rack can be drawn.
- Range queries: only the latest row of each device is read.
- Visualization suggestion when a frame has rack and position columns.
