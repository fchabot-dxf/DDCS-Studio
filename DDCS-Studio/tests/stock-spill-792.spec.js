import { test, expect } from '@playwright/test';

/**
 * t792 P1 — THE STOCK SPILL LEAVES THE WIZARD FORMS. A program runs on ONE setup with ONE stock; the per-op
 * stockW/stockH/stockZ/stockDatum fields were a data-model artifact, not a placement choice. They leave every mill
 * twin's FORM (declared `formHidden`) — the two REAL placement choices (Path Datum + Attach to Stock) remain. Nothing
 * is lost: the PlaceOnStock atom still carries the numbers in the stack (resolved from the global stock), Blocks still
 * edits them, and the emit is BYTE-IDENTICAL (the fields defaulted to follow-the-stock).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// t800 — tap ADDED: the P5 help sweep found the tap twin still spilling its stock block; the P1 assert now extends to it (the 8th twin).
const TWINS = ['user_pocket_data', 'user_contour_data', 'user_drill_data', 'user_bore_data', 'user_surfacing_data', 'user_slot_data', 'user_text_data', 'user_tap_data'];

test('the four stock fields are GONE from every mill twin form; Path Datum + Attach remain', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz);

  for (const twin of TWINS) {
    await page.evaluate((t) => window.openWiz(t), twin);
    await page.waitForFunction(() => document.querySelector('#wiz_user_form [data-param]'), null, { timeout: 8000 });
    const params = await page.evaluate(() => [...document.querySelectorAll('#wiz_user_form [data-param]')].map((e) => e.dataset.param));
    for (const stock of ['stockW', 'stockH', 'stockZ', 'stockDatum']) {
      expect(params, `${twin}: ${stock} left the form`).not.toContain(stock);
    }
    expect(params, `${twin}: Path Datum (the real placement choice) remains`).toContain('pathDatum');
    expect(params, `${twin}: Attach to Stock (the real placement choice) remains`).toContain('stockAttach');
    await page.evaluate(() => window.closeWiz && window.closeWiz());
  }
});
