import { test, expect } from '@playwright/test';

// Settings → Preview shows an INTERACTIVE head diagram: the spindle/collet dimension inputs sit ON the drawing
// (clamped to their dimension vectors, Centroid-conversational style) instead of a separate form. Editing one
// redraws the part live and persists to settings so an open preview re-pulls it.
test.use({ viewport: { width: 1280, height: 900 } });

test('Preview head GUI: on-diagram dimension inputs redraw the part and persist', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openSettings && window.ddcsGetSettings);
  await page.evaluate(() => window.openSettings());
  await page.click('[data-target="set_tab_preview"]');

  await expect(page.locator('#set_pv_head_gui svg')).toHaveCount(1);
  await expect(page.locator('#set_pv_head_gui input.dim-edit')).toHaveCount(4);

  const w0 = await page.locator('#set_pv_head_gui rect[data-part="collet"]').getAttribute('width');
  await page.fill('#set_pv_collet_dia', '60');               // edit the dimension on the diagram
  await page.dispatchEvent('#set_pv_collet_dia', 'change');  // commit (blur)
  const w1 = await page.locator('#set_pv_head_gui rect[data-part="collet"]').getAttribute('width');

  expect(Number(w1), 'collet rect widened with the dimension').toBeGreaterThan(Number(w0));
  const head = await page.evaluate(() => window.ddcsGetSettings().preview.head);
  expect(head.colletDia, 'edit persisted to settings').toBe(60);

  // The whole head uses ONE uniform scale, so the spindle's drawn aspect = length / diameter (true proportions).
  await page.fill('#set_pv_spindle_dia', '80');
  await page.fill('#set_pv_spindle_len', '200');
  const sp = await page.locator('#set_pv_head_gui rect[data-part="spindle"]');
  const sw = Number(await sp.getAttribute('width')), sh = Number(await sp.getAttribute('height'));
  expect(sh / sw, 'spindle drawn at true 200:80 = 2.5 ratio').toBeCloseTo(2.5, 1);
});
