// Runs the visual regression tests (tests/visual.spec.ts) in the Playwright image of Docker, so that the screenshots
// are rendered the same on a laptop and in CI. Grafana must run (`docker compose up`); the tests share its network.
// Usage: `npm run e2e:visual`, or `npm run e2e:visual:update` to write the baselines again. Other arguments go to
// Playwright.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(ROOT, 'node_modules', '@playwright', 'test', 'package.json'), 'utf8'));
// The image of the architecture of the machine: another one, left by a pull for another platform, runs emulated and
// slowly.
const platform = `linux/${process.arch === 'arm64' ? 'arm64' : 'amd64'}`;
const user = process.getuid ? ['--user', `${process.getuid()}:${process.getgid()}`] : [];

const { status } = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--platform',
    platform,
    ...user,
    '--network',
    'container:kentrow-rackelevation-panel',
    '--ipc',
    'host',
    '-v',
    `${ROOT}:/work`,
    '-w',
    '/work',
    '-e',
    'HOME=/tmp',
    '-e',
    'GRAFANA_URL=http://localhost:3000',
    ...(process.env.CI ? ['-e', 'CI=true'] : []),
    `mcr.microsoft.com/playwright:v${version}-noble`,
    'npx',
    'playwright',
    'test',
    '--project=visual',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' }
);
process.exit(status ?? 1);
