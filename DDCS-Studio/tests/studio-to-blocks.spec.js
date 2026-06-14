import { test, expect } from '@playwright/test';

// "Studio → Blocks": using a STUDIO wizard records the op; opening the Blocks tab renders that op AS its
// block stack with the REAL param values, and re-emits identical-toolpath G-code. Cutting ops emit as full
// programs; snippet ops (WCS/probe) emit bare (no header/footer).
test.use({ viewport: { width: 1400, height: 1000 } });

test('Blocks tab opens the active cutting op (surfacing) as its block stack with real values', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  // open the surfacing wizard and set a distinctive width
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.fill('#sf_w', '123');
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());   // → generate() → recordOp('surfacing', …)

  // switch to Blocks → the hook loads the active op as blocks
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForSelector('#blocks-app:not(.hidden)');

  // surfacing = StepDown{ StepOver(Region) } → a depth wrapper block on the canvas
  await expect(page.locator('#blk-stage .blk.depth')).toHaveCount(1);
  // the emitted G-code reflects the wizard's width (region 0..123 → X123 in the raster passes)
  await expect(page.locator('#blk-gcode')).toContainText('X123');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Blocks tab opens a snippet op (WCS) emitted bare — no program header/footer', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  await page.evaluate(() => window.ddcsStudio.wizardManager.open('wcs'));
  await page.waitForSelector('#wiz_wcs', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());   // → recordOp('wcs', …)

  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForSelector('#blocks-app:not(.hidden)');

  const code = await page.locator('#blk-gcode').textContent();
  expect(code, 'WCS snippet should write a macro var').toMatch(/#\d/);          // a #-register write present
  expect(code, 'snippet is bare: no M30 footer').not.toContain('M30');
  expect(code, 'snippet is bare: no program clearance header').not.toContain('( clearance )');
  expect(errors, errors.join('\n')).toEqual([]);
});
