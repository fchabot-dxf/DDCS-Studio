import { test, expect } from '@playwright/test';

// All 5 ATC wizards now open in the two-pane layout with the shared 3D preview panel (form left / 3D right).
// The probe + manual-change wizards trace real motion; warmup + drawbar still mount the panel (▶ line-steps).
test.use({ viewport: { width: 1280, height: 900 } });

const ATC = [
  { type: 'atc_length', panel: 'wiz_atc_length', viz: 'atcLengthViz' },
  { type: 'atc_check', panel: 'wiz_atc_check', viz: 'atcCheckViz' },
  { type: 'atc_warmup', panel: 'wiz_atc_warmup', viz: 'atcWarmupViz' },
  { type: 'atc_change', panel: 'wiz_atc_change', viz: 'atcChangeViz' },
  { type: 'atc_test', panel: 'wiz_atc_test', viz: 'atcTestViz' },
];

for (const w of ATC) {
  test(`${w.type}: two-pane + shared 3D preview mounts`, async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager);
    await page.evaluate((t) => window.ddcsStudio.wizardManager.open(t), w.type);
    await page.waitForSelector(`#${w.panel}`, { state: 'visible' });

    // the modal is in two-pane mode and the shared preview panel mounted into this wizard's visual pane
    expect(await page.evaluate(() => document.querySelector('.wiz-box').classList.contains('two-pane')), 'two-pane modal').toBeTruthy();
    await page.waitForFunction((sel) => { const h = document.querySelector(sel); return !!(h && h.querySelector('canvas')); }, `#${w.panel} .wiz-viz3d`, { timeout: 8000 });

    // code preview is populated and the viz status line is set
    const code = await page.locator(`#${w.panel} pre[id$="_code"]`).textContent();
    expect((code || '').trim().length, 'code preview populated').toBeGreaterThan(0);
    const status = await page.locator(`#${w.viz}Status`).textContent();
    expect((status || '').trim().length, 'viz status line set').toBeGreaterThan(0);
  });
}
