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

// REVERSE sync: editing a block on the canvas, then returning to STUDIO, reconciles the wizard form from
// the edited stack (and re-runs the wizard). Completes the bidirectional loop.
test('Blocks → STUDIO reverse sync: editing a block reconciles the wizard form', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  await page.evaluate(() => window.ddcsStudio.wizardManager.open('surfacing'));
  await page.waitForSelector('#wiz_surfacing', { state: 'visible' });
  await page.fill('#sf_toolDia', '12');
  await page.fill('#sf_depth', '2');
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());

  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForSelector('#blocks-app:not(.hidden)');
  // edit the StepDown depth (`to`) and the StepOver value (`stepover`) on the canvas
  const toInput = page.locator('#blk-stage .blk.depth [data-key="to"]').first();
  await expect(toInput).toBeVisible();
  await toInput.fill('7');
  await toInput.dispatchEvent('input');
  const soInput = page.locator('#blk-stage .blk.fill [data-key="stepover"]').first();
  await expect(soInput).toBeVisible();
  await soInput.fill('6');
  await soInput.dispatchEvent('input');

  // back to STUDIO → the form reconciles from the edited block: depth=7, and stepover% = 6/12*100 = 50
  await page.evaluate(() => window.showApp('studio'));
  await expect(page.locator('#sf_depth')).toHaveValue('7');
  await expect(page.locator('#sf_stepoverPct')).toHaveValue('50');
});

test('Blocks → STUDIO reverse sync: pocket (un-inset) and drill (array) round-trip', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);

  // POCKET: edit the StepDown depth on the canvas → p_depth reconciles
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('pocket'));
  await page.waitForSelector('#wiz_pocket', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForSelector('#blocks-app:not(.hidden)');
  const pTo = page.locator('#blk-stage .blk.depth [data-key="to"]').first();
  await expect(pTo).toBeVisible();
  await pTo.fill('9');
  await pTo.dispatchEvent('input');
  await page.evaluate(() => window.showApp('studio'));
  await expect(page.locator('#wiz_pocket')).toBeVisible();
  await expect(page.locator('#p_depth')).toHaveValue('9');

  // DRILL: edit the Array `cols` on the canvas → d_cols reconciles
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForSelector('#blocks-app:not(.hidden)');
  const dCols = page.locator('#blk-stage .blk.container [data-key="cols"]').first();
  await expect(dCols).toBeVisible();
  await dCols.fill('5');
  await dCols.dispatchEvent('input');
  await page.evaluate(() => window.showApp('studio'));
  await expect(page.locator('#d_cols')).toHaveValue('5');
});
