# Changelog

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
