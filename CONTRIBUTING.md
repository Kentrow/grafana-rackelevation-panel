# Contributing

Thanks for your interest in the rack elevation panel. Bugs and feature requests go to the
[issues](https://github.com/Kentrow/grafana-rackelevation-panel/issues), whose forms ask for what helps most: for a
bug, the CSV or the table that the panel receives (Query inspector, Data tab). Security vulnerabilities are reported
privately, as [SECURITY.md](SECURITY.md) says.

## Development

Requirements: Node.js 24.5 or later, and Docker.

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
  `npx @grafana/create-plugin@latest update`, run by hand now and then in a pull request of its own (Dependabot
  updates the dependencies, not the scaffold). Extend the configurations from the files at the root instead, as
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

## Screenshots and demo

The catalog shows the screenshots of `src/img/` listed in `src/plugin.json`, and the README the animated demo
`src/img/demo.gif`. Retake them when the drawing changes, from the dev stack (`npm run build && npm run server`):

- Screenshots: 1600 x 820 px at a device scale of 1, in kiosk mode (`&kiosk`): `screenshot-racks.png` is the panel
  Both faces of the demo dashboard, dark, with a device card; `screenshot-light.png` the panel Filtered by role, light,
  with a highlight; `screenshot-conflicts.png` the collisions panel of the fixtures dashboard with its problems open.
- Demo: `npm run demo` plays a scripted tour of the demo dashboard and saves its frames in `test-results/demo-frames/`;
  `scripts/make-gif.py` writes `src/img/demo.gif` from them. It needs Pillow, for instance in a virtual environment:
  `python3 -m venv /tmp/gif && /tmp/gif/bin/pip install pillow && /tmp/gif/bin/python scripts/make-gif.py`. Keep the
  GIF under a megabyte or two: the catalog page loads it.

## Pull requests

Before opening one, run `npm run typecheck`, `npm run lint`, `npm run test:ci` and, for a change of the drawing or
the interactions, `npm run e2e`. Add a line to `CHANGELOG.md` under the next version. The CI also runs the full plugin
validator on the archive, as the review of the catalog does; to run it yourself, zip `dist` in a folder named after the
plugin id and run `npx -y @grafana/plugin-validator@latest -sourceCodeUri file://./ <archive>.zip`.

## Releases

1. Update `CHANGELOG.md`: version, date, changes grouped by type.
2. `npm version <major|minor|patch>`, then `git push origin main --follow-tags`.
3. The Release workflow builds the plugin with a provenance attestation, runs the plugin validator and creates a draft
   GitHub release. Review it and publish it.
4. Submit the archive and its SHA1 from the release on grafana.com, under My Plugins.
