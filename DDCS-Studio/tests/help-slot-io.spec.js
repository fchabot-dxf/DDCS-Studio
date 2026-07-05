import { test, expect } from '@playwright/test';

// DECLARED HELP SLOT (1b): an optional `help` on the I/O TYPE CATALOG entry (its own declaration domain) → renderIoTable
// renders it as a native title= on the row label (what the pin DOES on the machine). Same dumb native pattern as 1a.
// The Settings I/O table IS renderIoTable(container, kind, list, onChange) over the catalog — drive it directly.

test('help slot 1b: the I/O type help renders as the row-label tooltip (outputs)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { renderIoTable, OUTPUT_TYPES } = await import('/ui/ioTable.js');
    const host = document.createElement('div'); document.body.appendChild(host);
    renderIoTable(host, 'output', [{ type: 'drawbar', pin: 1, onCode: 'M154', offCode: 'M155' }, { type: 'custom', pin: 2 }], () => {});
    const drawbarHelp = (OUTPUT_TYPES.find((t) => t.type === 'drawbar') || {}).help;
    const inputs = [...host.querySelectorAll('input[type="text"]')];
    const labelFor = (v) => inputs.find((i) => (i.value || '').includes(v));
    return { drawbarHelp, drawbarTitle: (labelFor('Drawbar') || {}).title, customTitle: (labelFor('Custom') || {}).title };
  });
  expect(r.drawbarHelp, 'the catalog declares the drawbar help').toContain('RELEASES');
  expect(r.drawbarTitle, 'the row-label tooltip IS the declared type help').toBe(r.drawbarHelp);
  expect(r.customTitle, 'a type WITHOUT help keeps the plain rename hint (unchanged)').toContain('edit to rename');
});

test('help slot 1b: the sensor input type help names the ATC waits (inputs)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    const { renderIoTable } = await import('/ui/ioTable.js');
    const host = document.createElement('div'); document.body.appendChild(host);
    renderIoTable(host, 'input', [{ type: 'sensor', pin: 3, label: 'Drawbar released (M301)' }, { type: 'estop', pin: 4 }], () => {});
    const inputs = [...host.querySelectorAll('input[type="text"]')];
    const labelFor = (v) => inputs.find((i) => (i.value || '').includes(v));
    return { sensorTitle: (labelFor('Drawbar released') || {}).title, estopTitle: (labelFor('E-stop') || {}).title };
  });
  expect(r.sensorTitle, 'the sensor type help explains the ATC waits').toContain('M301');
  expect(r.sensorTitle).toContain('spindle stopped (M300)');
  expect(r.estopTitle, 'a type WITHOUT help is unchanged').toContain('edit to rename');
});
