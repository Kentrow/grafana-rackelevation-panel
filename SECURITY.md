# Security policy

## Supported versions

Fixes go into the latest version published in the Grafana plugin catalog.

## Reporting a vulnerability

Please do not open a public issue. Report it privately with
[Report a vulnerability](https://github.com/Kentrow/grafana-rackelevation-panel/security/advisories/new), in the
Security tab of the repository: what an attacker can do, and how to reproduce it.

You get an answer as soon as possible. Once fixed, the release notes credit you, unless you prefer otherwise.

## Scope

The panel runs in the browser, inside Grafana: it reads the data frames of its queries and the data links of the
field config, and keeps no secret. Vulnerabilities of Grafana itself or of the data sources go to
[Grafana](https://grafana.com/legal/report-a-security-issue/). The Grafana packages (`@grafana/ui`, `@grafana/runtime`...)
are provided by Grafana at run time and are not bundled in the plugin: their advisories are fixed by upgrading
Grafana.
