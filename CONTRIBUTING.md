# Contributing

Thanks for your interest in the rack elevation panel. Bugs and feature requests go to the
[issues](https://github.com/Kentrow/grafana-rackelevation-panel/issues); for a bug, the CSV or the table that the panel
receives (Query inspector, Data tab) helps a lot.

## Development

Requirements: Node.js 22 or later, and Docker.

```bash
npm install
npm run dev        # build in watch mode
npm run server     # Grafana on http://localhost:3000, Prometheus on :9090, fake exporter
npm run typecheck
npm run lint
npm run test       # unit tests, watch mode; npm run test:ci for one run
npm run test:perf  # performance budget of large.csv, run apart and in band
npm run e2e        # Playwright tests against the running server
```

Changes to `src/plugin.json` need a restart of the Grafana server.

## Project rules

- `src/data/` and `src/layout/` are pure functions, without React, state, theme or I/O, and tested with Jest. The
  components only draw what they compute.
- No `any`. Frames are typed with `DataFrame` and `Field` from `@grafana/data`.
- Colours, spacing and typography come from the Grafana theme; styles use Emotion with `useStyles2`.
- Do not change anything in `.config/`: it belongs to `@grafana/create-plugin`, which updates it with
  `npx @grafana/create-plugin@latest update`. Extend the configurations from the files at the root instead, as
  `webpack.config.ts` does.
- The layout snapshots of `src/__snapshots__/` are reviewed by a human: read the diff before updating them.
- The user documentation is `src/README.md`, the page of the plugin in the catalog. Its quick-start CSV is the
  `quick-start` fixture, and a test keeps them equal.

## Test data

- `tests/fixtures/` holds the reference data sets: one CSV per frame, a directory when a data set has several frames
  (devices, racks, alerts...). `multi-rack/`, `large.csv` and `prometheus-auto/` are written by `npm run fixtures`.
- `npm run dashboards` writes the provisioned dashboards from the fixtures, as TestData CSV content queries:
  - `dashboard.json`: the small dashboard of the e2e tests.
  - `demo.json`: the demo, with temperature thresholds, data links on the devices and the racks, a `device` variable
    for the highlight and a `role` variable for the filter.
  - `fixtures.json`: one panel per fixture, plus three Prometheus frames joined by field.
  - `live.json`: the PromQL recipes on the metrics of `dev/exporter`, which serves `netbox_rack_info`,
    `netbox_device_info`, `device_up` and `device_temperature_celsius` for the `multi-rack` devices. Temperatures
    move, devices go down now and then, and `dev/rules.yml` fires `DeviceDown` and `HighTemperature` alerts.
- Never edit the generated fixtures or `provisioning/dashboards/*.json` by hand: change the scripts of `scripts/` and
  run them. The CI fails when the committed files differ from what the scripts write.

## Pull requests

Before opening one, run `npm run typecheck`, `npm run lint`, `npm run test:ci` and, for a change of the drawing or
the interactions, `npm run e2e`. Add a line to `CHANGELOG.md` under the next version.

## Releases

1. Update `CHANGELOG.md`: version, date, changes grouped by type.
2. `npm version <major|minor|patch>`, then `git push origin main --follow-tags`.
3. The Release workflow builds the plugin with a provenance attestation, runs the plugin validator and creates a draft
   GitHub release. Review it and publish it.
4. Submit the archive and its SHA1 from the release on grafana.com, under My Plugins.
