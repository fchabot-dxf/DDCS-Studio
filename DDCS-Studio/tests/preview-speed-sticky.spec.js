import { test, expect } from '@playwright/test';

// Sim-speed default + stickiness. The preview speed button defaults to 2×, and a pick STICKS: it persists to
// settings.preview.defaultSpeed (the same value Settings → Preview shows) and survives a refresh, instead of
// resetting to the default each session. (User: "default the sim speed to 2x" + "it should be a sticky value".)
test.use({ viewport: { width: 1280, height: 900 } });

async function openPreview(page) {
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForFunction(() => [...document.querySelectorAll('.preview-panel')].some((p) => p.querySelector('.pp-speed')));
}
const speedBtn = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.pp-speed')).querySelector('.pp-speed').textContent.trim());

test('sim speed defaults to 2× and a pick is sticky across a refresh', async ({ page }) => {
  await page.goto('http://localhost:3211');

  // Fresh: the button shows the 2× default on load (not the old hardcoded 1×).
  await openPreview(page);
  expect(await speedBtn(page), 'defaults to 2×').toBe('2×');

  // Pick a NON-default speed → it persists to settings.preview.defaultSpeed.
  await page.evaluate(() => [...document.querySelectorAll('.preview-panel')].find((x) => x.querySelector('.pp-speed')).querySelector('.pp-speed').click()); // 2× → 5×
  expect(await speedBtn(page), 'clicked to 5×').toBe('5×');
  const persisted = await page.evaluate(() => window.ddcsGetSettings().preview.defaultSpeed);
  expect(persisted, 'the pick wrote settings.preview.defaultSpeed (≠ the 2× default, so this proves the write)').toBe(5);

  // Survives a refresh: reload, reopen → the button restores the sticky 5×, not the 2× default.
  await page.reload();
  await openPreview(page);
  expect(await speedBtn(page), 'the 5× pick survived the refresh').toBe('5×');
});
