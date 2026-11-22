// Records the animated demo of the README: a scripted tour of the demo dashboard, saved as PNG frames with their
// durations. scripts/make-gif.py then writes src/img/demo.gif from them.
//
// Requires the dev stack (npm run build && npm run server). Usage: node scripts/record-demo.mjs [grafana url]

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const GRAFANA = process.argv[2] ?? 'http://localhost:3000';
const OUT = 'test-results/demo-frames';
const SIZE = { width: 1600, height: 820 };

// Screenshots do not show the pointer: draw one that follows the mouse.
const POINTER = `
  window.addEventListener('DOMContentLoaded', () => {
    const pointer = document.createElement('div');
    pointer.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.3 L10 13 L16 13 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    Object.assign(pointer.style, { position: 'fixed', left: '-40px', top: '-40px', zIndex: 2147483647, pointerEvents: 'none' });
    document.body.appendChild(pointer);
    window.addEventListener('mousemove', (e) => {
      pointer.style.left = e.clientX - 3 + 'px';
      pointer.style.top = e.clientY - 2 + 'px';
    }, true);
  });
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, colorScheme: 'dark' });
await page.addInitScript(POINTER);
await page.goto(`${GRAFANA}/d/rack-elevation-demo/rack-elevation-demo?viewPanel=panel-2&kiosk&theme=dark&var-device=`);
const panel = page.getByTestId('rack-panel');
await panel.waitFor();
await page.waitForTimeout(1500);

// Frames are taken as fast as the browser gives them, each one lasting until the next.
const frames = [];
let recording = true;
const recorder = (async () => {
  while (recording) {
    frames.push({ time: Date.now(), png: await page.screenshot() });
  }
})();

const centre = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const moveTo = async (locator, steps = 18) => {
  const { x, y } = await centre(locator);
  await page.mouse.move(x, y, { steps });
};
const device = (name) => panel.locator(`[data-testid="device-${name}"][data-face="front"] rect`).first();

await page.mouse.move(800, 790);
await page.waitForTimeout(800);

// The card of a device, with its alerts, follows the pointer.
for (const name of ['sw-a1-tor-02', 'nas-a1-02', 'srv-a3-06']) {
  await moveTo(device(name));
  await page.waitForTimeout(1300);
}

// Highlight a family of devices from the dashboard variable, with a wildcard.
const input = page.getByRole('textbox').first();
await moveTo(input);
await input.click();
await page.keyboard.type('sw-a1-*', { delay: 110 });
await page.keyboard.press('Enter');
await page.mouse.move(1100, 560, { steps: 12 });
await page.waitForTimeout(2200);

// Clear it with the button above the racks.
await moveTo(page.getByTestId('clear-highlight'));
await page.waitForTimeout(400);
await page.getByTestId('clear-highlight').click();
await page.waitForTimeout(1200);

// Where does a new 4U device fit? The free blocks of the racks, from the space variable.
const space = page.getByRole('textbox').nth(1);
await moveTo(space);
await space.click();
await page.keyboard.type('4', { delay: 110 });
await page.keyboard.press('Enter');
await page.mouse.move(1100, 560, { steps: 12 });
await page.waitForTimeout(2600);
await space.fill('');
await page.keyboard.press('Enter');
await page.waitForTimeout(600);

// A click opens the data links of the device.
await moveTo(device('fw-par1-01'));
await page.waitForTimeout(500);
await device('fw-par1-01').click();
await page.waitForTimeout(2000);
await page.keyboard.press('Escape');
await page.mouse.move(1560, 800, { steps: 10 });

// The keyboard: one tab stop, the arrows move from device to device.
await panel.locator('[data-device][tabindex="0"]').focus();
await page.waitForTimeout(900);
for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) {
  await page.keyboard.press(key);
  await page.waitForTimeout(750);
}
await page.waitForTimeout(800);

recording = false;
await recorder;
await browser.close();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const durations = [];
for (const [i, frame] of frames.entries()) {
  await writeFile(`${OUT}/${String(i).padStart(4, '0')}.png`, frame.png);
  durations.push((frames[i + 1]?.time ?? frame.time + 1500) - frame.time);
}
await writeFile(`${OUT}/durations.json`, JSON.stringify(durations));
console.log(`${frames.length} frames, ${(durations.reduce((a, b) => a + b, 0) / 1000).toFixed(1)} s, in ${OUT}`);
