import { test, expect } from '@playwright/test';

/**
 * t796 P4 — FIELD DEEP-LINKS. A binding declares where its truth LIVES (or inherits the per-param FIELD_LINKS default);
 * renderOpForm shows a row-end ⚙ that opens it OVER the wizard with the return-glow. First: the wcs field → Settings WCS
 * table (every twin inherits via the ONE FIELD_LINKS map — no per-wizard link code). Also: the visibility modal footer.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('the wcs field renders a deep-link ⚙ that opens Settings → WCS table OVER the wizard, with a return', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  await page.evaluate(() => window.openWiz('user_contour_data'));
  await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param="wcs"]'), null, { timeout: 8000 });

  const hasGear = await page.evaluate(() => {
    const el = document.querySelector('#wiz_user_form [data-param="wcs"]');
    const row = el.closest('.has-field-link');
    return !!(row && row.querySelector('.field-link-gear'));
  });
  expect(hasGear, 'the wcs field renders the row-end deep-link gear').toBe(true);

  await page.click('#wiz_user_form [data-param="wcs"] ~ .field-link-gear, #wiz_user_form .has-field-link .field-link-gear');
  await page.waitForSelector('#settings-app', { state: 'visible', timeout: 6000 });
  const nav = await page.evaluate(() => {
    const tab = document.querySelector('.settings-tab[data-target="set_tab_wcs"]');
    const panel = document.getElementById('set_tab_wcs');
    const shown = panel && getComputedStyle(panel).display !== 'none';
    const wizOpen = document.getElementById('wizard') && getComputedStyle(document.getElementById('wizard')).display !== 'none';
    const ret = window.ddcsNavReturn && window.ddcsNavReturn.activeReturn();
    return { tabActive: !!(tab && tab.classList.contains('active')), panelShown: !!shown, wizOpen: !!wizOpen, hasReturn: !!ret };
  });
  expect(nav.tabActive || nav.panelShown, 'Settings opened scrolled to the WCS table').toBe(true);
  expect(nav.wizOpen, 'Settings opened OVER the wizard (still open behind)').toBe(true);
  expect(nav.hasReturn, 'a return token (the glow) is active').toBe(true);
});

test('EVERY twin inherits the wcs gear from the ONE FIELD_LINKS map (spot-check 3)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
  for (const twin of ['user_pocket_data', 'user_corner_data', 'user_middle_data']) {
    await page.evaluate((t) => window.openWiz(t), twin);
    await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param="wcs"]'), null, { timeout: 8000 });
    const hasGear = await page.evaluate(() => {
      const el = document.querySelector('#wiz_user_form [data-param="wcs"]');
      const row = el.closest('.has-field-link');
      return !!(row && row.querySelector('.field-link-gear'));
    });
    expect(hasGear, `${twin}: the wcs gear inherited from FIELD_LINKS`).toBe(true);
    await page.evaluate(() => window.closeWiz && window.closeWiz());
  }
});

test('P4b: the stock modal "Sits at WCS" ⚙ deep-links to the WCS table', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(async () => { const a = document.createElement('div'); document.body.appendChild(a); const m = await import('/ui/stockEditor.js'); m.openStockEditor(a); });
  await page.waitForSelector('#se_wcs_link', { timeout: 6000 });
  await page.click('#se_wcs_link');
  await page.waitForSelector('#settings-app', { state: 'visible', timeout: 6000 });
  const shown = await page.evaluate(() => { const p = document.getElementById('set_tab_wcs'); return !!(p && getComputedStyle(p).display !== 'none'); });
  expect(shown, 'the stock modal ⚙ opened Settings → WCS table (the SAME affordance as the twin wcs field)').toBe(true);
});

test('P4c: the visibility modal footer "More preview settings…" opens Settings → Preview', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  await page.evaluate(async () => { const a = document.createElement('div'); document.body.appendChild(a); const m = await import('/ui/visibilityModal.js'); m.openVisibilityModal(a); });
  await page.waitForSelector('[data-morepreview]', { timeout: 6000 });
  await page.click('[data-morepreview]');
  await page.waitForSelector('#settings-app', { state: 'visible', timeout: 6000 });
  const shown = await page.evaluate(() => { const p = document.getElementById('set_tab_preview'); return !!(p && getComputedStyle(p).display !== 'none'); });
  expect(shown, 'the footer link opened Settings → Preview (the deeper prefs, one tap away)').toBe(true);
});
