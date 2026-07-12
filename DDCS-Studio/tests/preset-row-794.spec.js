import { test, expect } from '@playwright/test';

/**
 * t794 P3 — THE PRESET ROW MOVES INTO THE FORM (adaptive). Presets leave the wizard header (one mis-tap from ✕) for a
 * slim row at the TOP of every wizard form: 0 saved presets → a subtle "★ Save preset" link; ≥1 → `Preset: [pick ▾]
 * [★ Save]`. Reuses the existing per-op save/load/delete machinery (the popover, re-anchored to ★ Save). Header 📑 gone.
 */
test.use({ viewport: { width: 1400, height: 1000 } });
const OP = 'user_contour_data';

test('adaptive: 0 presets = Save link, ≥1 = pick+save; the header Presets button is retired', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate((op) => localStorage.removeItem('ddcs_tpl_' + op), OP);

  await page.evaluate((op) => window.openWiz(op), OP);
  await page.waitForSelector('#wiz_user .wiz-controls > .wiz-preset-row', { timeout: 8000 });

  // the header 📑 Presets button is gone
  expect(await page.locator('.wiz-templates').count(), 'the header Presets button is retired').toBe(0);

  // 0 presets → only the subtle Save-preset link (no dead dropdown)
  const zero = await page.evaluate(() => {
    const row = document.querySelector('#wiz_user .wiz-preset-row');
    return { hasLink: !!row.querySelector('.wpr-link'), hasPick: !!row.querySelector('.wpr-pick') };
  });
  expect(zero.hasLink, '0 presets → the subtle "★ Save preset" link').toBe(true);
  expect(zero.hasPick, '0 presets → no dead pick dropdown').toBe(false);

  // save one via the machinery, reopen → the full adaptive row with the pick dropdown
  await page.evaluate(async (op) => { const m = await import('/ui/wizardTemplates.js'); await m.saveTemplate(op, 'MyPreset', { depth: 7 }, 'local'); }, OP);
  await page.evaluate((op) => window.openWiz(op), OP);
  await page.waitForFunction(() => { const r = document.querySelector('#wiz_user .wiz-preset-row'); return r && r.querySelector('.wpr-pick'); }, null, { timeout: 8000 });
  const one = await page.evaluate(() => {
    const row = document.querySelector('#wiz_user .wiz-preset-row');
    return { hasPick: !!row.querySelector('.wpr-pick'), options: [...row.querySelectorAll('.wpr-pick option')].map((o) => o.textContent).join(','), hasSave: !!row.querySelector('.wpr-save') };
  });
  expect(one.hasPick, '≥1 preset → the pick dropdown appears').toBe(true);
  expect(one.options, 'the saved preset is listed for loading').toContain('MyPreset');
  expect(one.hasSave, 'the ★ Save button is present').toBe(true);

  await page.evaluate((op) => localStorage.removeItem('ddcs_tpl_' + op), OP);
});
